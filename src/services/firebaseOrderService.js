import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';

export const saveOrder = async (orderData) => {
  try {
    // Definir la URL de tu API en Render (igual que en ClientScreen)
    const API_BASE_URL = 'https://poleron-app-2.onrender.com';
    
    // Enviamos el pedido al backend para que sea cifrado y guardado de forma segura
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) throw new Error('Error en servidor seguro');
    const result = await response.json();

    // Notificación Push para el administrador (opcional, se puede dejar en el backend también)
    // Para mayor seguridad, el backend debería encargarse de las notificaciones
    
    return true;
  } catch (error) {
    console.error("Error guardando pedido de forma cifrada: ", error);
    return false;
  }
};

export const checkExistingOrder = async (nombre, apellido, curso) => {
  try {
    const q = query(
      collection(db, "orders"),
      where("personalInfo.nombre", "==", nombre),
      where("personalInfo.apellido", "==", apellido),
      where("personalInfo.curso", "==", curso)
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error verificando pedidos existentes: ", error);
    return false;
  }
};

export const subscribeToOrders = (callback) => {
  const q = query(collection(db, "orders"));
  return onSnapshot(q, (querySnapshot) => {
    const orders = [];
    querySnapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    // Sort in memory locally to avoid composite index requirements on Firestore
    orders.sort((a,b) => new Date(b.date) - new Date(a.date));
    callback(orders);
  }, (error) => {
    console.error("Error subscribiendo a Firebase en tiempo real: ", error);
  });
};

export const getOrders = async () => {
  try {
    const API_BASE_URL = 'https://poleron-app-2.onrender.com';
    const response = await fetch(`${API_BASE_URL}/api/admin/orders`);
    if (!response.ok) throw new Error('Error al recuperar pedidos seguros');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error leyendo pedidos descifrados: ", error);
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

export const saveAppData = async (data) => {
  try {
    await setDoc(doc(db, "config", "appData"), data);
    return true;
  } catch (error) {
    console.error("Error saving app data", error);
    return false;
  }
};

export const getAppData = async () => {
  try {
    const docSnap = await getDoc(doc(db, "config", "appData"));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching app data", error);
    return null;
  }
};

export const subscribeToAppData = (callback) => {
  return onSnapshot(doc(db, "config", "appData"), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    } else {
      callback(null);
    }
  });
};

// --- Manejo de Nombres Autorizados ---

export const saveValidName = async (name) => {
  try {
    const nameUpper = name.toUpperCase().trim();
    await setDoc(doc(db, "valid_names", nameUpper), { addedAt: new Date().toISOString() });
    return true;
  } catch (error) {
    console.error("Error guardando nombre válido", error);
    return false;
  }
};

export const deleteValidName = async (name) => {
  try {
    await deleteDoc(doc(db, "valid_names", name.toUpperCase().trim()));
    return true;
  } catch (error) {
    console.error("Error borrando nombre válido", error);
    return false;
  }
};

export const subscribeToValidNames = (callback) => {
  const q = query(collection(db, "valid_names"));
  return onSnapshot(q, (snapshot) => {
    const names = [];
    snapshot.forEach((doc) => {
      names.push(doc.id); // El ID es el nombre en mayúsculas
    });
    callback(names.sort());
  });
};
