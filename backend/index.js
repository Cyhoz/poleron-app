const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { db } = require('./firebase');
const { encrypt, decrypt } = require('./utils/encryption');
const axios = require('axios');
const { sendOrderEmail } = require('./utils/emailService');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

dotenv.config();

const app = express();

// --- CONFIGURACIÓN SWAGGER ---
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Poleron App API',
            version: '1.0.0',
            description: 'Documentación oficial de la API para la gestión de pedidos de Polerón. Incluye endpoints para pedidos cifrados, búsqueda de colegios y validaciones de identidad.',
            contact: {
                name: 'Soporte Poleron App',
                email: 'inzunzajuan202@gmail.com'
            }
        },
        servers: [
            {
                url: process.env.RENDER_EXTERNAL_URL || 'http://localhost:10000',
                description: 'Servidor de Producción'
            }
        ]
    },
    apis: ['./index.js'], // Buscamos JSDoc en este mismo archivo
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.set('trust proxy', 1); // Necesario para express-rate-limit en Render
const PORT = process.env.PORT || 10000; // Render usa el puerto 10000 por defecto

app.use(helmet()); 
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 1000, 
    message: { error: 'Demasiadas peticiones, por favor intenta más tarde.' }
});

app.use('/api/', limiter);

app.get('/', (req, res) => {
    res.send('Backend Poleron API - Funcionando');
});

/**
 * @swagger
 * /api/schools:
 *   get:
 *     summary: Obtiene lista de colegios
 *     description: Retorna una lista de instituciones educativas filtradas por comuna, región o búsqueda por nombre.
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Texto para buscar colegios por nombre.
 *       - in: query
 *         name: comuna
 *         schema:
 *           type: string
 *         description: Nombre de la comuna en mayúsculas.
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Nombre de la región en mayúsculas.
 *     responses:
 *       200:
 *         description: Lista de colegios recuperada con éxito.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   nombre:
 *                     type: string
 *                   comuna:
 *                     type: string
 *                   region:
 *                     type: string
 */
