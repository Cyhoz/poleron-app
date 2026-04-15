const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { db } = require('./firebase');
const { encrypt, decrypt } = require('./utils/encryption');
const axios = require('axios');
const { sendOrderEmail } = require('./utils/emailService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; // Render usa el puerto 10000 por defecto

app.use(helmet()); // Seguridad de headers HTTP
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Aumentamos el límite para permitir múltiples archivos adjuntos

// Limitador de peticiones para evitar fuerza bruta y DoS
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Máximo 100 peticiones por ventana desde una IP
    message: { error: 'Demasiadas peticiones, por favor intenta más tarde.' }
});

app.use('/api/', limiter);

// Endpoint para verificar salud del server
app.get('/', (req, res) => {
    res.send('Backend Poleron API - Funcionando');
});

/**
 * GET /api/schools
 * Obtiene lista de colegios con filtros opcionales
 * query params: comuna, region, query (búsqueda por nombre)
 */
app.get('/api/schools', async (req, res) => {
    try {
        let { comuna, region, query, limit = 50 } = req.query;
        
        // Sanitización de parámetros de búsqueda (Prevenir Inyecciones NoSQL)
        comuna = typeof comuna === 'string' ? comuna.trim() : null;
        region = typeof region === 'string' ? region.trim() : null;
        query = typeof query === 'string' ? query.trim() : null;

        let schoolsRef = db.collection('schools');
        
        // Aplicar filtros básicos si existen
        if (region) {
            schoolsRef = schoolsRef.where('region', '==', region.toUpperCase());
        }
        if (comuna) {
            schoolsRef = schoolsRef.where('comuna', '==', comuna.toUpperCase());
        }

        const snapshot = await schoolsRef.limit(parseInt(limit)).get();
        let schools = [];
        
        snapshot.forEach(doc => {
            schools.push({ id: doc.id, ...doc.data() });
        });

        // Filtrado por texto (búsqueda por nombre) simple en el servidor si se requiere
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
 * GET /api/schools/:rbd
 * Obtiene un colegio específico por su RBD
 */
app.get('/api/schools/:id', async (req, res) => {
    try {
        const schoolDoc = await db.collection('schools').doc(req.params.id).get();
        if (!schoolDoc.exists) {
            return res.status(404).json({ error: 'Colegio no encontrado' });
        }
        res.json({ id: schoolDoc.id, ...schoolDoc.data() });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el colegio' });
    }
});

/**
 * GET /api/validate-name
 * Valida si un nombre existe en la base de datos de nombres reales de Chile en Firestore
 */
app.get('/api/validate-name', async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });

    try {
        const nameUpper = name.toUpperCase().trim();
        
        // 1. Primero intentar buscar en la colección de Firestore (nombres añadidos por admin)
        const nameDoc = await db.collection('valid_names').doc(nameUpper).get();
        if (nameDoc.exists) {
            return res.json({ isValid: true });
        }

        // 2. Si no está en Firestore, opcionalmente podrías seguir usando el JSON de respaldo 
        // para nombres comunes para no sobrecargar la DB con nombres básicos.
        const chileanNames = require('./data/chilean_names.json');
        const isValidInJson = chileanNames.includes(nameUpper);
        
        res.json({ isValid: isValidInJson });
    } catch (error) {
        console.error('Error validando nombre:', error);
        res.status(500).json({ error: 'Error al validar nombre' });
    }
});

/**
 * POST /api/orders
 * Guarda un pedido cifrando los datos sensibles (PII)
 */
