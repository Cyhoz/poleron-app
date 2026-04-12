import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Save, Trash2, Download, Plus, X, ChevronRight, ChevronDown } from 'lucide-react-native';
import { REGIONES, CURSOS, COLEGIOS_REALES } from '../constants/chileData';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as XLSX from 'xlsx';
import { getOrders, deleteOrder, saveAdminSizes, getAdminSizes, saveAdminPushToken, subscribeToOrders, saveAppData, getAppData, subscribeToAppData } from '../services/firebaseOrderService';
import { auth } from '../services/firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

const SIZES = ['16', 'S', 'M', 'L', 'XL'];

export default function AdminScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState('tallas');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setIsCheckingAuth(false);
    });
    return unsubscribe;
  }, []);

  const [measurements, setMeasurements] = useState({
    '16': { pecho: '45', largo: '60', manga: '55' },
    'S': { pecho: '50', largo: '65', manga: '60' },
    'M': { pecho: '55', largo: '70', manga: '65' },
    'L': { pecho: '60', largo: '75', manga: '70' },
    'XL': { pecho: '65', largo: '80', manga: '75' },
  });
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
      unsubscribeOrders = subscribeToOrders((data) => {
        setOrders(data);
        setIsLoadingOrders(false);
      });

      registerForPushNotificationsAsync().then(token => {
        if (token) saveAdminPushToken(token);
      });
    }

    return () => {
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    // onSnapshot is handling updates, no need to reload manually
  }, [activeTab]);

  async function registerForPushNotificationsAsync() {
    let token;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
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
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } catch (e) { console.log(e); }
    }
    return token;
  }

  const loadMeasurements = async () => {
    const data = await getAdminSizes();
    if (data) Object.keys(data).length > 0 && setMeasurements(data);
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
        const pA = a.personalInfo || {};
        const pB = b.personalInfo || {};
        if ((pA.region || '').toLowerCase() !== (pB.region || '').toLowerCase()) return (pA.region || '').localeCompare(pB.region || '');
        if ((pA.ciudad || '').toLowerCase() !== (pB.ciudad || '').toLowerCase()) return (pA.ciudad || '').localeCompare(pB.ciudad || '');
        if ((pA.comuna || '').toLowerCase() !== (pB.comuna || '').toLowerCase()) return (pA.comuna || '').localeCompare(pB.comuna || '');
        if ((pA.colegio || '').toLowerCase() !== (pB.colegio || '').toLowerCase()) return (pA.colegio || '').localeCompare(pB.colegio || '');
        if ((pA.curso || '').toLowerCase() !== (pB.curso || '').toLowerCase()) return (pA.curso || '').localeCompare(pB.curso || '');
        return 0;
      });

      const formattedData = sortedExport.map(o => {
        const p = o.personalInfo || {};
        return {
          'Nombre del Alumno': `${p.nombre || ''} ${p.apellido || ''}`.trim(),
          'Colegio': p.colegio || '',
          'Region': p.region || '',
          'Ciudad': p.ciudad || '',
          'Apodo': p.apodo || '',
          'Talla': o.tallaElegida || ''
        };
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
        { wch: 20 }, // Region
        { wch: 20 }, // Ciudad
        { wch: 20 }, // Apodo
        { wch: 15 }  // Talla
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
      setIsAuthenticated(true);
    } catch (e) {
      console.log('Login error:', e);
      Alert.alert('Acceso Denegado', 'El correo o la contraseña son incorrectos. Verifica en Firebase Authentication.');
      setPasswordInput('');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const updateMeasurement = (size, field, value) => {
    setMeasurements(prev => ({ ...prev, [size]: { ...prev[size], [field]: value.replace(/[^0-9.,]/g, '') } }));
  };

  const saveSettings = async () => {
    let isValid = true;
    for (const size of SIZES) {
      const p = parseFloat(String(measurements[size].pecho).replace(',', '.'));
      const l = parseFloat(String(measurements[size].largo).replace(',', '.'));
      const m = parseFloat(String(measurements[size].manga).replace(',', '.'));

      if (isNaN(p) || p <= 0 || isNaN(l) || l <= 0 || isNaN(m) || m <= 0) {
        isValid = false;
        break;
      }
    }

    if (!isValid) {
      Alert.alert('Medidas Inválidas', 'Todas las medidas deben ser numéricas y mayores a 0. Verifica no haber dejado campos vacíos ni letras.');
      return;
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
      </View>

      {activeTab === 'tallas' ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.headerSubtitle}>
              Define las medidas estándar. Todos los teléfonos de los alumnos leerán estos datos.
            </Text>

            {SIZES.map((size) => (
              <View key={size} style={styles.sizeCard}>
                <View style={styles.sizeHeader}>
                  <View style={styles.sizeBadge}>
                    <Text style={styles.sizeBadgeText}>{size}</Text>
                  </View>
                  <Text style={styles.sizeTitle}>Talla {size}</Text>
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
              const prev = index > 0 ? sortedOrdersForRender[index - 1].personalInfo : null;
              const curr = order.personalInfo || {};

              const showLocation = !prev || prev.region?.toLowerCase() !== curr.region?.toLowerCase() || prev.ciudad?.toLowerCase() !== curr.ciudad?.toLowerCase() || prev.comuna?.toLowerCase() !== curr.comuna?.toLowerCase();
              const showColegio = showLocation || prev.colegio?.toLowerCase() !== curr.colegio?.toLowerCase();
              const showCurso = showColegio || prev.curso?.toLowerCase() !== curr.curso?.toLowerCase();

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
                      <View style={styles.orderUserBadge}>
                        <Text style={styles.orderUserLetter}>{(curr.nombre || 'A').charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.orderUserTexts}>
                        <Text style={styles.orderName}>{curr.nombre || 'Sin Nombre'} {curr.apellido || ''}</Text>
                        <Text style={styles.orderDate}>{dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString()}</Text>
                      </View>
                      <TouchableOpacity style={styles.deleteOrderBtn} onPress={() => handleDeleteOrder(order.id)}>
                        <Trash2 color="#EF4444" size={20} />
                      </TouchableOpacity>
                    </View>

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
