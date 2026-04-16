const { db } = require('../firebase');

const NAMES = [
    // Hombres
    "MATEO", "LIAM", "LUCAS", "SANTIAGO", "BENJAMIN", "VICENTE", "AGUSTIN", "JOAQUIN", "MAXIMILIANO", "DIEGO",
    "NICOLAS", "JUAN", "JOSE", "SEBASTIAN", "FELIPE", "MATIAS", "GABRIEL", "TOMAS", "MARTIN", "RODRIGO",
    "FRANCISCO", "GONZALO", "ALEJANDRO", "EDUARDO", "RICARDO", "CLAUDIO", "MARIO", "LUIS", "CARLOS", "MANUEL",
    "JORGE", "PATRICIO", "CRISTIAN", "PEDRO", "RAUL", "SERGIO", "VICTOR", "HUGO", "OSCAR", "ALVARO",
    "IGNACIO", "EMILIO", "ANDRES", "RAFAEL", "PABLO", "GUSTAVO", "ESTEBAN", "JAVIER", "MAURICIO", "FERNANDO",
    "MARCELO", "HUGO", "RUBEN", "ALFREDO", "ALBERTO", "RAMON", "ALEX", "ERIC", "HECTOR", "GUILLERMO",
    "DANIEL", "ESTEBAN", "CRISTOBAL", "ORLANDO", "ALFONSO", "RENATO", "DAMIAN", "JULIAN", "ADRIAN", "ALONSO",
    // Mujeres
    "SOFIA", "EMMA", "EMILIA", "ISABELLA", "JULIETA", "AURORA", "MIA", "ISIDORA", "TRINIDAD", "AMANDA",
    "MARTINA", "JOSEFA", "FLORENCIA", "VALENTINA", "MARIA", "ANA", "CARMEN", "ROSA", "ELENA", "LAURA",
    "FRANCISCA", "CATALINA", "JAVIERA", "FERNANDA", "CONSTANZA", "CAMILA", "DANIELA", "NATALIA", "CLAUDIA", "ANDREA",
    "VERONICA", "PATRICIA", "SANDRA", "MONICA", "MARCELA", "SILVIA", "MARTA", "ELIZABETH", "ALEJANDRA", "GLORIA",
    "SARA", "LUCIA", "TERESA", "ALICIA", "SONIA", "OLGA", "PAULA", "DANIELA", "PILAR", "XIMENA", "VICTORIA",
    "CRISTINA", "IRENE", "BEATRIZ", "SUSANA", "LORETO", "CECILIA", "RUTH", "MIRIAM", "ADRIANA", "ESTHER",
    "ANTONIA", "MAITE", "AGUSTINA", "MAGDALENA", "PASCALE", "COLOMBA", "RENATA", "RAFAELA", "MONSERRAT", "MARISOL"
];

const SURNAMES = [
    "GONZALEZ", "MUÑOZ", "ROJAS", "DIAZ", "PEREZ", "SOTO", "CONTRERAS", "SILVA", "MARTINEZ", "SEPULVEDA",
    "MORALES", "RODRIGUEZ", "LOPEZ", "FUENTES", "HERNANDEZ", "TORRES", "ARAYA", "FLORES", "CASTILLO", "ESPINOZA",
    "VALENZUELA", "CASTRO", "REYES", "GUTIERREZ", "PIZARRO", "VASQUEZ", "TAPIA", "SANCHEZ", "VERA", "JARA",
    "CARRASCO", "GOMEZ", "LAGOS", "CORTES", "HERRERA", "NUÑEZ", "HENRIQUEZ", "SAAVEDRA", "ORELLANA", "POBLETE",
    "ARAVENA", "ARRIAGADA", "NAVARRETE", "AGUILERA", "CACERES", "VALDES", "CARDENAS", "CAMPOS", "PARRA", "OLIVARES",
    "ESPARZA", "BRAVO", "VERDUGO", "VARGAS", "PONCE", "ALVARADO", "MUNOZ", "OYARZUN", "ASTUDILLO", "SALAZAR",
    "RIVERA", "GALLARDO", "VILLAGRAN", "GUZMAN", "MOLINA", "SALINAS", "PACHECO", "VENEGAS", "ZAPATA", "VILLANUEVA",
    "GARRIDO", "ACEVEDO", "PINTO", "VILLALOBOS", "CANALES", "ESTRADA", "ESPINOSA", "MIRANDA", "MENDOZA", "PALMA",
    "GUAJARDO", "LEIVA", "CALDERON", "AGUIRRE", "FIGUEROA", "QUINTANA", "MARDONES", "BECERRA", "INOSTROZA", "PARADA"
];

async function seed() {
    console.log('--- Iniciando Carga de Diccionario de Nombres (Fix) ---');
    
    // El batch requiere una instancia real de Firestore
    // Si estamos en MOCK_DB, el batch simulado también funcionará.
    
    let batch = db.batch();
    let count = 0;

    console.log(`Cargando ${NAMES.length} nombres en 'common_names'...`);
    for (const name of NAMES) {
        const ref = db.collection('common_names').doc(name);
        batch.set(ref, { exists: true });
        count++;
        if (count === 400) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }
    await batch.commit();

    batch = db.batch();
    count = 0;
    console.log(`Cargando ${SURNAMES.length} apellidos en 'common_surnames'...`);
    for (const sn of SURNAMES) {
        const ref = db.collection('common_surnames').doc(sn);
        batch.set(ref, { exists: true });
        count++;
        if (count === 400) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }
    await batch.commit();

    console.log('✅ Diccionario global cargado con éxito.');
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Error cargando diccionario:', err);
    process.exit(1);
});