app.post('/api/orders', async (req, res) => {
    try {
        const orderData = req.body;
        
        // 1. Cifrado de datos PII (Personally Identifiable Information)
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

        // NOTA: Para el envío de correo y notificación, necesitamos descifrar temporalmente
        const decryptedOrderData = JSON.parse(JSON.stringify(orderData));
        if (decryptedOrderData.requesterInfo) {
            decryptedOrderData.requesterInfo.nombre = decrypt(decryptedOrderData.requesterInfo.nombre);
            decryptedOrderData.requesterInfo.apellido = decrypt(decryptedOrderData.requesterInfo.apellido);
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

        // --- OPTIMIZACIÓN FIRESTORE (Límite 1MB) ---
        // Creamos una copia para guardar en BD que NO tenga el base64 pesado
        const firestoreData = JSON.parse(JSON.stringify(orderData));
        if (firestoreData.disenos) {
            firestoreData.disenos = firestoreData.disenos.map(f => ({
                ...f,
                base64: "[CONTENIDO_PESADO_EN_CORREO]" // No guardamos el binario en Firestore para no bloquear el sistema
            }));
        }
        if (firestoreData.disenoBase64) {
            firestoreData.disenoBase64 = "[CONTENIDO_PESADO_EN_CORREO]";
        }

        const docRef = await db.collection('orders').add({
            ...firestoreData,
            date: new Date().toISOString()
        });

        // --- ENVIAR CORREO CON EXCEL (Usamos los datos completos) ---
        try {
            await sendOrderEmail(decryptedOrderData);
        } catch (emailError) {
            console.error('Error enviando email con Excel:', emailError.message);
        }

        // --- NOTIFICACIÓN PUSH ---
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
                        channelId: 'default',
                        data: { type: 'NEW_ORDER', orderId: docRef.id }
                    });
                }
            }
        } catch (pushError) {
            console.error('Error enviando notificación push:', pushError.message);
        }

        res.json({ success: true, id: docRef.id });
    } catch (error) {
        console.error('Error al guardar pedido:', error);
        res.status(500).json({ error: 'No se pudo procesar el pedido' });
    }
});

/**
 * GET /api/admin/orders
 * Obtiene todos los pedidos, descifrando los campos automágicamente.
 * Requiere una capa de seguridad adicional (ej: validación de token de admin)
 */
app.get('/api/admin/orders', async (req, res) => {
    try {
        // En producción, aquí validaríamos un Header de autorización (Bearer Token)
        const snapshot = await db.collection('orders').orderBy('date', 'desc').get();
        const orders = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const order = { id: doc.id, ...data };

            if (data.isEncrypted) {
                if (order.personalInfo) {
                    order.personalInfo.nombre = decrypt(order.personalInfo.nombre);
                    order.personalInfo.apellido = decrypt(order.personalInfo.apellido);
                    if (order.personalInfo.rut) order.personalInfo.rut = decrypt(order.personalInfo.rut);
                    if (order.personalInfo.apodo) order.personalInfo.apodo = decrypt(order.personalInfo.apodo);
                }
                if (order.requesterInfo) {
                    order.requesterInfo.nombre = decrypt(order.requesterInfo.nombre);
                    order.requesterInfo.apellido = decrypt(order.requesterInfo.apellido);
                    order.requesterInfo.email = decrypt(order.requesterInfo.email);
                    order.requesterInfo.telefono = decrypt(order.requesterInfo.telefono);
                }
                if (order.estudiantes && Array.isArray(order.estudiantes)) {
                    order.estudiantes = order.estudiantes.map(s => ({
                        ...s,
                        nombre: decrypt(s.nombre),
                        apellido: decrypt(s.apellido),
                        apodo: s.apodo ? decrypt(s.apodo) : ''
                    }));
                }
                if (order.disenos && Array.isArray(order.disenos)) {
                    order.disenos = order.disenos.map(f => ({
                        ...f,
                        base64: decrypt(f.base64)
                    }));
                }
            }
            orders.push(order);
        });

        res.json(orders);
    } catch (error) {
        console.error('Error al obtener pedidos para admin:', error);
        res.status(500).json({ error: 'No se pudieron recuperar los pedidos' });
    }
});

/**
 * GET /api/products
 * Obtiene el catálogo de productos (ej: Polerón Base, Polerón Premium)
 */
app.get('/api/products', async (req, res) => {
    try {
        const snapshot = await db.collection('products').get();
        const products = [];
        snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        
        // Si no hay productos, devolvemos uno base
        if (products.length === 0) {
            return res.json([{
                id: 'poleron-base',
                nombre: 'Polerón Generación 2026',
                precioTotal: 45000,
                montoReserva: 15000,
                descripcion: 'Polerón de algodón premium con bordado personalizado.'
            }]);
        }
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});


app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
