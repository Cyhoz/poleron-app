const { db } = require('../firebase');
const sampleSchools = require('../data/sample_schools.json');

/**
 * Función para cargar datos de muestra en Firestore
 */
async function seedDatabase() {
    console.log('Iniciando carga de datos de muestra...');
    
    const batch = db.batch();
    
    sampleSchools.forEach(school => {
        // Usamos el RBD como ID del documento para evitar duplicados
        const schoolRef = db.collection('schools').doc(school.rbd.toString());
        batch.set(schoolRef, school);
    });

    try {
        await batch.commit();
        console.log('✅ Carga de datos de muestra completada con éxito.');
    } catch (error) {
        console.error('❌ Error al cargar datos:', error);
    } finally {
        process.exit();
    }
}

seedDatabase();
