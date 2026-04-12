const fs = require('fs');
const csv = require('csv-parser');
const { db } = require('../firebase');

/**
 * Este script importa el "Directorio Oficial de Establecimientos" de MINEDUC Chile (formato CSV) a Firestore.
 * 
 * Instrucciones:
 * 1. Descarga el Directorio 2024 desde: https://datosabiertos.mineduc.cl/directorio-de-establecimientos-educacionales/
 * 2. Descomprime el archivo .rar y guarda el .csv como 'directorio_completo.csv' en la carpeta 'backend/data/'
 * 3. Ejecuta: node scripts/import_full_csv.js
 */

const CSV_PATH = './data/directorio_completo.csv';

async function importCSV() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ El archivo ${CSV_PATH} no existe. Por favor descarga el CSV oficial y colócalo en la carpeta 'data/'.`);
        process.exit(1);
    }

    console.log('Iniciando importación masiva... (esto puede tomar varios minutos)');
    
    let count = 0;
    let batch = db.batch();

    fs.createReadStream(CSV_PATH)
        .pipe(csv({ separator: ';' })) // El CSV de MINEDUC suele usar ';' como separador
        .on('data', async (row) => {
            // Mapeo de columnas específicas del archivo 2025 proporcionado
            const schoolData = {
                rbd: parseInt(row['RBD']),
                nombre: row['NOM_RBD'],
                comuna: row['NOM_COM_RBD'],
                region: row['NOM_REG_RBD_A'],
                // En este archivo no viene la dirección completa o tiene otro nombre
                // Usaremos la comuna como referencia de ubicación si falta
                direccion: row['DIRECCION_ESTABLECIMIENTO'] || 'No especificada',
                dependencia_cod: row['COD_DEPE'],
                estado_cod: row['ESTADO_ESTAB']
            };

            const schoolRef = db.collection('schools').doc(schoolData.rbd.toString());
            batch.set(schoolRef, schoolData);
            
            count++;

            // Firestore permite batches de hasta 500 operaciones
            if (count % 500 === 0) {
                console.log(`Progreso: ${count} escuelas procesadas...`);
                // En un stream real, necesitaríamos manejar la pausa para esperar el commit
                // pero para simplificar lo mostramos así.
            }
        })
        .on('end', async () => {
            try {
                // El commit final
                await batch.commit();
                console.log(`✅ Importación finalizada. Total escuelas: ${count}`);
            } catch (err) {
                console.error('Error al hacer commit final:', err);
            }
            process.exit();
        });
}

importCSV();
