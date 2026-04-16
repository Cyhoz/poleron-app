import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
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
    const normalizedTarget = normalizeName(fullName);
    if (!normalizedTarget) return false;

    // 1. Verificar en lista de alumnos autorizados (Búsqueda DIRECTA por ID)
    // Esto gasta solo 1 lectura de Firestore en lugar de escanear todo.
    const validSnap = await getDoc(doc(db, "valid_names", normalizedTarget));
    if (validSnap.exists()) return true;

    // 2. Opción B: Validación flexible por diccionarios comunes
    const parts = normalizedTarget.split(' ');
    if (parts.length < 2) return false; 

    // Verificamos cada parte del nombre en paralelo (Búsqueda Directa)
    const checks = await Promise.all(parts.map(async (part) => {
      const [nameSnap, surnameSnap] = await Promise.all([
        getDoc(doc(db, "common_names", part)),
        getDoc(doc(db, "common_surnames", part))
      ]);
      return { 
        isCommonName: nameSnap.exists(), 
        isCommonSurname: surnameSnap.exists() 
      };
    }));

    // El nombre es válido si al menos una parte es un "nombre común" 
    // y al menos una de las otras partes es un "apellido común"
    const hasCommonName = checks.some(c => c.isCommonName);
    const hasCommonSurname = checks.some(c => c.isCommonSurname);

    return hasCommonName && hasCommonSurname;
  } catch (error) {
    console.error("Error en auditoría de identidad optimizada:", error);
    return false; 
  }
};

export const auditSchool = (schoolName, authorizedSchools = []) => {
  if (!schoolName || authorizedSchools.length === 0) return false;
  const normalizedTarget = normalizeName(schoolName);
  return authorizedSchools.some(s => {
    const name = typeof s === 'string' ? s : s.nombre;
    return normalizeName(name) === normalizedTarget;
  });
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

export const getAuditLists = async () => {
  try {
    const [validSnap, commonNSnap, commonSSnap] = await Promise.all([
      getDocs(collection(db, "valid_names")),
      getDocs(collection(db, "common_names")),
      getDocs(collection(db, "common_surnames"))
    ]);

    return {
      validNames: validSnap.docs.map(d => normalizeName(d.id)),
      commonNames: commonNSnap.docs.map(d => normalizeName(d.id)),
      commonSurnames: commonSSnap.docs.map(d => normalizeName(d.id))
    };
  } catch (e) {
    console.error("Error fetching audit lists:", e);
    return { validNames: [], commonNames: [], commonSurnames: [] };
  }
};

export const checkIdentityOffline = (fullName, lists) => {
  const normalizedTarget = normalizeName(fullName);
  if (!normalizedTarget) return false;

  // 1. Whitelist
  if (lists.validNames.includes(normalizedTarget)) return true;

  // 2. Common dictionaries logic
  const parts = normalizedTarget.split(' ');
  if (parts.length < 2) return false;

  const firstNameValid = lists.commonNames.includes(parts[0]);
  const hasCommonSurname = parts.slice(1).some(part => lists.commonSurnames.includes(part));

  return firstNameValid && hasCommonSurname;
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

export const seedDictionaryBatch = async (names, surnames) => {
  try {
    const batch = writeBatch(db);
    
    names.forEach(name => {
      const nameUpper = name.toUpperCase().trim();
      const ref = doc(db, "common_names", nameUpper);
      batch.set(ref, { exists: true });
    });

    surnames.forEach(surname => {
      const snUpper = surname.toUpperCase().trim();
      const ref = doc(db, "common_surnames", snUpper);
      batch.set(ref, { exists: true });
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error al poblar diccionario en lote", error);
    return false;
  }
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
