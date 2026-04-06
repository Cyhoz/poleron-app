import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAZ7hImCIN6jXdxYDrjN2Bnh5C4GTM83Dg",
  authDomain: "app-polerones.firebaseapp.com",
  projectId: "app-polerones",
  storageBucket: "app-polerones.firebasestorage.app",
  messagingSenderId: "875580801",
  appId: "1:875580801:web:f1d12c8c72058926a6ac80"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Probando conexión a Firestore...");

addDoc(collection(db, "test-connection"), { status: "conectado", date: new Date().toISOString() })
  .then((ref) => {
    console.log("ÉXITO: Conexión establecida. Documento creado con ID:", ref.id);
  })
  .catch((e) => {
    console.error("ERROR CRÍTICO FIREBASE:", e);
  })
  .finally(() => {
    process.exit(0);
  });
