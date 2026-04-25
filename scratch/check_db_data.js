const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAZ7hImCIN6jXdxYDrjN2Bnh5C4GTM83Dg",
  authDomain: "app-polerones.firebaseapp.com",
  projectId: "app-polerones",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkData() {
  console.log("Consultando últimos resultados de calculadora...");
  try {
    const q = query(collection(db, "calculator_results"), limit(5));
    const snap = await getDocs(q);
    console.log(`Documentos encontrados: ${snap.size}`);
    snap.forEach(doc => {
      console.log("- ", doc.id, doc.data());
    });
  } catch (e) {
    console.error("Error leyendo datos:", e.message);
  }
  process.exit(0);
}

checkData();
