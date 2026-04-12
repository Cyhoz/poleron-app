import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAZ7hImCIN6jXdxYDrjN2Bnh5C4GTM83Dg",
  authDomain: "app-polerones.firebaseapp.com",
  databaseURL: "https://app-polerones-default-rtdb.firebaseio.com",
  projectId: "app-polerones",
  storageBucket: "app-polerones.firebasestorage.app",
  messagingSenderId: "875580801",
  appId: "1:875580801:web:f1d12c8c72058926a6ac80",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
