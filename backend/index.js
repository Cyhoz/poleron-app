const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { db } = require('./firebase');
const { encrypt, decrypt } = require('./utils/encryption');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; // Render usa el puerto 10000 por defecto

app.use(helmet()); // Seguridad de headers HTTP
app.use(cors());
app.use(express.json());

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
        
        if (!orderData.personalInfo) {
            return res.status(400).json({ error: 'Datos de pedido incompletos' });
        }

        // Cifrado de datos sensibles antes de guardar en Firestore
        const secureInfo = {
            ...orderData.personalInfo,
            nombre: encrypt(orderData.personalInfo.nombre),
            apellido: encrypt(orderData.personalInfo.apellido),
            rut: encrypt(orderData.personalInfo.rut),
            apodo: encrypt(orderData.personalInfo.apodo)
        };

        const docRef = await db.collection('orders').add({
            ...orderData,
            personalInfo: secureInfo,
            isEncrypted: true, 
            date: new Date().toISOString()
        });

        // --- NOTIFICACIÓN PUSH ESTILO WHATSAPP PARA EL ADMIN ---
        try {
            const adminConfig = await db.collection('config').doc('admin').get();
            if (adminConfig.exists) {
                const { pushToken } = adminConfig.data();
                if (pushToken) {
                    await axios.post('https://exp.host/--/api/v2/push/send', {
                        to: pushToken,
                        title: '📥 ¡Nuevo Pedido Recibido!',
                        body: `Tienes un nuevo pedido de ${orderData.personalInfo.nombre} para el curso ${orderData.personalInfo.curso}.`,
                        sound: 'default',
                        priority: 'high', // Asegura que aparezca de inmediato
                        channelId: 'default', // Para Android
                        data: { type: 'NEW_ORDER', orderId: docRef.id }
                    });
                }
            }
        } catch (pushError) {
            console.error('Error enviando notificación push:', pushError.message);
            // No detenemos la respuesta del pedido si falla la notificación
        }

        res.json({ success: true, id: docRef.id });
    } catch (error) {
        console.error('Error al guardar pedido cifrado:', error);
        res.status(500).json({ error: 'No se pudo procesar el pedido de forma segura' });
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
            if (data.isEncrypted && data.personalInfo) {
                // Descifrar campos para el administrador
                data.personalInfo.nombre = decrypt(data.personalInfo.nombre);
                data.personalInfo.apellido = decrypt(data.personalInfo.apellido);
                data.personalInfo.rut = decrypt(data.personalInfo.rut);
                data.personalInfo.apodo = decrypt(data.personalInfo.apodo);
            }
            orders.push({ id: doc.id, ...data });
        });

        res.json(orders);
    } catch (error) {
        console.error('Error al obtener pedidos para admin:', error);
        res.status(500).json({ error: 'No se pudieron recuperar los pedidos' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
