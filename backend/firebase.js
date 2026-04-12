const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Inicialización de Firebase Admin SDK
let db;

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
const fs = require('fs');
const path = require('path');

// 1. Intentar cargar por archivo físico
if (fs.existsSync(path.resolve(__dirname, serviceAccountPath))) {
    const serviceAccount = require(path.resolve(__dirname, serviceAccountPath));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('✅ Conectado a Firebase mediante archivo JSON');
} 
// 2. Intentar cargar por variables de entorno individuales
else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, ''),
        })
    });
    db = admin.firestore();
    console.log('✅ Conectado a Firebase mediante Variables de Entorno');
}
// 3. Fallback a Mock Database si no hay nada
else {
    console.log('⚠️ No se encontraron credenciales. Usando MOCK DATABASE para demostración.');
    
    // Simulación de Firestore para que la API funcione sin cuenta real
    const sampleSchools = require('./data/sample_schools.json');
    db = {
        collection: (name) => ({
            doc: (id) => ({
                get: async () => ({
                    exists: sampleSchools.some(s => s.rbd.toString() === id),
                    data: () => sampleSchools.find(s => s.rbd.toString() === id),
                    id: id
                }),
                set: async (data) => { console.log(`Mock DB: Guardado ${id}`); return true; }
            }),
            where: (field, op, value) => db.collection(name), 
            limit: (num) => ({
                get: async () => {
                    const docs = sampleSchools.slice(0, num).map(s => ({
                        id: s.rbd.toString(),
                        data: () => s
                    }));
                    return { forEach: (cb) => docs.forEach(cb) };
                }
            })
        }),
        batch: () => ({
            set: () => {},
            commit: async () => { console.log('Mock Batch Commit'); }
        })
    };
}

module.exports = { admin, db };
