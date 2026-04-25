const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAZ7hImCIN6jXdxYDrjN2Bnh5C4GTM83Dg",
  authDomain: "app-polerones.firebaseapp.com",
  projectId: "app-polerones",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mock normalizeName function from the app
const normalizeName = (name) => {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
};

async function runTest() {
  const TEST_SCHOOL = "Colegio de Prueba Antigravity " + Math.floor(Math.random() * 1000);
  const TEST_COURSE = "4to Medio Z";
  
  console.log(`--- INICIANDO TEST DE IMPORTACIÓN ---`);
  console.log(`Colegio Original: "${TEST_SCHOOL}"`);
  console.log(`Curso Original: "${TEST_COURSE}"`);

  try {
    // 1. Simular guardado con la NUEVA lógica (Normalizado)
    console.log("\n1. Guardando resultado con lógica normalizada...");
    const normalizedSchool = normalizeName(TEST_SCHOOL);
    const normalizedCourse = normalizeName(TEST_COURSE);
    
    const docRef = await addDoc(collection(db, "calculator_results"), {
      userName: "Estudiante de Prueba",
      school: normalizedSchool,
      course: normalizedCourse,
      size: "L",
      timestamp: new Date().toISOString()
    });
    console.log(`✅ Registro guardado con ID: ${docRef.id}`);
    console.log(`Datos en DB -> School: "${normalizedSchool}", Course: "${normalizedCourse}"`);

    // 2. Simular búsqueda del Manager (que puede tener los nombres en otro formato)
    console.log("\n2. Buscando desde el Manager (usando nombres en minúsculas y espacios extra)...");
    const managerSchoolInput = "  " + TEST_SCHOOL.toLowerCase() + "  ";
    const managerCourseInput = TEST_COURSE.toLowerCase();
    
    console.log(`Input del Manager: "${managerSchoolInput}" | "${managerCourseInput}"`);
    
    const q = query(
      collection(db, "calculator_results"),
      where("school", "==", normalizeName(managerSchoolInput)),
      where("course", "==", normalizeName(managerCourseInput))
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.size > 0) {
      console.log(`✅ ¡ÉXITO! Se encontraron ${querySnapshot.size} resultados usando la búsqueda normalizada.`);
      querySnapshot.forEach(d => {
        console.log(`   - Encontrado: ${d.data().userName} (Talla: ${d.data().size})`);
      });
    } else {
      console.error("❌ FALLO: No se encontraron resultados. La normalización no funcionó como se esperaba.");
    }

    // 3. Limpieza
    console.log("\n3. Limpiando datos de prueba...");
    await deleteDoc(doc(db, "calculator_results", docRef.id));
    console.log("✅ Datos eliminados.");

  } catch (error) {
    console.error("❌ ERROR DURANTE EL TEST:", error);
  } finally {
    console.log("\n--- TEST FINALIZADO ---");
    process.exit(0);
  }
}

runTest();
