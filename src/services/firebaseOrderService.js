import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, query } from 'firebase/firestore';
import { db } from './firebaseConfig';

export const saveOrder = async (orderData) => {
  try {
    const docRef = await addDoc(collection(db, "orders"), {
      ...orderData,
      date: new Date().toISOString()
    });
    
    // Notify admin via push notification automatically if token exists
    try {
      const adminDoc = await getDoc(doc(db, "config", "admin"));
      if (adminDoc.exists()) {
        const { pushToken } = adminDoc.data();
        if (pushToken) {
           await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: pushToken,
                sound: 'default',
                title: '🛒 ¡Nuevo Polerón Pedido!',
                body: `${orderData.personalInfo.nombre} de ${orderData.personalInfo.curso} ordenó talla ${orderData.tallaElegida}.`,
                data: { orderId: docRef.id },
              }),
            });
        }
      }
    } catch (e) {
      console.log('Error enviando notificación Push', e);
    }

    return true;
  } catch (error) {
    console.error("Error guardando pedido en Firebase: ", error); // Note: might fail if Firestore Database wasn't created yet or Rules block it
    return false;
  }
};

export const getOrders = async () => {
  try {
    const q = query(collection(db, "orders"));
    const querySnapshot = await getDocs(q);
    const orders = [];
    querySnapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    // Sort in memory locally to avoid composite index requirements on Firestore
    orders.sort((a,b) => new Date(b.date) - new Date(a.date));
    return orders;
  } catch (error) {
    console.error("Error leyendo pedidos desde Firebase: ", error);
    return [];
  }
};

export const deleteOrder = async (id) => {
  try {
    await deleteDoc(doc(db, "orders", id));
    return true;
  } catch (error) {
    console.error("Error borrando pedido", error);
    return false;
  }
};

export const saveAdminSizes = async (sizes) => {
  try {
    await setDoc(doc(db, "config", "sizes"), sizes);
    return true;
  } catch (error) {
    console.error("Error guardando configuraciones", error);
    return false;
  }
};

export const getAdminSizes = async () => {
  try {
    const docSnap = await getDoc(doc(db, "config", "sizes"));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.warn("No sizes configuration found in cloud");
    return null;
  }
};

export const saveAdminPushToken = async (token) => {
  try {
    await setDoc(doc(db, "config", "admin"), { pushToken: token }, { merge: true });
    return true;
  } catch (error) {
    console.error("Error saving admin push token", error);
    return false;
  }
};
