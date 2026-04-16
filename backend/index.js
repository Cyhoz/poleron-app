require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { db } = require('./firebase');
const { encrypt, decrypt } = require('./utils/encryption');
const axios = require('axios');
const { sendOrderEmail } = require('./utils/emailService');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const fs = require('fs');

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
    apis: ['./index.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.set('trust proxy', 1);
const PORT = process.env.PORT || 10000;

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
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

/**
 * @swagger
 * /api/validate-name:
 *   get:
 *     summary: Valida un nombre de identidad contra el diccionario global
 *     description: Verifica si un nombre completo está compuesto por nombres y apellidos reales comunes en Chile.
 */
app.get('/api/validate-name', async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });

    try {
        const fullUpper = name.toUpperCase().trim();
        const parts = fullUpper.split(/\s+/);
        
        if (parts.length < 2) return res.json({ isValid: false, reason: 'Se requiere nombre y apellido' });

        // 1. Verificación en valid_names (Autorización específica de la administración)
        const nameDoc = await db.collection('valid_names').doc(fullUpper).get();
        if (nameDoc.exists) {
            return res.json({ isValid: true, source: 'AUTHORIZED_LIST' });
        }

        // 2. Verificación en Diccionario Global (Firestore)
        // Buscamos si las partes coinciden con nombres y apellidos comunes
        const checks = await Promise.all(parts.map(async (p) => {
            const [nameDoc, surnameDoc] = await Promise.all([
                db.collection('common_names').doc(p).get(),
                db.collection('common_surnames').doc(p).get()
            ]);
            return {
                isName: nameDoc.exists,
                isSurname: surnameDoc.exists
            };
        }));

        const hasValidName = checks.some(c => c.isName);
        const hasValidSurname = checks.some(c => c.isSurname);

        if (hasValidName && hasValidSurname) {
            return res.json({ isValid: true, source: 'GLOBAL_DICTIONARY' });
        }

        res.json({ isValid: false, reason: 'Nombre no reconocido en la base de datos oficial' });
    } catch (error) {
        res.status(500).json({ error: 'Error al validar nombre' });
    }
});

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Registra un nuevo pedido
 *     description: Recibe los datos del pedido, cifra la información y la guarda. Envía correo y notificación push.
 */
app.post('/api/orders', async (req, res) => {
    try {
        const orderData = req.body;
        
        // 1. Cifrado
        if (orderData.personalInfo && !orderData.isEncrypted) {
            orderData.personalInfo.nombre = encrypt(orderData.personalInfo.nombre);
            orderData.personalInfo.apellido = encrypt(orderData.personalInfo.apellido);
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

        // 3. Guardado en Firestore (sin base64 pesado)
        const firestoreData = JSON.parse(JSON.stringify(orderData));
        if (firestoreData.disenos) {
            firestoreData.disenos = firestoreData.disenos.map(f => ({ ...f, base64: "[CONTENIDO_PESADO]" }));
        }

        const docRef = await db.collection('orders').add({
            ...firestoreData,
            date: new Date().toISOString()
        });

        // 4. Envío de Correo
        try {
            await sendOrderEmail(decryptedOrderData);
        } catch (emailError) {
            console.error('❌ ERROR ENVIANDO EMAIL:', emailError.message);
        }

        // 5. Notificación Push
        try {
            const adminConfig = await db.collection('config').doc('admin').get();
            if (adminConfig.exists) {
                const { pushToken } = adminConfig.data();
                if (pushToken) {
                    const requesterName = decryptedOrderData.requesterInfo 
                        ? `${decryptedOrderData.requesterInfo.nombre} ${decryptedOrderData.requesterInfo.apellido}`
                        : 'Alguien';
                    await axios.post('https://exp.host/--/api/v2/push/send', {
                        to: pushToken,
                        title: '📥 ¡Nuevo Pedido!',
                        body: `Pedido de ${requesterName}.`,
                        sound: 'default'
                    });
                }
            }
        } catch (pushError) {
            console.error('Error enviando push:', pushError.message);
        }

        res.json({ success: true, id: docRef.id });
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
 */
app.get('/api/admin/orders', async (req, res) => {
    try {
        const snapshot = await db.collection('orders').orderBy('date', 'desc').get();
        const orders = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const order = { id: doc.id, ...data };
            if (data.isEncrypted && order.estudiantes) {
                order.estudiantes = order.estudiantes.map(s => ({
                    ...s,
                    nombre: decrypt(s.nombre),
                    apellido: decrypt(s.apellido),
                    apodo: s.apodo ? decrypt(s.apodo) : ''
                }));
            }
            orders.push(order);
        });
        res.json(orders);
    } catch (error) {
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