app.get('/api/schools', async (req, res) => {
    try {
        let { comuna, region, query, limit = 50 } = req.query;
        comuna = typeof comuna === 'string' ? comuna.trim() : null;
        region = typeof region === 'string' ? region.trim() : null;
        query = typeof query === 'string' ? query.trim() : null;

        let schoolsRef = db.collection('schools');
        if (region) schoolsRef = schoolsRef.where('region', '==', region.toUpperCase());
        if (comuna) schoolsRef = schoolsRef.where('comuna', '==', comuna.toUpperCase());

        const snapshot = await schoolsRef.limit(parseInt(limit)).get();
        let schools = [];
        snapshot.forEach(doc => { schools.push({ id: doc.id, ...doc.data() }); });

        if (query) {
            const searchTerm = query.toLowerCase();
            schools = schools.filter(s => s.nombre.toLowerCase().includes(searchTerm));
        }
        res.json(schools);
    } catch (error) {
        console.error('Error al obtener colegios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

/**
 * @swagger
 * /api/validate-name:
 *   get:
 *     summary: Valida un nombre de identidad
 *     description: Verifica si un nombre y apellido figuran en la base de datos de "nombres reales" autorizados para el sistema.
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre completo a validar (Nombre + Apellido).
 *     responses:
 *       200:
 *         description: Resultado de la validación.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isValid:
 *                   type: boolean
 */
app.get('/api/validate-name', async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });

    try {
        const nameUpper = name.toUpperCase().trim();
        const nameDoc = await db.collection('valid_names').doc(nameUpper).get();
        if (nameDoc.exists) {
            return res.json({ isValid: true });
        }
        const chileanNames = require('./data/chilean_names.json');
        const isValidInJson = chileanNames.includes(nameUpper);
        res.json({ isValid: isValidInJson });
    } catch (error) {
        console.error('Error validando nombre:', error);
        res.status(500).json({ error: 'Error al validar nombre' });
    }
});

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Registra un nuevo pedido
 *     description: Recibe los datos del pedido (individual o grupal), cifra la información sensible y la guarda en la base de datos. Dispara el envío de correo y notificación push.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - requesterInfo
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [PERSONAL_ORDER, GROUP_ORDER]
 *               personalInfo:
 *                 type: object
 *               groupInfo:
 *                 type: object
 *               estudiantes:
 *                 type: array
 *                 items:
 *                   type: object
 *               disenos:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Pedido procesado y guardado correctamente.
 *       500:
 *         description: Error interno del servidor.
 */
app.post('/api/orders', async (req, res) => {
    try {
        const orderData = req.body;
        
        // 1. Cifrado
        if (orderData.personalInfo && !orderData.isEncrypted) {
            orderData.personalInfo.nombre = encrypt(orderData.personalInfo.nombre);
            orderData.personalInfo.apellido = encrypt(orderData.personalInfo.apellido);
            if (orderData.personalInfo.rut) orderData.personalInfo.rut = encrypt(orderData.personalInfo.rut);
            if (orderData.personalInfo.apodo) orderData.personalInfo.apodo = encrypt(orderData.personalInfo.apodo);
        }

        if (orderData.requesterInfo) {
            orderData.requesterInfo.nombre = encrypt(orderData.requesterInfo.nombre);
            orderData.requesterInfo.apellido = encrypt(orderData.requesterInfo.apellido || '');
            orderData.requesterInfo.email = encrypt(orderData.requesterInfo.email);
            orderData.requesterInfo.telefono = encrypt(orderData.requesterInfo.telefono);
        }

        if (orderData.estudiantes && Array.isArray(orderData.estudiantes)) {
            orderData.estudiantes = orderData.estudiantes.map(s => ({
                ...s,
                nombre: encrypt(s.nombre),
                apellido: encrypt(s.apellido),
                apodo: s.apodo ? encrypt(s.apodo) : ''
            }));
        }

        if (orderData.disenos && Array.isArray(orderData.disenos)) {
            orderData.disenos = orderData.disenos.map(f => ({
                ...f,
                base64: encrypt(f.base64)
            }));
        }

        orderData.isEncrypted = true;

        // 2. Descifrado temporal para correo
        const decryptedOrderData = JSON.parse(JSON.stringify(orderData));
        if (decryptedOrderData.requesterInfo) {
            decryptedOrderData.requesterInfo.nombre = decrypt(decryptedOrderData.requesterInfo.nombre);
            decryptedOrderData.requesterInfo.apellido = decrypt(decryptedOrderData.requesterInfo.apellido);
            decryptedOrderData.requesterInfo.email = decrypt(decryptedOrderData.requesterInfo.email);
            decryptedOrderData.requesterInfo.telefono = decrypt(decryptedOrderData.requesterInfo.telefono);
        }
        if (decryptedOrderData.estudiantes) {
            decryptedOrderData.estudiantes = decryptedOrderData.estudiantes.map(s => ({
                ...s,
                nombre: decrypt(s.nombre),
                apellido: decrypt(s.apellido),
                apodo: s.apodo ? decrypt(s.apodo) : ''
            }));
        }
        if (decryptedOrderData.disenos) {
            decryptedOrderData.disenos = decryptedOrderData.disenos.map(f => ({
                ...f,
                base64: decrypt(f.base64)
            }));
        }

        // 3. Optimización Firestore
        const firestoreData = JSON.parse(JSON.stringify(orderData));
        if (firestoreData.disenos) {
            firestoreData.disenos = firestoreData.disenos.map(f => ({ ...f, base64: "[CONTENIDO_PESADO_EN_CORREO]" }));
        }
        if (firestoreData.disenoBase64) firestoreData.disenoBase64 = "[CONTENIDO_PESADO_EN_CORREO]";

        const docRef = await db.collection('orders').add({
            ...firestoreData,
            date: new Date().toISOString()
        });

        // 4. Envío de Correo
        let emailResult = { success: true };
        try {
            await sendOrderEmail(decryptedOrderData);
        } catch (emailError) {
            console.error('❌ ERROR CRÍTICO ENVIANDO EMAIL:', emailError);
            emailResult = { success: false, error: emailError.message || 'Error desconocido' };
        }

        // 5. Notificación Push
        try {
            const adminConfig = await db.collection('config').doc('admin').get();
            if (adminConfig.exists) {
                const { pushToken } = adminConfig.data();
                if (pushToken) {
                    const requesterName = decryptedOrderData.requesterInfo 
                        ? `${decryptedOrderData.requesterInfo.nombre} ${decryptedOrderData.requesterInfo.apellido}`
                        : (decryptedOrderData.personalInfo ? decryptedOrderData.personalInfo.nombre : 'Alguien');
                    const courseName = orderData.groupInfo?.curso || orderData.personalInfo?.curso || 'N/A';

                    await axios.post('https://exp.host/--/api/v2/push/send', {
                        to: pushToken,
                        title: '📥 ¡Nuevo Pedido Recibido!',
                        body: `Nuevo pedido de ${requesterName} para el curso ${courseName}.`,
                        sound: 'default',
                        priority: 'high',
                        data: { type: 'NEW_ORDER', orderId: docRef.id }
                    });
                }
            }
        } catch (pushError) {
            console.error('Error enviando notificación push:', pushError.message);
        }

        res.json({ success: true, id: docRef.id, emailStatus: emailResult });
    } catch (error) {
        console.error('Error al guardar pedido:', error);
        res.status(500).json({ error: 'No se pudo procesar el pedido' });
    }
});

/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     summary: Recupera todos los pedidos (Vista Admin)
 *     description: Retorna la lista completa de pedidos registrados, descifrando automáticamente la información sensible para el uso administrativo.
 *     responses:
 *       200:
 *         description: Lista de pedidos detallada y descifrada.
 */
app.get('/api/admin/orders', async (req, res) => {
    try {
        const snapshot = await db.collection('orders').orderBy('date', 'desc').get();
        const orders = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const order = { id: doc.id, ...data };
            if (data.isEncrypted) {
                if (order.personalInfo) {
                    order.personalInfo.nombre = decrypt(order.personalInfo.nombre);
                    order.personalInfo.apellido = decrypt(order.personalInfo.apellido);
                }
                if (order.requesterInfo) {
                    order.requesterInfo.nombre = decrypt(order.requesterInfo.nombre);
                    order.requesterInfo.apellido = decrypt(order.requesterInfo.apellido);
                    order.requesterInfo.email = decrypt(order.requesterInfo.email);
                    order.requesterInfo.telefono = decrypt(order.requesterInfo.telefono);
                }
                if (order.estudiantes) {
                    order.estudiantes = order.estudiantes.map(s => ({
                        ...s,
                        nombre: decrypt(s.nombre),
                        apellido: decrypt(s.apellido),
                        apodo: s.apodo ? decrypt(s.apodo) : ''
                    }));
                }
            }
            orders.push(order);
        });
        res.json(orders);
    } catch (error) {
        console.error('Error obteniendo pedidos admin:', error);
        res.status(500).json({ error: 'No se pudieron recuperar los pedidos' });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const snapshot = await db.collection('products').get();
        const products = [];
        snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        if (products.length === 0) {
            return res.json([{ id: 'poleron-base', nombre: 'Polerón Generación 2026', precioTotal: 45000 }]);
        }
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en puerto ${PORT}`);
});
