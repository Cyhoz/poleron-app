import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from './firebaseConfig';
const API_BASE_URL = 'https://poleron-app-2.onrender.com';


export const saveOrder = async (orderData) => {
  try {
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
    return { success: true };
  } catch (error) {
    console.error("Error guardando configuraciones", error);
    return { success: false, error: error.message };
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
    return { success: true };
  } catch (error) {
    console.error("Error saving admin push token", error);
    return { success: false, error: error.message };
  }
};

export const saveAppData = async (data) => {
  try {
    await setDoc(doc(db, "config", "appData"), data);
    return { success: true };
  } catch (error) {
    console.error("Error saving app data", error);
    return { success: false, error: error.message };
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
    // IMPORTANTE: Aseguramos que la búsqueda sea sobre el nombre normalizado
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
    const normalized = normalizeName(name);
    if (!normalized) return { success: false, error: "Nombre inválido" };
    await setDoc(doc(db, "valid_names", normalized), { addedAt: new Date().toISOString() });
    return { success: true };
  } catch (error) {
    console.error("Error guardando nombre válido", error);
    return { success: false, error: error.message };
  }
};

export const deleteValidName = async (name) => {
  try {
    const normalized = normalizeName(name);
    await deleteDoc(doc(db, "valid_names", normalized));
    return { success: true };
  } catch (error) {
    console.error("Error borrando nombre válido", error);
    return { success: false, error: error.message };
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

export const normalizeExistingValidNames = async () => {
  try {
    const snap = await getDocs(collection(db, "valid_names"));
    const batch = writeBatch(db);
    let count = 0;
    
    for (const docSnap of snap.docs) {
      const oldId = docSnap.id;
      const newId = normalizeName(oldId);
      if (oldId !== newId) {
        batch.set(doc(db, "valid_names", newId), { 
          ...docSnap.data(), 
          migratedAt: new Date().toISOString() 
        });
        batch.delete(doc(db, "valid_names", oldId));
        count++;
      }
    }
    
    if (count > 0) await batch.commit();
    return { success: true, count };
  } catch (error) {
    console.error("Error normalizando nombres:", error);
    return { success: false, error: error.message };
  }
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
    const normalized = normalizeName(name);
    if (!normalized) return { success: false, error: "Nombre inválido" };
    await setDoc(doc(db, "common_names", normalized), { exists: true });
    return { success: true };
  } catch (error) {
    console.error("Error guardando nombre común", error);
    return { success: false, error: error.message };
  }
};

export const deleteCommonName = async (name) => {
  try {
    const normalized = normalizeName(name);
    await deleteDoc(doc(db, "common_names", normalized));
    return { success: true };
  } catch (error) {
    console.error("Error borrando nombre común", error);
    return { success: false, error: error.message };
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
    const normalized = normalizeName(surname);
    if (!normalized) return { success: false, error: "Apellido inválido" };
    await setDoc(doc(db, "common_surnames", normalized), { exists: true });
    return { success: true };
  } catch (error) {
    console.error("Error guardando apellido común", error);
    return { success: false, error: error.message };
  }
};

export const deleteCommonSurname = async (surname) => {
  try {
    const normalized = normalizeName(surname);
    await deleteDoc(doc(db, "common_surnames", normalized));
    return { success: true };
  } catch (error) {
    console.error("Error borrando apellido común", error);
    return { success: false, error: error.message };
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
    const totalOps = names.length + surnames.length;
    console.log(`Iniciando sembrado de diccionario: ${names.length} nombres, ${surnames.length} apellidos. Total ops: ${totalOps}`);
    
    // Función auxiliar para procesar en trozos de 500 (límite de Firestore)
    const chunks = [];
    const combined = [
      ...names.map(n => ({ name: n, collection: "common_names" })),
      ...surnames.map(s => ({ name: s, collection: "common_surnames" }))
    ];

    for (let i = 0; i < combined.length; i += 500) {
      chunks.push(combined.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => {
        const normalized = normalizeName(item.name);
        if (normalized) {
          const ref = doc(db, item.collection, normalized);
          batch.set(ref, { exists: true });
        }
      });
      await batch.commit();
      console.log(`Lote de ${chunk.length} procesado.`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error al poblar diccionario en lote:", error);
    return { success: false, error: error.message || String(error) };
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
    return { success: true };
  } catch (error) {
    console.error("Error registrando encargado de curso:", error);
    return { success: false, error: error.message };
  }
};

export const saveCalculatorResult = async (resultData) => {
  try {
    const normalizedData = {
      ...resultData,
      school: normalizeName(resultData.school),
      course: normalizeName(resultData.course),
      timestamp: new Date().toISOString()
    };
    await addDoc(collection(db, "calculator_results"), normalizedData);
    return { success: true };
  } catch (error) {
    console.error("Error guardando resultado de calculadora:", error);
    return { success: false, error: error.message };
  }
};

export const getCalculatorResultsByCourse = async (school, course) => {
  try {
    const q = query(
      collection(db, "calculator_results"),
      where("school", "==", normalizeName(school)),
      where("course", "==", normalizeName(course))
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
      managers.push({ uid: doc.id, ...doc.data() });
    });
    return managers;
  } catch (error) {
    console.error("Error obteniendo encargados:", error);
    return [];
  }
};

export const getAllUsers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/users`);
    return await response.json();
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    return [];
  }
};

export const deleteUserAccount = async (uid) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${uid}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error("Error eliminando usuario:", error);
    return false;
  }
};

export const createUserAccount = async (userData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
  } catch (error) {
    console.error("Error creando usuario:", error);
    throw error;
  }
};

export const clearSystemData = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/system/clear-all`, {
      method: 'POST'
    });
    return await response.json();
  } catch (error) {
    console.error("Error en limpieza del sistema:", error);
    return { success: false, error: error.message };
  }
};
