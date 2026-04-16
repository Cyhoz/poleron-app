import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Save, Trash2, Download, Plus, X, ChevronRight, ChevronDown, File, MessageCircle, Phone } from 'lucide-react-native';
import { REGIONES, CURSOS, COLEGIOS_REALES } from '../constants/chileData';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as XLSX from 'xlsx';
import Constants from 'expo-constants';
import { 
  getOrders, deleteOrder, saveAdminSizes, getAdminSizes, saveAdminPushToken, 
  subscribeToOrders, saveAppData, getAppData, subscribeToAppData, 
  saveValidName, deleteValidName, subscribeToValidNames, 
  saveCommonName, deleteCommonName, subscribeToCommonNames,
  saveCommonSurname, deleteCommonSurname, subscribeToCommonSurnames, seedDictionaryBatch,
  getAllManagers, getUserProfile 
} from '../services/firebaseOrderService';
import { auth, db } from '../services/firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
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
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const title = notification.request.content.title;
      const body = notification.request.content.body;
      Alert.alert(title || 'Notificación', body || 'Nuevo mensaje recibido');
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
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

  const [appData, setAppData] = useState({
    schools: COLEGIOS_REALES,
    courses: CURSOS,
    regions: REGIONES,
    whatsappSupport: '+56900000000'
  });
  const [newItemName, setNewItemName] = useState('');
  const [newSchoolCity, setNewSchoolCity] = useState('');
  const [newSchoolCommune, setNewSchoolCommune] = useState('');
  const [selectedRegionIdx, setSelectedRegionIdx] = useState(null);
  const [isSavingAppData, setIsSavingAppData] = useState(false);
  const [validNames, setValidNames] = useState([]);
  const [newValidName, setNewValidName] = useState('');
  const [newTemplateText, setNewTemplateText] = useState('');
  const [selectedOrderForWhatsApp, setSelectedOrderForWhatsApp] = useState(null);
  const [isWhatsAppModalVisible, setIsWhatsAppModalVisible] = useState(false);

  const [commonNames, setCommonNames] = useState([]);
  const [newCommonName, setNewCommonName] = useState('');
  const [commonSurnames, setCommonSurnames] = useState([]);
  const [newCommonSurname, setNewCommonSurname] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);

  const [managers, setManagers] = useState([]);
  const [isLoadingManagers, setIsLoadingManagers] = useState(false);
  const [managerFilters, setManagerFilters] = useState({ school: '', course: '' });

  useEffect(() => {
    if (isAuthenticated) {
      loadMeasurements();

      const unsubscribeData = subscribeToAppData((data) => {
        if (data) {
          setAppData(data);
        } else {
          saveAppData({
            whatsappSupport: '+56900000000',
            whatsappTemplates: [
              "Hola [NOMBRE], tu pedido de [COLEGIO] ha sido recibido correctamente. ¡Gracias!",
              "Hola [NOMBRE], tenemos un detalle con el diseño de tu pedido. ¿Podemos hablar?",
              "Tu pedido de polerón ya está listo para ser despachado. Atento a los tiempos de entrega.",
              "Hola, necesitamos confirmar la talla de uno de los alumnos para proceder."
            ]
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
      const interval = setInterval(refreshOrders, 30000);
      
      registerForPushNotificationsAsync().then(token => {
        if (token) saveAdminPushToken(token);
      });

      const loadManagers = async () => {
        setIsLoadingManagers(true);
        const data = await getAllManagers();
        setManagers(data);
        setIsLoadingManagers(false);
      };
      loadManagers();

      const unsubscribeNames = subscribeToValidNames((names) => {
        setValidNames(names);
      });

      const unsubscribeCommonNames = subscribeToCommonNames((names) => {
        setCommonNames(names);
      });

      const unsubscribeCommonSurnames = subscribeToCommonSurnames((sn) => {
        setCommonSurnames(sn);
      });

      return () => {
        clearInterval(interval);
        unsubscribeData();
        unsubscribeNames();
        unsubscribeCommonNames();
        unsubscribeCommonSurnames();
      };
    }
  }, [isAuthenticated]);

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
        return null;
      }
      try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || "c3f5b7d0-8b84-42fa-930e-45bb6d125037";
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } catch (e) { 
        console.error("Error al obtener Expo Push Token:", e);
      }
    }
    return token;
  }

  const loadMeasurements = async () => {
    const data = await getAdminSizes();
    if (data && Object.keys(data).length > 0) {
      setMeasurements(data);
    } else {
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
    if (!newSizeName.trim()) return;
    const name = newSizeName.trim().toUpperCase();
    if (measurements[name]) return;
    setMeasurements({ ...measurements, [name]: { pecho: '', largo: '', manga: '' } });
    setNewSizeName('');
  };

  const handleDeleteSize = (size) => {
    Alert.alert('Eliminar Talla', `¿Estás seguro de que quieres eliminar la talla ${size}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => {
          const updated = { ...measurements };
          delete updated[size];
          setMeasurements(updated);
      }}
    ]);
  };

  const exportToExcel = async (customOrders = null, fileName = 'Todos_los_Pedidos') => {
    try {
      const isParamValid = Array.isArray(customOrders);
      const listToExport = isParamValid ? customOrders : orders;

      if (!listToExport || listToExport.length === 0) {
        Alert.alert('Sin Datos', 'No hay pedidos para exportar.');
        return;
      }

      const formattedData = listToExport.flatMap(o => {
        if (o.type === 'GROUP_ORDER') {
          const g = o.groupInfo || {};
          return (o.estudiantes || []).map(s => ({
            'Nombre del Alumno': `${s.nombre || ''} ${s.apellido || ''}`.trim(),
            'Colegio': g.colegio || '',
            'Curso': g.curso || '',
            'Talla': s.talla || '',
            'Tipo Pedido': 'GRUPAL'
          }));
        } else {
          const p = o.personalInfo || {};
          return [{
            'Nombre del Alumno': `${p.nombre || ''} ${p.apellido || ''}`.trim(),
            'Colegio': p.colegio || '',
            'Curso': p.curso || '',
            'Talla': o.tallaElegida || '',
            'Tipo Pedido': 'INDIVIDUAL'
          }];
        }
      });

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([new Uint8Array(atob(base64).split("").map(c => c.charCodeAt(0)))], { type: 'application/octet-stream' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.xlsx`;
        link.click();
      } else {
        const fileUri = FileSystem.documentDirectory + `${fileName}.xlsx`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(fileUri);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Hubo un problema procesando el archivo de Excel.');
    }
  };

  const handleDeleteOrder = (id) => {
    Alert.alert('Eliminar Pedido', '¿Borrar este pedido?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => await deleteOrder(id) }
    ]);
  };

  const handleLogin = async () => {
    if (!emailInput || !passwordInput) return;
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      const userProfile = await getUserProfile(auth.currentUser.uid);
      if (userProfile?.role === 'admin' || emailInput === 'inzunzajuan202@gmail.com') {
        if (rememberMe) {
          await AsyncStorage.setItem('admin_email', emailInput);
          await AsyncStorage.setItem('admin_pass', passwordInput);
          await AsyncStorage.setItem('admin_remember', 'true');
        }
        setIsAuthenticated(true);
      }
    } catch (e) {
      Alert.alert('Acceso Denegado', 'Credenciales incorrectas.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const updateMeasurement = (size, field, value) => {
    setMeasurements(prev => ({ ...prev, [size]: { ...prev[size], [field]: value.replace(/[^0-9.,]/g, '') } }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await saveAdminSizes(measurements);
      Alert.alert('Éxito', 'Medidas guardadas.');
    } catch (e) {
      Alert.alert('Error', 'No se pudieron guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAppData = async () => {
    setIsSavingAppData(true);
    try {
      await saveAppData(appData);
      Alert.alert('Éxito', 'Configuración de la app guardada.');
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar.');
    } finally {
      setIsSavingAppData(false);
    }
  };

  const handleAddSchool = async () => {
    if (!newItemName.trim()) return;
    const newSchool = {
      nombre: newItemName.trim(),
      ciudad: newSchoolCity.trim() || 'N/A',
      comuna: newSchoolCommune.trim() || 'N/A'
    };
    const updatedSchools = [newSchool, ...appData.schools];
    const updatedData = { ...appData, schools: updatedSchools };
    setAppData(updatedData);
    setNewItemName('');
    setNewSchoolCity('');
    setNewSchoolCommune('');
    
    // PERSISTENCIA INMEDIATA
    await saveAppData(updatedData);
  };

  const handleRemoveSchool = async (index) => {
    const updatedSchools = appData.schools.filter((_, i) => i !== index);
    const updatedData = { ...appData, schools: updatedSchools };
    setAppData(updatedData);
    await saveAppData(updatedData);
  };

  const handleAddCourse = () => {
    if (!newItemName.trim()) return;
    setAppData({ ...appData, courses: [...appData.courses, newItemName.trim()] });
    setNewItemName('');
  };

  const handleRemoveCourse = (index) => {
    setAppData({ ...appData, courses: appData.courses.filter((_, i) => i !== index) });
  };

  const handleAddValidName = async () => {
    if (!newValidName.trim()) return;
    await saveValidName(newValidName);
    setNewValidName('');
  };

  const handleAddCommonName = async () => {
    if (!newCommonName.trim()) return;
    await saveCommonName(newCommonName);
    setNewCommonName('');
  };

  const handleAddCommonSurname = async () => {
    if (!newCommonSurname.trim()) return;
    await saveCommonSurname(newCommonSurname);
    setNewCommonSurname('');
  };

  const executeSeeding = async () => {
    setIsSeeding(true);
    try {
      const names = [
        "MATEO", "SANTIAGO", "BENJAMIN", "LUCAS", "LIAM", "AGUSTIN", "VICENTE", "MAXIMILIANO", "JOAQUIN", "GASPAR",
        "TOMAS", "JOSE", "JUAN", "LUIS", "CARLOS", "FRANCISCO", "ALONSO", "SEBASTIAN", "FACUNDO", "BASTIAN",
        "MARTIN", "NICOLAS", "JAVIER", "DIEGO", "MATIAS", "IGNACIO", "FELIPE", "GABRIEL", "RODRIGO", "ALVARO",
        "SOFIA", "EMMA", "EMILIA", "ISABELLA", "JULIETA", "TRINIDAD", "ISIDORA", "AGUSTINA", "JOSEFA", "LUCIANA",
        "AMANDA", "ANTONIA", "FLORENCIA", "VALENTINA", "MARTINA", "MARIA", "ANA", "ELSA", "CARMEN", "PATRICIA"
      ];
      const surnames = [
        "GONZALEZ", "MUÑOZ", "ROJAS", "DIAZ", "PEREZ", "SOTO", "CONTRERAS", "SILVA", "MARTINEZ", "SEPULVEDA",
        "MORALES", "RODRIGUEZ", "LOPEZ", "FUENTES", "HERNANDEZ", "TORRES", "ARAYA", "FLORES", "CASTILLO", "ESPINOZA",
        "VALENZUELA", "CASTRO", "REYES", "GUTIERREZ", "PIZARRO", "VASQUEZ", "TAPIA", "SANCHEZ", "VERA", "JARA"
      ];

      const success = await seedDictionaryBatch(names, surnames);
      if (success) {
        Alert.alert('Éxito', 'Diccionario base cargado correctamente.');
      } else {
        Alert.alert('Error', 'Fallo al cargar el diccionario.');
      }
    } catch (e) {
      Alert.alert('Error', 'Fallo al cargar el diccionario.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSeedDictionary = () => {
    Alert.alert('Poblar Diccionario', '¿Deseas cargar los ~1000 nombres y apellidos iniciales? Esto puede tomar un momento.', [
      { text: 'Cancelar' },
      { text: 'Proceder', onPress: () => executeSeeding() }
    ]);
  };

  const handleResetAppData = () => {
    Alert.alert('Restablecer', '¿Restablecer a valores de fábrica?', [
      { text: 'Cancelar' },
      { text: 'Restablecer', style: 'destructive', onPress: async () => {
          const defaults = { schools: COLEGIOS_REALES, courses: CURSOS, regions: REGIONES, whatsappSupport: '+56900000000' };
          await saveAppData(defaults);
          setAppData(defaults);
      }}
    ]);
  };

  const handleAddTemplate = () => {
    if (!newTemplateText.trim()) return;
    const updatedTemplates = [...(appData.whatsappTemplates || []), newTemplateText.trim()];
    const updatedData = { ...appData, whatsappTemplates: updatedTemplates };
    setAppData(updatedData);
    setNewTemplateText('');
    saveAppData(updatedData);
  };

  const handleRemoveTemplate = (index) => {
    const updatedTemplates = (appData.whatsappTemplates || []).filter((_, i) => i !== index);
    const updatedData = { ...appData, whatsappTemplates: updatedTemplates };
    setAppData(updatedData);
    saveAppData(updatedData);
  };

  const sendWhatsAppMessage = (order, template) => {
    const phone = order.type === 'GROUP_ORDER' ? order.requesterInfo?.telefono : order.personalInfo?.telefono;
    if (!phone) {
      Alert.alert('Error', 'No se encontró el teléfono del cliente.');
      return;
    }

    let message = template;
    const name = order.type === 'GROUP_ORDER' ? order.requesterInfo?.nombre : order.personalInfo?.nombre;
    const school = order.type === 'GROUP_ORDER' ? order.groupInfo?.colegio : order.personalInfo?.school;
    const course = order.type === 'GROUP_ORDER' ? order.groupInfo?.curso : order.personalInfo?.course;

    message = message.replace(/\[NOMBRE\]/gi, name || '');
    message = message.replace(/\[COLEGIO\]/gi, school || '');
    message = message.replace(/\[CURSO\]/gi, course || '');

    const url = `whatsapp://send?phone=${phone.replace(/\+/g, '').replace(/\s/g, '')}&text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        const webUrl = `https://wa.me/${phone.replace(/\+/g, '').replace(/\s/g, '')}?text=${encodeURIComponent(message)}`;
        Linking.openURL(webUrl);
      }
    });
    setIsWhatsAppModalVisible(false);
  };

  const simulateNotification = async () => {
    const projectId = "c3f5b7d0-8b84-42fa-930e-45bb6d125037";
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title: '🛎️ Prueba', body: 'Conexión exitosa', sound: 'default' }),
    });
    Alert.alert('Prueba enviada');
  };

  if (isCheckingAuth) return <View style={styles.loginContainer}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  if (!isAuthenticated) {
    return (
      <View style={styles.loginContainer}>
        <Text style={styles.loginTitle}>Admin Panel</Text>
        <TextInput style={styles.loginInput} placeholder="Correo Electrónico" placeholderTextColor="#6B7280" value={emailInput} onChangeText={setEmailInput} autoCapitalize="none" />
        <TextInput style={styles.loginInput} placeholder="Contraseña" placeholderTextColor="#6B7280" value={passwordInput} onChangeText={setPasswordInput} secureTextEntry />
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={isLoggingIn}>
          {isLoggingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Entrar</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  const sortedOrdersForRender = [...orders].sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        {['tallas', 'configApp', 'pedidos', 'encargados'].map(tab => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.testBtn} onPress={simulateNotification}><Text style={{color: '#fff', fontSize: 10}}>🔔 Test</Text></TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'tallas' && (
          <View>
            <View style={styles.configCard}>
              <Text style={styles.configTitle}>➕ Nueva Talla</Text>
              <View style={styles.addInputRow}>
                <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} placeholder="Ej: XXL" value={newSizeName} onChangeText={setNewSizeName} />
                <TouchableOpacity style={styles.addButton} onPress={handleAddSize}><Plus color="#fff" size={24} /></TouchableOpacity>
              </View>
            </View>
            {Object.keys(measurements).map(size => (
              <View key={size} style={styles.sizeCard}>
                <View style={styles.sizeHeader}>
                  <View style={styles.sizeBadge}><Text style={styles.sizeBadgeText}>{size}</Text></View>
                  <Text style={styles.sizeTitle}>Talla {size}</Text>
                  <TouchableOpacity style={{marginLeft: 'auto'}} onPress={() => handleDeleteSize(size)}><Trash2 color="#EF4444" size={20} /></TouchableOpacity>
                </View>
                <View style={styles.inputsRow}>
                   {['pecho', 'largo', 'manga'].map(f => (
                     <View key={f} style={styles.inputGroup}>
                        <Text style={styles.label}>{f.toUpperCase()}</Text>
                        <TextInput style={styles.input} keyboardType="numeric" value={String(measurements[size][f] || '')} onChangeText={v => updateMeasurement(size, f, v)} />
                     </View>
                   ))}
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.saveButton} onPress={saveSettings} disabled={isSaving}>
               {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar Medidas</Text>}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'configApp' && (
          <View>
            <View style={styles.configCard}>
              <Text style={styles.configTitle}>💬 WhatsApp Soporte</Text>
              <TextInput style={styles.input} value={appData.whatsappSupport} onChangeText={t => setAppData({...appData, whatsappSupport: t})} />
              <TouchableOpacity style={[styles.saveButton, {marginTop: 10}]} onPress={handleSaveAppData}><Text style={styles.saveButtonText}>Guardar Config</Text></TouchableOpacity>
            </View>
            <View style={styles.configCard}>
              <Text style={styles.configTitle}>🏫 Colegios</Text>
              <View style={{ gap: 8, marginBottom: 12 }}>
                 <TextInput style={styles.input} placeholder="Nombre del Colegio" value={newItemName} onChangeText={setNewItemName} />
                 <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[styles.input, {flex: 1}]} placeholder="Ciudad" value={newSchoolCity} onChangeText={setNewSchoolCity} />
                    <TextInput style={[styles.input, {flex: 1}]} placeholder="Comuna" value={newSchoolCommune} onChangeText={setNewSchoolCommune} />
                 </View>
                 <TouchableOpacity style={[styles.saveButton, {backgroundColor: '#3B82F6'}]} onPress={handleAddSchool}>
                    <Plus color="#fff" size={20} style={{marginRight: 8}} />
                    <Text style={styles.saveButtonText}>Agregar Colegio</Text>
                 </TouchableOpacity>
              </View>
              {appData.schools.slice(0, 10).map((s, i) => (
                <View key={i} style={styles.listItem}>
                  <View style={{flex: 1}}>
                    <Text style={styles.listItemText}>{typeof s === 'string' ? s : s.nombre}</Text>
                    {typeof s === 'object' && (
                      <Text style={{color: '#9CA3AF', fontSize: 11}}>{s.ciudad}, {s.comuna}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveSchool(i)}><X color="#EF4444" size={18} /></TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.configCard}>
              <Text style={styles.configTitle}>👤 Diccionario Global: Nombres</Text>
              <View style={styles.addInputRow}>
                 <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} placeholder="Nuevo Nombre Común" value={newCommonName} onChangeText={setNewCommonName} />
                 <TouchableOpacity style={styles.addButton} onPress={handleAddCommonName}><Plus color="#fff" size={24} /></TouchableOpacity>
              </View>
              <View style={styles.tagsContainer}>
                {commonNames.slice(0, 50).map(name => (
                  <View key={name} style={[styles.tag, {backgroundColor: '#10B981'}]}>
                    <Text style={styles.tagText}>{name}</Text>
                    <TouchableOpacity onPress={() => deleteCommonName(name)}><X color="#fff" size={14} /></TouchableOpacity>
                  </View>
                ))}
              </View>
              {commonNames.length > 50 && <Text style={{color: '#9CA3AF', fontSize: 10, marginTop: 8}}>Y {commonNames.length - 50} más...</Text>}
            </View>

            <View style={styles.configCard}>
              <Text style={styles.configTitle}>👤 Diccionario Global: Apellidos</Text>
              <View style={styles.addInputRow}>
                 <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} placeholder="Nuevo Apellido Común" value={newCommonSurname} onChangeText={setNewCommonSurname} />
                 <TouchableOpacity style={styles.addButton} onPress={handleAddCommonSurname}><Plus color="#fff" size={24} /></TouchableOpacity>
              </View>
              <View style={styles.tagsContainer}>
                {commonSurnames.slice(0, 50).map(sn => (
                  <View key={sn} style={[styles.tag, {backgroundColor: '#F59E0B'}]}>
                    <Text style={styles.tagText}>{sn}</Text>
                    <TouchableOpacity onPress={() => deleteCommonSurname(sn)}><X color="#fff" size={14} /></TouchableOpacity>
                  </View>
                ))}
              </View>
              {commonSurnames.length > 50 && <Text style={{color: '#9CA3AF', fontSize: 10, marginTop: 8}}>Y {commonSurnames.length - 50} más...</Text>}
            </View>

            <View style={styles.configCard}>
              <Text style={styles.configTitle}>🎓 Identidades Específicas (Alumnos)</Text>
              <View style={styles.addInputRow}>
                 <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} placeholder="Nombre Alumno Autorizado" value={newValidName} onChangeText={setNewValidName} />
                 <TouchableOpacity style={styles.addButton} onPress={handleAddValidName}><Plus color="#fff" size={24} /></TouchableOpacity>
              </View>
              <View style={styles.tagsContainer}>
                {validNames.map(name => (
                  <View key={name} style={styles.tag}>
                    <Text style={styles.tagText}>{name}</Text>
                    <TouchableOpacity onPress={() => deleteValidName(name)}><X color="#fff" size={14} /></TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.configCard}>
              <Text style={styles.configTitle}>📝 Plantillas de WhatsApp</Text>
              <View style={[styles.addInputRow, {flexDirection: 'column', alignItems: 'stretch'}]}>
                 <TextInput 
                   style={[styles.input, {marginBottom: 8, height: 80}]} 
                   placeholder="Ej: Hola [NOMBRE], tu pedido está listo." 
                   placeholderTextColor="#6B7280"
                   multiline
                   value={newTemplateText} 
                   onChangeText={setNewTemplateText} 
                 />
                 <TouchableOpacity style={[styles.addButton, {width: '100%'}]} onPress={handleAddTemplate}>
                    <Text style={{color: '#fff', fontWeight: 'bold'}}>Añadir Plantilla</Text>
                 </TouchableOpacity>
              </View>
              <View style={{marginTop: 10}}>
                {(appData.whatsappTemplates || []).map((template, i) => (
                  <View key={i} style={[styles.listItem, {alignItems: 'flex-start'}]}>
                    <Text style={[styles.listItemText, {flex: 1, marginRight: 8, fontSize: 12}]}>{template}</Text>
                    <TouchableOpacity onPress={() => handleRemoveTemplate(i)}><Trash2 color="#EF4444" size={16} /></TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, {backgroundColor: '#6366F1', marginTop: 10, marginBottom: 16}]} 
              onPress={handleSeedDictionary}
              disabled={isSeeding}
            >
              {isSeeding ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Poblar Diccionario Inicial (Auto)</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveButton, {backgroundColor: '#374151'}]} onPress={handleResetAppData}><Text style={styles.saveButtonText}>Restablecer Todo</Text></TouchableOpacity>
          </View>
        )}

        {activeTab === 'pedidos' && (
          <View>
             <TouchableOpacity style={styles.exportButton} onPress={() => exportToExcel()}><Download color="#fff" size={20} /><Text style={styles.exportButtonText}>Exportar Todo</Text></TouchableOpacity>
            {sortedOrdersForRender.map(order => (
              <View key={order.id} style={styles.orderCard}>
                 <View style={styles.orderHeaderRow}>
                    <Text style={styles.orderName}>{order.type === 'GROUP_ORDER' ? 'GRUPAL' : order.personalInfo?.nombre}</Text>
                    <View style={{flexDirection: 'row', gap: 15, marginLeft: 'auto'}}>
                       <TouchableOpacity onPress={() => { setSelectedOrderForWhatsApp(order); setIsWhatsAppModalVisible(true); }}>
                          <MessageCircle color="#3B82F6" size={22} />
                       </TouchableOpacity>
                       <TouchableOpacity onPress={() => handleDeleteOrder(order.id)}>
                          <Trash2 color="#EF4444" size={20} />
                       </TouchableOpacity>
                    </View>
                 </View>
                 <Text style={styles.orderDate}>{new Date(order.date).toLocaleString()}</Text>
                 <Text style={styles.listItemText}>{order.personalInfo?.school || order.groupInfo?.colegio}</Text>
              </View>
            ))}

            {/* Modal de Respuestas Rápidas */}
            {isWhatsAppModalVisible && (
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Respuestas Rápidas</Text>
                    <TouchableOpacity onPress={() => setIsWhatsAppModalVisible(false)}><X color="#9CA3AF" size={24} /></TouchableOpacity>
                  </View>
                  <ScrollView style={{maxHeight: 300}}>
                    {(appData.whatsappTemplates || []).map((template, idx) => (
                      <TouchableOpacity key={idx} style={styles.templateOption} onPress={() => sendWhatsAppMessage(selectedOrderForWhatsApp, template)}>
                        <Text style={styles.templateOptionText}>{template}</Text>
                        <ChevronRight color="#4B5563" size={16} />
                      </TouchableOpacity>
                    ))}
                    {(appData.whatsappTemplates || []).length === 0 && (
                      <Text style={{color: '#9CA3AF', textAlign: 'center', marginVertical: 20}}>No hay plantillas configuradas.</Text>
                    )}
                  </ScrollView>
                  <Text style={{color: '#6B7280', fontSize: 10, marginTop: 10, textAlign: 'center'}}>
                    Tip: Usa [NOMBRE], [COLEGIO] o [CURSO] en tus plantillas.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {activeTab === 'encargados' && (
          <View>
             {managers.map(m => (
               <View key={m.id} style={styles.sizeCard}>
                  <Text style={{color: '#fff', fontWeight: 'bold'}}>{m.nombre}</Text>
                  <Text style={{color: '#9CA3AF'}}>{m.email}</Text>
                  <Text style={{color: '#3B82F6'}}>{m.school} - {m.course}</Text>
               </View>
             ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  tabsContainer: { flexDirection: 'row', backgroundColor: '#1F2937', paddingHorizontal: 16, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: '#374151' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#3B82F6' },
  tabText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  activeTabText: { color: '#3B82F6' },
  content: { padding: 20, paddingBottom: 100 },
  configCard: { backgroundColor: '#1F2937', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  configTitle: { color: '#E5E7EB', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  addInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  input: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151', borderRadius: 8, padding: 12, color: '#F9FAFB' },
  addButton: { backgroundColor: '#3B82F6', borderRadius: 8, padding: 10, justifyContent: 'center', alignItems: 'center' },
  saveButton: { backgroundColor: '#10B981', borderRadius: 12, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
  sizeCard: { backgroundColor: '#1F2937', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  sizeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sizeBadge: { backgroundColor: '#374151', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  sizeBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  sizeTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  inputsRow: { flexDirection: 'row', gap: 10 },
  inputGroup: { flex: 1 },
  label: { color: '#9CA3AF', fontSize: 10, marginBottom: 4 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#374151' },
  listItemText: { color: '#D1D5DB' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: { backgroundColor: '#3B82F6', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
  tagText: { color: '#fff', fontSize: 12 },
  loginContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', padding: 24 },
  loginTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 30 },
  loginInput: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, color: '#fff', marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  loginButton: { backgroundColor: '#3B82F6', borderRadius: 12, padding: 16, alignItems: 'center' },
  loginButtonText: { color: '#fff', fontWeight: 'bold' },
  exportButton: { backgroundColor: '#10B981', padding: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15, gap: 8 },
  exportButtonText: { color: '#fff', fontWeight: 'bold' },
  orderCard: { backgroundColor: '#1F2937', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#374151' },
  orderName: { color: '#fff', fontWeight: 'bold' },
  orderDate: { color: '#9CA3AF', fontSize: 12 },
  testBtn: { position: 'absolute', top: 10, right: 10, zIndex: 10, backgroundColor: '#374151', padding: 6, borderRadius: 10 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20, zIndex: 1000 },
  modalContent: { backgroundColor: '#1F2937', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#374151' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  templateOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#374151' },
  templateOptionText: { color: '#E5E7EB', flex: 1, fontSize: 13 },
});
