import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Save, Trash2, Download, Plus, X, ChevronRight, ChevronDown } from 'lucide-react-native';
import { REGIONES, CURSOS, COLEGIOS_REALES } from '../constants/chileData';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as XLSX from 'xlsx';
import Constants from 'expo-constants';
import { getOrders, deleteOrder, saveAdminSizes, getAdminSizes, saveAdminPushToken, subscribeToOrders, saveAppData, getAppData, subscribeToAppData, saveValidName, deleteValidName, subscribeToValidNames, getAllManagers } from '../services/firebaseOrderService';
import { auth, db } from '../services/firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getUserProfile } from '../services/firebaseOrderService';
import { collection, query, where, getDocs } from 'firebase/firestore';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// SIZES ya no será estático, se derivará de Object.keys(measurements)

export default function AdminScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);

  const [activeTab, setActiveTab] = useState('tallas');

  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Escuchar notificaciones cuando la app está abierta (Primer Plano)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log("Notificación recibida en primer plano:", notification);
      const title = notification.request.content.title;
      const body = notification.request.content.body;
      Alert.alert(title || 'Notificación', body || 'Nuevo mensaje recibido');
    });

    // Escuchar cuando el usuario pulsa en la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("Usuario pulsó la notificación:", response);
      setActiveTab('pedidos');
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userProfile = await getUserProfile(user.uid);
        if (userProfile?.role === 'admin' || user.email === 'inzunzajuan202@gmail.com') {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          checkRememberedUser();
        }
      } else {
        setIsAuthenticated(false);
        checkRememberedUser();
      }
      setIsCheckingAuth(false);
    });
    return unsubscribe;
  }, []);

  const checkRememberedUser = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('admin_email');
      const savedPass = await AsyncStorage.getItem('admin_pass');
      const savedRemember = await AsyncStorage.getItem('admin_remember');
      
      if (savedEmail && savedPass && savedRemember === 'true') {
        setEmailInput(savedEmail);
        setPasswordInput(savedPass);
        setRememberMe(true);
      }
    } catch (e) { console.log(e); }
  };

  const [measurements, setMeasurements] = useState({});
  const [newSizeName, setNewSizeName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // App Config States
  const [appData, setAppData] = useState({
    schools: COLEGIOS_REALES,
    courses: CURSOS,
    regions: REGIONES
  });
  const [newItemName, setNewItemName] = useState('');
  const [selectedRegionIdx, setSelectedRegionIdx] = useState(null);
  const [isSavingAppData, setIsSavingAppData] = useState(false);
  const [validNames, setValidNames] = useState([]);
  const [newValidName, setNewValidName] = useState('');

  // Managers State
  const [managers, setManagers] = useState([]);
  const [isLoadingManagers, setIsLoadingManagers] = useState(false);
  const [managerFilters, setManagerFilters] = useState({ school: '', course: '' });

  useEffect(() => {
    let unsubscribeOrders = null;

    if (isAuthenticated) {
      loadMeasurements();

      // Load and sync App Config
      subscribeToAppData((data) => {
        if (data) {
          setAppData(data);
        } else {
          // Initialize with defaults if empty
          saveAppData({
            schools: COLEGIOS_REALES,
            courses: CURSOS,
            regions: REGIONES
          });
        }
      });

      setIsLoadingOrders(true);
      const refreshOrders = async () => {
        const data = await getOrders();
        setOrders(data);
        setIsLoadingOrders(false);
      };
      refreshOrders();
      // Polling cada 30 segundos para simular tiempo real de forma segura
      const interval = setInterval(refreshOrders, 30000);
      
      registerForPushNotificationsAsync().then(token => {
        if (token) saveAdminPushToken(token);
      });

      // Cargar encargados inicialmente
      const loadManagers = async () => {
        setIsLoadingManagers(true);
        const data = await getAllManagers();
        setManagers(data);
        setIsLoadingManagers(false);
      };
      loadManagers();

      // Sincronizar nombres válidos
      const unsubscribeNames = subscribeToValidNames((names) => {
        setValidNames(names);
      });

      return () => {
        clearInterval(interval);
        if (unsubscribeOrders) unsubscribeOrders();
        unsubscribeNames();
      };
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // onSnapshot is handling updates, no need to reload manually
  }, [activeTab]);

  async function registerForPushNotificationsAsync() {
    let token;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Pedidos Nuevos',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default'
      });
    }

    if (Device.isDevice || Platform.OS === 'web') {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        return null; // Permissions not granted
      }
      try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId || "c3f5b7d0-8b84-42fa-930e-45bb6d125037";
        if (!projectId) {
          console.error("Missing EAS Project ID. Push notifications will not work.");
          return null;
        }
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log("Token de Notificación generado:", token);
      } catch (e) { 
        console.error("Error al obtener Expo Push Token:", e);
        // Intento final con el projectId hardcodeado por si acaso
        try {
          token = (await Notifications.getExpoPushTokenAsync({ projectId: "c3f5b7d0-8b84-42fa-930e-45bb6d125037" })).data;
        } catch (innerError) {
          console.error("Fallo total al obtener token:", innerError);
        }
      }
    }
    return token;
  }

  const loadMeasurements = async () => {
    const data = await getAdminSizes();
    if (data && Object.keys(data).length > 0) {
      setMeasurements(data);
    } else {
      // Fallback inicial si no hay nada en la nube
      setMeasurements({
        '16': { pecho: '45', largo: '60', manga: '55' },
        'S': { pecho: '50', largo: '65', manga: '60' },
        'M': { pecho: '55', largo: '70', manga: '65' },
        'L': { pecho: '60', largo: '75', manga: '70' },
        'XL': { pecho: '65', largo: '80', manga: '75' },
      });
    }
  };

  const handleAddSize = () => {
    if (!newSizeName.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para la talla (ej: XXL)');
      return;
    }
    const name = newSizeName.trim().toUpperCase();
    if (measurements[name]) {
      Alert.alert('Error', 'Esta talla ya existe.');
      return;
    }
    setMeasurements({
      ...measurements,
      [name]: { pecho: '', largo: '', manga: '' }
    });
    setNewSizeName('');
  };

  const handleDeleteSize = (size) => {
    Alert.alert(
      'Eliminar Talla',
      `¿Estás seguro de que quieres eliminar la talla ${size}? Esto afectará a la calculadora de todos los alumnos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: () => {
            const updated = { ...measurements };
            delete updated[size];
            setMeasurements(updated);
          }
        }
      ]
    );
  };

  const loadOrders = async () => {
    // Deprecated for direct load; handled by subscribeToOrders now
  };

  const exportToExcel = async (customOrders = null, fileName = 'Todos_los_Pedidos') => {
    try {
      // Si se llama desde un botón directo (onPress={exportToExcel}), el primer argumento es un evento.
      // Lo ignoramos y usamos la lista global de órdenes.
      const isParamValid = Array.isArray(customOrders);
      const listToExport = isParamValid ? customOrders : orders;

      if (!listToExport || listToExport.length === 0) {
        Alert.alert('Sin Datos', 'No hay pedidos para exportar.');
        return;
      }

      const sortedExport = [...listToExport].sort((a, b) => {
        const pA = a.type === 'GROUP_ORDER' ? a.groupInfo : (a.personalInfo || {});
        const pB = b.type === 'GROUP_ORDER' ? b.groupInfo : (b.personalInfo || {});
        if ((pA.region || '').toLowerCase() !== (pB.region || '').toLowerCase()) return (pA.region || '').localeCompare(pB.region || '');
        if ((pA.ciudad || '').toLowerCase() !== (pB.ciudad || '').toLowerCase()) return (pA.ciudad || '').localeCompare(pB.ciudad || '');
        if ((pA.comuna || '').toLowerCase() !== (pB.comuna || '').toLowerCase()) return (pA.comuna || '').localeCompare(pB.comuna || '');
        if ((pA.colegio || '').toLowerCase() !== (pB.colegio || '').toLowerCase()) return (pA.colegio || '').localeCompare(pB.colegio || '');
        if ((pA.curso || '').toLowerCase() !== (pB.curso || '').toLowerCase()) return (pA.curso || '').localeCompare(pB.curso || '');
        return 0;
      });

      const formattedData = sortedExport.flatMap(o => {
        if (o.type === 'GROUP_ORDER') {
          const g = o.groupInfo || {};
          return (o.estudiantes || []).map(s => ({
            'Nombre del Alumno': `${s.nombre || ''} ${s.apellido || ''}`.trim(),
            'Colegio': g.colegio || '',
            'Curso': g.curso || '',
            'Region': g.region || '',
            'Ciudad': g.ciudad || '',
            'Apodo': s.apodo || '',
            'Talla': s.talla || '',
            'Tipo Pedido': 'GRUPAL'
          }));
        } else {
          const p = o.personalInfo || {};
          return [{
            'Nombre del Alumno': `${p.nombre || ''} ${p.apellido || ''}`.trim(),
            'Colegio': p.colegio || '',
            'Curso': p.curso || '',
            'Region': p.region || '',
            'Ciudad': p.ciudad || '',
            'Apodo': p.apodo || '',
            'Talla': o.tallaElegida || '',
            'Tipo Pedido': 'INDIVIDUAL'
          }];
        }
      });

      const ws = XLSX.utils.json_to_sheet(formattedData);

      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_address = { c: C, r: R };
          const cell_ref = XLSX.utils.encode_cell(cell_address);
          if (!ws[cell_ref]) ws[cell_ref] = { t: "s", v: "" };
          ws[cell_ref].s = {
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            },
            font: R === 0 ? { bold: true } : {}
          };
        }
      }

      ws['!cols'] = [
        { wch: 30 }, // Nombre
        { wch: 35 }, // Colegio
        { wch: 15 }, // Curso
        { wch: 20 }, // Region
        { wch: 20 }, // Ciudad
        { wch: 20 }, // Apodo
        { wch: 10 }, // Talla
        { wch: 15 }  // Tipo
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      if (Platform.OS === 'web') {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${fileName}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const fileUri = FileSystem.documentDirectory + `${fileName.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Error', 'No se puede compartir en este dispositivo.');
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Hubo un problema procesando el archivo de Excel.');
    }
  };

  const handleDeleteOrder = (id) => {
    Alert.alert('Eliminar Pedido', '¿Estás seguro de borrar este pedido?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar', style: 'destructive', onPress: async () => {
          await deleteOrder(id);
        }
      }
    ]);
  };

  const handleLogin = async () => {
    if (!emailInput || !passwordInput) {
      Alert.alert('Error', 'Debes ingresar un correo y contraseña.');
      return;
    }
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      
      const userProfile = await getUserProfile(auth.currentUser.uid);
      if (userProfile?.role === 'admin' || emailInput === 'inzunzajuan202@gmail.com') {
        if (rememberMe) {
          await AsyncStorage.setItem('admin_email', emailInput);
          await AsyncStorage.setItem('admin_pass', passwordInput);
          await AsyncStorage.setItem('admin_remember', 'true');
        } else {
          await AsyncStorage.removeItem('admin_email');
          await AsyncStorage.removeItem('admin_pass');
          await AsyncStorage.setItem('admin_remember', 'false');
        }
        setIsAuthenticated(true);
      } else {
        throw new Error('No tienes permisos de administrador.');
      }
    } catch (e) {
      console.log('Login error:', e);
      Alert.alert('Acceso Denegado', e.message === 'No tienes permisos de administrador.' ? e.message : 'El correo o la contraseña son incorrectos.');
      setPasswordInput('');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const updateMeasurement = (size, field, value) => {
    setMeasurements(prev => ({ ...prev, [size]: { ...prev[size], [field]: value.replace(/[^0-9.,]/g, '') } }));
  };

  const saveSettings = async () => {
    const sizes = Object.keys(measurements);
    if (sizes.length === 0) {
      Alert.alert('Error', 'Debes tener al menos una talla configurada.');
      return;
    }

    let isValid = true;
    for (const size of sizes) {
      const p = parseFloat(String(measurements[size].pecho).replace(',', '.'));
      const l = parseFloat(String(measurements[size].largo).replace(',', '.'));
      const m = parseFloat(String(measurements[size].manga).replace(',', '.'));

      if (isNaN(p) || p <= 0 || isNaN(l) || l <= 0 || isNaN(m) || m <= 0) {
        isValid = false;
        Alert.alert('Medidas Inválidas', `La talla ${size} tiene medidas incorrectas. Deben ser numéricas y mayores a 0.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      await saveAdminSizes(measurements);
      Alert.alert('Éxito', 'Las medidas predeterminadas han sido guardadas.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudieron guardar las medidas.');
    } finally {
      setIsSaving(false);
    }
  };

  const sortedOrdersForRender = [...orders].sort((a, b) => {
    const pA = a.personalInfo || {};
    const pB = b.personalInfo || {};
    if ((pA.region || '').toLowerCase() !== (pB.region || '').toLowerCase()) return (pA.region || '').localeCompare(pB.region || '');
    if ((pA.ciudad || '').toLowerCase() !== (pB.ciudad || '').toLowerCase()) return (pA.ciudad || '').localeCompare(pB.ciudad || '');
    if ((pA.comuna || '').toLowerCase() !== (pB.comuna || '').toLowerCase()) return (pA.comuna || '').localeCompare(pB.comuna || '');
    if ((pA.colegio || '').toLowerCase() !== (pB.colegio || '').toLowerCase()) return (pA.colegio || '').localeCompare(pB.colegio || '');
    if ((pA.curso || '').toLowerCase() !== (pB.curso || '').toLowerCase()) return (pA.curso || '').localeCompare(pB.curso || '');
    return (pA.nombre || '').localeCompare(pB.nombre || '');
  });

  const handleAddSchool = async () => {
    if (!newItemName.trim()) return;
    const updated = { ...appData, schools: [newItemName.trim(), ...appData.schools] };
    setAppData(updated);
    setNewItemName('');
    await saveAppData(updated);
  };

  const handleRemoveSchool = async (index) => {
    const updated = { ...appData, schools: appData.schools.filter((_, i) => i !== index) };
    setAppData(updated);
    await saveAppData(updated);
  };

  const handleAddCourse = async () => {
    if (!newItemName.trim()) return;
    const updated = { ...appData, courses: [...appData.courses, newItemName.trim()] };
    setAppData(updated);
    setNewItemName('');
    await saveAppData(updated);
  };

  const handleRemoveCourse = async (index) => {
    const updated = { ...appData, courses: appData.courses.filter((_, i) => i !== index) };
    setAppData(updated);
    await saveAppData(updated);
  };

  const handleAddRegion = async () => {
    if (!newItemName.trim()) return;
    const updated = { ...appData, regions: [...appData.regions, { id: Date.now(), nombre: newItemName.trim(), comunas: [] }] };
    setAppData(updated);
    setNewItemName('');
    await saveAppData(updated);
  };

  const handleRemoveRegion = async (id) => {
    const updated = { ...appData, regions: appData.regions.filter(r => r.id !== id) };
    setAppData(updated);
    await saveAppData(updated);
  };

  const handleAddCommune = async (regionId) => {
    if (!newItemName.trim()) return;
    const updated = {
      ...appData,
      regions: appData.regions.map(r =>
        r.id === regionId ? { ...r, comunas: [...r.comunas, newItemName.trim()] } : r
      )
    };
    setAppData(updated);
    setNewItemName('');
    await saveAppData(updated);
  };

  const handleRemoveCommune = async (regionId, communeName) => {
    const updated = {
      ...appData,
      regions: appData.regions.map(r =>
        r.id === regionId ? { ...r, comunas: r.comunas.filter(c => c !== communeName) } : r
      )
    };
    setAppData(updated);
    await saveAppData(updated);
  };

  const handleResetAppData = async () => {
    Alert.alert(
      'Restablecer Base de Datos',
      '¿Estás seguro de que quieres restablecer todos los colegios, cursos y regiones a los valores originales de Chile? Esto reemplazará tu configuración actual.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Restablecer Todo', 
          style: 'destructive', 
          onPress: async () => {
            setIsSavingAppData(true);
            const defaults = {
              schools: COLEGIOS_REALES,
              courses: CURSOS,
              regions: REGIONES
            };
            const success = await saveAppData(defaults);
            if (success) {
              setAppData(defaults);
              Alert.alert('Éxito', 'La base de datos ha sido restablecida con los valores por defecto.');
            } else {
              Alert.alert('Error', 'No se pudo restablecer la base de datos.');
            }
            setIsSavingAppData(false);
          }
        }
      ]
    );
  };

  const simulateNotification = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
          Alert.alert('Permiso Denegado', 'Esta app no tiene permiso para mostrar notificaciones.');
          return;
      }

      const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId || "c3f5b7d0-8b84-42fa-930e-45bb6d125037";
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title: '🛎️ ¡Prueba de Conexión!',
          body: 'Si ves esto, las notificaciones están configuradas correctamente.',
          sound: 'default',
          priority: 'high',
          channelId: 'default',
        }),
      });

      if (response.ok) {
        Alert.alert('Prueba enviada', `Deberías recibir una notificación en unos segundos.\n\nToken usado:\n${token}`);
      } else {
        const error = await response.json();
        console.error("Error de Expo API:", error);
        Alert.alert('Error Expo', `Detalle: ${JSON.stringify(error.errors || error)}`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error de Configuración', `Hubo un error al intentar generar el token de prueba: ${e.message}`);
    }
  };

  const handleAddValidName = async () => {
    if (!newValidName.trim()) return;
    const success = await saveValidName(newValidName);
    if (success) setNewValidName('');
  };

  const handleRemoveValidName = async (name) => {
    await deleteValidName(name);
  };

  if (isCheckingAuth) {
    return (
      <View style={[styles.loginContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.loginContainer}>
        <Text style={styles.loginTitle}>Cofiguracion de Tallas</Text>
        <Text style={styles.loginSubtitle}>Inicia sesión con tu cuenta de administrador (Auth) para desencriptar los pedidos.</Text>

        <TextInput
          style={styles.loginInput}
          placeholder="Correo Electrónico"
          placeholderTextColor="#6B7280"
          keyboardType="email-address"
          autoCapitalize="none"
          value={emailInput}
          onChangeText={setEmailInput}
        />
        <TextInput
          style={styles.loginInput}
          placeholder="Contraseña"
          placeholderTextColor="#6B7280"
          secureTextEntry
          value={passwordInput}
          onChangeText={setPasswordInput}
        />
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}
          onPress={() => setRememberMe(!rememberMe)}
        >
          <View style={{ 
            width: 22, height: 22, borderRadius: 6, borderWidth: 2, 
            borderColor: '#3B82F6', marginRight: 10,
            backgroundColor: rememberMe ? '#3B82F6' : 'transparent',
            justifyContent: 'center', alignItems: 'center'
          }}>
            {rememberMe && <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text>}
          </View>
          <Text style={{ color: '#D1D5DB' }}>Permanecer siempre conectado</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={isLoggingIn}>
          {isLoggingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Autenticar Servidor</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'tallas' && styles.activeTab]} onPress={() => setActiveTab('tallas')}>
          <Text style={[styles.tabText, activeTab === 'tallas' && styles.activeTabText]}>Cfg. Tallas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'configApp' && styles.activeTab]} onPress={() => setActiveTab('configApp')}>
          <Text style={[styles.tabText, activeTab === 'configApp' && styles.activeTabText]}>Cfg. App</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'pedidos' && styles.activeTab]} onPress={() => setActiveTab('pedidos')}>
          <Text style={[styles.tabText, activeTab === 'pedidos' && styles.activeTabText]}>Pedidos ({orders.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'encargados' && styles.activeTab]} onPress={() => setActiveTab('encargados')}>
          <Text style={[styles.tabText, activeTab === 'encargados' && styles.activeTabText]}>Encargados</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, backgroundColor: '#374151', padding: 8, borderRadius: 20 }}
        onPress={simulateNotification}
      >
        <Text style={{ color: '#9CA3AF', fontSize: 10 }}>🔔 Probar</Text>
      </TouchableOpacity>

      {activeTab === 'tallas' ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.headerSubtitle}>
              Define las medidas estándar. Todos los teléfonos de los alumnos leerán estos datos.
            </Text>

            <View style={styles.configCard}>
              <Text style={styles.configTitle}>➕ Nueva Talla</Text>
              <View style={styles.addInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  placeholder="Ej: XXL, 14, 2 XL..."
                  placeholderTextColor="#6B7280"
                  value={newSizeName}
                  onChangeText={setNewSizeName}
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAddSize}>
                  <Plus color="#fff" size={24} />
                </TouchableOpacity>
              </View>
            </View>

            {Object.keys(measurements).map((size) => (
              <View key={size} style={styles.sizeCard}>
                <View style={styles.sizeHeader}>
                  <View style={styles.sizeBadge}>
                    <Text style={styles.sizeBadgeText}>{size}</Text>
                  </View>
                  <Text style={styles.sizeTitle}>Talla {size}</Text>
                  <TouchableOpacity 
                    style={{ marginLeft: 'auto', padding: 8 }} 
                    onPress={() => handleDeleteSize(size)}
                  >
                    <Trash2 color="#EF4444" size={20} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputsRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Pecho (cm)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={String(measurements[size].pecho)} onChangeText={(val) => updateMeasurement(size, 'pecho', val)} />
                  </View>
                  <View style={styles.spacer} />
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Largo (cm)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={String(measurements[size].largo)} onChangeText={(val) => updateMeasurement(size, 'largo', val)} />
                  </View>
                  <View style={styles.spacer} />
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Mangas (cm)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={String(measurements[size].manga || '')} onChangeText={(val) => updateMeasurement(size, 'manga', val)} />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveButton} onPress={saveSettings} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Save color="#fff" size={20} style={{ marginRight: 8 }} />
                  <Text style={styles.saveButtonText}>Guardar Medidas</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : activeTab === 'configApp' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.headerSubtitle}>Gestiona las opciones que los alumnos ven al registrarse.</Text>

          {/* COLEGIOS */}
          <View style={styles.configCard}>
            <Text style={styles.configTitle}>🏫 Colegios</Text>
            <View style={styles.addInputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Añadir Colegio..."
                placeholderTextColor="#6B7280"
                value={activeTab === 'configApp' && selectedRegionIdx === null ? newItemName : ''}
                onChangeText={setNewItemName}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddSchool}>
                <Plus color="#fff" size={24} />
              </TouchableOpacity>
            </View>
            <View style={styles.listContainer}>
              {appData.schools.slice(0, 10).map((school, i) => (
                <View key={i} style={styles.listItem}>
                  <Text style={styles.listItemText}>{school}</Text>
                  <TouchableOpacity onPress={() => handleRemoveSchool(i)}><X color="#EF4444" size={20} /></TouchableOpacity>
                </View>
              ))}
              {appData.schools.length > 10 && <Text style={styles.moreItemsText}>+ {appData.schools.length - 10} colegios más...</Text>}
            </View>
          </View>

          {/* CURSOS */}
          <View style={styles.configCard}>
            <Text style={styles.configTitle}>📚 Cursos</Text>
            <View style={styles.addInputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Añadir Curso (Ej: 4° H)..."
                placeholderTextColor="#6B7280"
                value={activeTab === 'configApp' && selectedRegionIdx === 'course' ? newItemName : ''}
                onFocus={() => setSelectedRegionIdx('course')}
                onChangeText={setNewItemName}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddCourse}>
                <Plus color="#fff" size={24} />
              </TouchableOpacity>
            </View>
            <View style={styles.tagsContainer}>
              {appData.courses.map((curso, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{curso}</Text>
                  <TouchableOpacity onPress={() => handleRemoveCourse(i)}><X color="#fff" size={14} style={{ marginLeft: 4 }} /></TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* REGIONES Y COMUNAS */}
          <View style={styles.configCard}>
            <Text style={styles.configTitle}>📍 Regiones y Comunas</Text>
            <View style={styles.addInputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Añadir Región..."
                placeholderTextColor="#6B7280"
                value={activeTab === 'configApp' && selectedRegionIdx === 'region' ? newItemName : ''}
                onFocus={() => setSelectedRegionIdx('region')}
                onChangeText={setNewItemName}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddRegion}>
                <Plus color="#fff" size={24} />
              </TouchableOpacity>
            </View>
            {appData.regions.map((region, idx) => (
              <View key={region.id} style={styles.regionItem}>
                <View style={styles.regionHeader}>
                  <TouchableOpacity style={styles.regionTitleWrapper} onPress={() => setSelectedRegionIdx(selectedRegionIdx === idx ? null : idx)}>
                    {selectedRegionIdx === idx ? <ChevronDown color="#9CA3AF" size={20} /> : <ChevronRight color="#9CA3AF" size={20} />}
                    <Text style={styles.regionName}>{region.nombre}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemoveRegion(region.id)}><X color="#EF4444" size={18} /></TouchableOpacity>
                </View>
                {selectedRegionIdx === idx && (
                  <View style={styles.communeContainer}>
                    <View style={styles.addCommuneRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginRight: 8, paddingVertical: 6 }]}
                        placeholder="Añadir Comuna..."
                        placeholderTextColor="#6B7280"
                        value={activeTab === 'configApp' && selectedRegionIdx === idx ? newItemName : ''}
                        onChangeText={setNewItemName}
                      />
                      <TouchableOpacity style={[styles.addButton, { paddingHorizontal: 12 }]} onPress={() => handleAddCommune(region.id)}>
                        <Plus color="#fff" size={18} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.communeList}>
                      {region.comunas.map((com, ci) => (
                        <View key={ci} style={styles.communeItem}>
                          <Text style={styles.communeText}>{com}</Text>
                          <TouchableOpacity onPress={() => handleRemoveCommune(region.id, com)}><X color="#6B7280" size={16} /></TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* NOMBRES AUTORIZADOS */}
          <View style={styles.configCard}>
            <Text style={styles.configTitle}>👤 Nombres de Alumnos Autorizados</Text>
            <Text style={styles.label}>Añade nombres específicos que quieres permitir (Ej. apodos permitidos o alumnos nuevos).</Text>
            <View style={styles.addInputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Añadir Nombre..."
                placeholderTextColor="#6B7280"
                value={newValidName}
                onChangeText={setNewValidName}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddValidName}>
                <Plus color="#fff" size={24} />
              </TouchableOpacity>
            </View>
            <View style={styles.tagsContainer}>
              {validNames.map((name, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{name}</Text>
                  <TouchableOpacity onPress={() => handleRemoveValidName(name)}><X color="#fff" size={14} style={{ marginLeft: 4 }} /></TouchableOpacity>
                </View>
              ))}
            </View>
            {validNames.length === 0 && <Text style={styles.moreItemsText}>No hay nombres adicionales guardados en la nube.</Text>}
          </View>

          {/* BOTÓN DE RESTABLECIMIENTO TOTAL */}
          <View style={{ marginTop: 20, marginBottom: 40 }}>
            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: '#374151', paddingVertical: 14, flexDirection: 'row' }]} 
              onPress={handleResetAppData}
              disabled={isSavingAppData}
            >
              <Download color="#94A3B8" size={20} style={{ marginRight: 8 }} />
              <Text style={{ color: '#F9FAFB', fontWeight: 'bold' }}>Restablecer Base de Datos (Default Chile)</Text>
            </TouchableOpacity>
            <Text style={{ color: '#6B7280', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
              Usa esto para cargar todos los colegios y regiones reales de una sola vez.
            </Text>
          </View>
        </ScrollView>
      ) : activeTab === 'encargados' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.headerSubtitle}>Gestión de responsables por curso y colegio.</Text>
          
          <View style={styles.configCard}>
             <Text style={styles.configTitle}>🔍 Filtrar por Grupo</Text>
             <View style={styles.inputGroup}>
                <Text style={styles.label}>Colegio</Text>
                <TextInput 
                   style={styles.input} 
                   placeholder="Escribe el colegio..." 
                   placeholderTextColor="#6B7280"
                   value={managerFilters.school}
                   onChangeText={(val) => setManagerFilters({...managerFilters, school: val})}
                />
             </View>
             <View style={[styles.inputGroup, {marginTop: 12}]}>
                <Text style={styles.label}>Curso</Text>
                <TextInput 
                   style={styles.input} 
                   placeholder="Escribe el curso..." 
                   placeholderTextColor="#6B7280"
                   value={managerFilters.course}
                   onChangeText={(val) => setManagerFilters({...managerFilters, course: val})}
                />
             </View>
          </View>

          {/* Resultado del Filtro */}
          {(managerFilters.school || managerFilters.course) && (
            <View style={[styles.configCard, {backgroundColor: '#1E293B', borderColor: '#3B82F6'}]}>
              <Text style={[styles.configTitle, {color: '#3B82F6'}]}>✅ Encargado Encontrado</Text>
              {managers.filter(m => 
                (!managerFilters.school || m.school?.toLowerCase().includes(managerFilters.school.toLowerCase())) &&
                (!managerFilters.course || m.course?.toLowerCase().includes(managerFilters.course.toLowerCase()))
              ).length > 0 ? (
                managers.filter(m => 
                  (!managerFilters.school || m.school?.toLowerCase().includes(managerFilters.school.toLowerCase())) &&
                  (!managerFilters.course || m.course?.toLowerCase().includes(managerFilters.course.toLowerCase()))
                ).map((m, i) => (
                  <View key={i} style={{marginTop: 10}}>
                    <Text style={{color: '#fff', fontSize: 16, fontWeight: 'bold'}}>{m.nombre}</Text>
                    <Text style={{color: '#9CA3AF', fontSize: 14}}>{m.email}</Text>
                    <Text style={{color: '#3B82F6', fontSize: 12, marginTop: 4}}>{m.school} - {m.course}</Text>
                  </View>
                ))
              ) : (
                <Text style={{color: '#9CA3AF', marginTop: 10}}>No se encontró ningún encargado con esos filtros.</Text>
              )}
            </View>
          )}

          <Text style={[styles.configTitle, {marginTop: 20}]}>📋 Todos los Encargados ({managers.length})</Text>
          {managers.map((m, i) => (
            <View key={m.id || i} style={[styles.sizeCard, {padding: 12}]}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 <View style={[styles.sizeBadge, {backgroundColor: '#10B981'}]}>
                    <Text style={styles.sizeBadgeText}>{m.nombre.charAt(0).toUpperCase()}</Text>
                 </View>
                 <View style={{flex: 1}}>
                    <Text style={{color: '#F9FAFB', fontWeight: 'bold'}}>{m.nombre}</Text>
                    <Text style={{color: '#9CA3AF', fontSize: 12}}>{m.email}</Text>
                    <Text style={{color: '#10B981', fontSize: 11, fontWeight: 'bold'}}>{m.school} • {m.course}</Text>
                 </View>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.ordersContent}>
          {orders.length > 0 && (
            <TouchableOpacity style={styles.exportButton} onPress={() => exportToExcel()}>
              <Download color="#fff" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.exportButtonText}>Exportar a Excel (CSV)</Text>
            </TouchableOpacity>
          )}

          {isLoadingOrders ? (
            <ActivityIndicator color="#3B82F6" style={{ marginTop: 40 }} />
          ) : orders.length === 0 ? (
            <Text style={styles.noOrdersText}>No hay pedidos registrados.</Text>
          ) : (
            sortedOrdersForRender.map((order, index) => {
              const isGroup = order.type === 'GROUP_ORDER';
              const prevType = index > 0 ? sortedOrdersForRender[index - 1].type : null;
              const prevInfo = index > 0 ? (prevType === 'GROUP_ORDER' ? sortedOrdersForRender[index - 1].groupInfo : sortedOrdersForRender[index - 1].personalInfo) : null;
              
              const curr = isGroup ? (order.groupInfo || {}) : (order.personalInfo || {});

              const showLocation = !prevInfo || prevInfo.region?.toLowerCase() !== curr.region?.toLowerCase() || prevInfo.ciudad?.toLowerCase() !== curr.ciudad?.toLowerCase() || prevInfo.comuna?.toLowerCase() !== curr.comuna?.toLowerCase();
              const showColegio = showLocation || prevInfo.colegio?.toLowerCase() !== curr.colegio?.toLowerCase();
              const showCurso = showColegio || prevInfo.curso?.toLowerCase() !== curr.curso?.toLowerCase();

              const dateObj = new Date(order.date);

              return (
                <View key={order.id}>
                  {showLocation && (
                    <View style={styles.sectionHeaderLocation}>
                      <Text style={styles.sectionHeaderTextLocation}>📍 {curr.region || 'S/R'} / {curr.ciudad || 'S/C'} / {curr.comuna || 'S/C'}</Text>
                      <TouchableOpacity onPress={() => {
                        const locationFileName = `Pedidos_${curr.region || 'Region'}_${curr.ciudad || 'Ciudad'}`;
                        exportToExcel(orders.filter(o => o.personalInfo?.region === curr.region && o.personalInfo?.ciudad === curr.ciudad && o.personalInfo?.comuna === curr.comuna), locationFileName);
                      }}>
                        <Download color="#D1D5DB" size={18} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {showColegio && (
                    <View style={[styles.sectionHeaderColegio, { flexDirection: 'column', alignItems: 'stretch' }]}>
                      <Text style={[styles.sectionHeaderTextColegio, { marginBottom: 8 }]}>🏫 Colegio: {curr.colegio || 'Sin Especificar'}</Text>
                      <TouchableOpacity
                        style={{ backgroundColor: '#10B981', borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                        onPress={() => {
                          const baseName = (curr.colegio || 'General').replace(/\s+/g, '_');
                          const schoolFileName = `Pedidos_Colegio_${baseName}`;
                          exportToExcel(orders.filter(o => o.personalInfo?.colegio === curr.colegio && o.personalInfo?.region === curr.region && o.personalInfo?.ciudad === curr.ciudad), schoolFileName);
                        }}>
                        <Download color="#fff" size={18} style={{ marginRight: 8 }} />
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Descargar Excel (Solo este Colegio)</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {showCurso && (
                    <View style={[styles.sectionHeaderCurso, { flexDirection: 'column', alignItems: 'stretch' }]}>
                      <Text style={[styles.sectionHeaderTextCurso, { marginBottom: 8 }]}>📚 Curso: {curr.curso || 'Sin Especificar'}</Text>
                      <TouchableOpacity
                        style={{ backgroundColor: '#374151', borderRadius: 8, padding: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#4B5563' }}
                        onPress={() => {
                          const baseCol = (curr.colegio || 'General').replace(/\s+/g, '_');
                          const baseCur = (curr.curso || 'Extra').replace(/\s+/g, '_');
                          const courseFileName = `Pedidos_${baseCol}_Curso_${baseCur}`;
                          exportToExcel(orders.filter(o => o.personalInfo?.curso === curr.curso && o.personalInfo?.colegio === curr.colegio), courseFileName);
                        }}>
                        <Download color="#E5E7EB" size={16} style={{ marginRight: 8 }} />
                        <Text style={{ color: '#E5E7EB', fontWeight: '600', fontSize: 13 }}>Descargar Excel (Solo este Curso)</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.orderCard}>
                    <View style={styles.orderHeaderRow}>
                      <View style={[styles.orderUserBadge, isGroup && {backgroundColor: '#10B981'}]}>
                        <Text style={styles.orderUserLetter}>{isGroup ? 'G' : (curr.nombre || 'A').charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.orderUserTexts}>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                          <Text style={styles.orderName}>{isGroup ? `PEDIDO GRUPAL (${order.estudiantes?.length || 0})` : `${curr.nombre || 'Sin Nombre'} ${curr.apellido || ''}`}</Text>
                          {order.status && (
                            <View style={{marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: order.status === 'PAID' ? '#10B981' : '#F59E0B'}}>
                              <Text style={{color: '#fff', fontSize: 10, fontWeight: 'bold'}}>{order.status}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.orderDate}>{dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString()}</Text>
                      </View>
                      <TouchableOpacity style={styles.deleteOrderBtn} onPress={() => handleDeleteOrder(order.id)}>
                        <Trash2 color="#EF4444" size={20} />
                      </TouchableOpacity>
                    </View>

                    {isGroup ? (
                      <View style={styles.groupStudentsList}>
                        <Text style={{color: '#9CA3AF', marginBottom: 5, fontSize: 12, fontWeight: 'bold'}}>ALUMNOS:</Text>
                        {(order.estudiantes || []).map((s, idx) => (
                           <Text key={idx} style={{color: '#F9FAFB', fontSize: 13, marginBottom: 2}}>
                             • {s.nombre} {s.apellido} - <Text style={{fontWeight: 'bold', color: '#3B82F6'}}>{s.talla}</Text>
                           </Text>
                        ))}

                        {order.disenos && order.disenos.length > 0 && (
                          <View style={{marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#374151'}}>
                            <Text style={{color: '#9CA3AF', marginBottom: 5, fontSize: 12, fontWeight: 'bold'}}>ADJUNTOS:</Text>
                            {order.disenos.map((file, fIdx) => (
                              <View key={fIdx} style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                                <File color="#9CA3AF" size={14} style={{marginRight: 6}} />
                                <Text style={{color: '#3B82F6', fontSize: 12}}>{file.name || 'Archivo sin nombre'}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.orderMetricsBox}>
                        <View style={styles.metricsRow}>
                          <Text style={styles.metricText}>Pecho: {order.medidas?.pecho}cm</Text>
                          <Text style={styles.metricText}>Largo: {order.medidas?.largo}cm</Text>
                          <Text style={styles.metricText}>Manga: {order.medidas?.manga}cm</Text>
                        </View>
                        <View style={styles.decisionRow}>
                          <Text style={styles.decisionSugg}>Sugerida: {order.tallaRecomendada}</Text>
                          <View style={styles.decisionFinalBlock}>
                            <Text style={styles.decisionLabel}>ESCOGIDA:</Text>
                            <Text style={styles.decisionFinalSize}>{order.tallaElegida}</Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151'
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#3B82F6' },
  tabText: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  activeTabText: { color: '#3B82F6' },
  content: { padding: 20, paddingBottom: 100 },
  headerSubtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 20, lineHeight: 20 },
  sizeCard: { backgroundColor: '#1F2937', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  sizeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sizeBadge: { backgroundColor: '#374151', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  sizeBadgeText: { color: '#F9FAFB', fontWeight: 'bold' },
  sizeTitle: { color: '#E5E7EB', fontSize: 18, fontWeight: '600' },
  inputsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  inputGroup: { flex: 1 },
  spacer: { width: 10 },
  label: { color: '#9CA3AF', fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#F9FAFB', fontSize: 15 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1F2937', padding: 16, borderTopWidth: 1, borderTopColor: '#374151' },
  saveButton: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  ordersContent: { padding: 20, paddingBottom: 60 },
  exportButton: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  exportButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  noOrdersText: { color: '#9CA3AF', textAlign: 'center', marginTop: 40, fontSize: 16 },
  sectionHeaderLocation: { backgroundColor: '#374151', padding: 8, borderRadius: 8, marginTop: 16, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderTextLocation: { color: '#D1D5DB', fontSize: 13, fontWeight: 'bold' },
  sectionHeaderColegio: { backgroundColor: '#1F2937', padding: 8, borderLeftWidth: 4, borderLeftColor: '#3B82F6', marginTop: 8, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderTextColegio: { color: '#F9FAFB', fontSize: 15, fontWeight: 'bold' },
  sectionHeaderCurso: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#374151', marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderTextCurso: { color: '#9CA3AF', fontSize: 14, fontWeight: 'bold' },
  orderCard: { backgroundColor: '#1F2937', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  orderHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  orderUserBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  orderUserLetter: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  orderUserTexts: { flex: 1 },
  orderName: { color: '#F9FAFB', fontSize: 16, fontWeight: 'bold' },
  orderDate: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  deleteOrderBtn: { padding: 8 },
  orderMetricsBox: { backgroundColor: '#111827', borderRadius: 12, padding: 12 },
  groupStudentsList: { backgroundColor: '#111827', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#374151' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  metricText: { color: '#D1D5DB', fontSize: 14 },
  decisionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  decisionSugg: { color: '#9CA3AF', fontSize: 14 },
  decisionFinalBlock: { flexDirection: 'row', alignItems: 'center' },
  decisionLabel: { color: '#10B981', fontSize: 12, fontWeight: 'bold', marginRight: 8 },
  decisionFinalSize: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  loginContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', padding: 24 },
  loginTitle: { fontSize: 28, fontWeight: 'bold', color: '#F9FAFB', marginBottom: 8, textAlign: 'center' },
  loginSubtitle: { fontSize: 15, color: '#9CA3AF', marginBottom: 32, textAlign: 'center' },
  loginInput: { backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151', borderRadius: 12, padding: 16, color: '#F9FAFB', fontSize: 16, marginBottom: 24 },
  loginButton: { backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  loginButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  configCard: { backgroundColor: '#1F2937', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  configTitle: { color: '#E5E7EB', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  addInputRow: { flexDirection: 'row', marginBottom: 16 },
  addButton: { backgroundColor: '#3B82F6', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  listContainer: { backgroundColor: '#111827', borderRadius: 12, overflow: 'hidden' },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  listItemText: { color: '#D1D5DB', fontSize: 14 },
  moreItemsText: { color: '#6B7280', fontSize: 12, padding: 12, textAlign: 'center' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  tag: { backgroundColor: '#3B82F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', marginRight: 8, marginBottom: 8 },
  tagText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  regionItem: { marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  regionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  regionTitleWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  regionName: { color: '#F9FAFB', fontSize: 15, marginLeft: 8 },
  communeContainer: { backgroundColor: '#111827', padding: 12, borderRadius: 12, marginBottom: 12 },
  addCommuneRow: { flexDirection: 'row', marginBottom: 12 },
  communeList: { flexDirection: 'row', flexWrap: 'wrap' },
  communeItem: { backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', marginRight: 6, marginBottom: 6 },
  communeText: { color: '#9CA3AF', fontSize: 12, marginRight: 4 }
});
