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

    // Notificación Push para el administrador
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
                body: `${orderData.personalInfo.nombre} ${orderData.personalInfo.apellido || ''} de ${orderData.personalInfo.curso} ordenó talla ${orderData.tallaElegida}.`,
                data: { orderId: result.id || 'new' },
              }),
            });
        }
      }
    } catch (e) {
      console.log('Error enviando notificación Push desde el cliente:', e);
    }
    
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

export const getProducts = async () => {
    try {
        const API_BASE_URL = 'https://poleron-app-2.onrender.com';
        const response = await fetch(`${API_BASE_URL}/api/products`);
        return await response.json();
    } catch (error) {
        console.error("Error fetching products", error);
        return [];
    }
};


// --- Manejo de Nombres Autorizados ---

export const normalizeName = (name) => {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' '); // Unificar espacios extra
};

export const checkNameAuthorized = async (fullName) => {
  try {
    const API_BASE_URL = 'https://poleron-app-2.onrender.com';
    const response = await fetch(`${API_BASE_URL}/api/validate-name?name=${encodeURIComponent(fullName)}`);
    const data = await response.json();
    return data.isValid === true;
  } catch (error) {
    console.error("Error verificando autorización de nombre:", error);
    // Fallback: Si el servidor falla, permitimos (o podrías bloquear por seguridad)
    return true; 
  }
};


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

// --- Gestión de Diccionario Global (Nombres/Apellidos comunes) ---

export const saveCommonName = async (name) => {
  try {
    const nameUpper = name.toUpperCase().trim();
    await setDoc(doc(db, "common_names", nameUpper), { exists: true });
    return true;
  } catch (error) {
    console.error("Error guardando nombre común", error);
    return false;
  }
};

export const deleteCommonName = async (name) => {
  try {
    await deleteDoc(doc(db, "common_names", name.toUpperCase().trim()));
    return true;
  } catch (error) {
    console.error("Error borrando nombre común", error);
    return false;
  }
};

export const subscribeToCommonNames = (callback) => {
  const q = query(collection(db, "common_names"));
  return onSnapshot(q, (snapshot) => {
    const names = [];
    snapshot.forEach((doc) => {
      names.push(doc.id);
    });
    callback(names.sort());
  });
};

export const saveCommonSurname = async (surname) => {
  try {
    const snUpper = surname.toUpperCase().trim();
    await setDoc(doc(db, "common_surnames", snUpper), { exists: true });
    return true;
  } catch (error) {
    console.error("Error guardando apellido común", error);
    return false;
  }
};

export const deleteCommonSurname = async (surname) => {
  try {
    await deleteDoc(doc(db, "common_surnames", surname.toUpperCase().trim()));
    return true;
  } catch (error) {
    console.error("Error borrando apellido común", error);
    return false;
  }
};

export const subscribeToCommonSurnames = (callback) => {
  const q = query(collection(db, "common_surnames"));
  return onSnapshot(q, (snapshot) => {
    const sn = [];
    snapshot.forEach((doc) => {
      sn.push(doc.id);
    });
    callback(sn.sort());
  });
};

// --- Manejo de Perfiles y Roles ---

export const getUserProfile = async (uid) => {
  try {
    const docSnap = await getDoc(doc(db, "users", uid));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error("Error obteniendo perfil de usuario:", error);
    return null;
  }
};

export const checkManagerExists = async (school, course) => {
  try {
    // Usamos una colección separada para verificar unicidad rápida por ID de documento
    const managerId = `${school.replace(/\s+/g, '_')}_${course.replace(/\s+/g, '_')}`.toUpperCase();
    const docSnap = await getDoc(doc(db, "course_managers", managerId));
    return docSnap.exists();
  } catch (error) {
    console.error("Error verificando existencia de encargado:", error);
    return false;
  }
};

export const registerCourseManager = async (uid, school, course) => {
  try {
    const managerId = `${school.replace(/\s+/g, '_')}_${course.replace(/\s+/g, '_')}`.toUpperCase();
    await setDoc(doc(db, "course_managers", managerId), {
      managerUid: uid,
      school,
      course,
      assignedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Error registrando encargado de curso:", error);
    return false;
  }
};

export const saveCalculatorResult = async (resultData) => {
  try {
    await addDoc(collection(db, "calculator_results"), {
      ...resultData,
      timestamp: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Error guardando resultado de calculadora:", error);
    return false;
  }
};

export const getCalculatorResultsByCourse = async (school, course) => {
  try {
    const q = query(
      collection(db, "calculator_results"),
      where("school", "==", school),
      where("course", "==", course)
    );
    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() });
    });
    return results;
  } catch (error) {
    console.error("Error obteniendo resultados de calculadora:", error);
    return [];
  }
};

export const getAllManagers = async () => {
  try {
    const q = query(collection(db, "users"), where("role", "==", "manager"));
    const querySnapshot = await getDocs(q);
    const managers = [];
    querySnapshot.forEach((doc) => {
      managers.push({ id: doc.id, ...doc.data() });
    });
    return managers;
  } catch (error) {
    console.error("Error obteniendo lista de encargados:", error);
    return [];
  }
};
