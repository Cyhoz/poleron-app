const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { db } = require('./firebase');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; // Render usa el puerto 10000 por defecto

app.use(cors());
app.use(express.json());

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
        const { comuna, region, query, limit = 50 } = req.query;
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
 * Valida si un nombre existe en la base de datos de nombres reales de Chile
 */
app.get('/api/validate-name', (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });

    const chileanNames = require('./data/chilean_names.json');
    const isValid = chileanNames.includes(name.toUpperCase().trim());
    res.json({ isValid });
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
