import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Save, Trash2, Download } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as XLSX from 'xlsx-js-style';
import { getOrders, deleteOrder, saveAdminSizes, getAdminSizes, saveAdminPushToken } from '../services/firebaseOrderService';
import { auth } from '../services/firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

  useEffect(() => {
    if (isAuthenticated) {
      loadMeasurements();
      loadOrders();
      registerForPushNotificationsAsync().then(token => {
        if (token) saveAdminPushToken(token);
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeTab === 'pedidos') {
      loadOrders();
    }
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
    setIsLoadingOrders(true);
    const data = await getOrders();
    setOrders(data);
    setIsLoadingOrders(false);
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
          'Nombre del Alumno': p.nombre || '',
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
          const cell_address = {c:C, r:R};
          const cell_ref = XLSX.utils.encode_cell(cell_address);
          if (!ws[cell_ref]) ws[cell_ref] = { t: "s", v: "" };
          ws[cell_ref].s = {
            border: {
              top: {style: "thin", color: {rgb: "000000"}},
              bottom: {style: "thin", color: {rgb: "000000"}},
              left: {style: "thin", color: {rgb: "000000"}},
              right: {style: "thin", color: {rgb: "000000"}}
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
          const success = await deleteOrder(id);
          if (success) loadOrders();
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
    setMeasurements(prev => ({ ...prev, [size]: { ...prev[size], [field]: value } }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await saveAdminSizes(measurements);
      Alert.alert('Éxito', 'Las medidas predeterminadas han sido guardadas en Firebase.');
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
        <Text style={styles.loginTitle}>Bóveda Firebase</Text>
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
        <TouchableOpacity style={[styles.tab, activeTab === 'pedidos' && styles.activeTab]} onPress={() => setActiveTab('pedidos')}>
          <Text style={[styles.tabText, activeTab === 'pedidos' && styles.activeTabText]}>Ver Pedidos ({orders.length})</Text>
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
                    <TextInput style={styles.input} keyboardType="numeric" value={measurements[size].pecho} onChangeText={(val) => updateMeasurement(size, 'pecho', val)} />
                  </View>
                  <View style={styles.spacer} />
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Largo (cm)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={measurements[size].largo} onChangeText={(val) => updateMeasurement(size, 'largo', val)} />
                  </View>
                  <View style={styles.spacer} />
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Mangas (cm)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={measurements[size].manga || ''} onChangeText={(val) => updateMeasurement(size, 'manga', val)} />
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
                  <Text style={styles.saveButtonText}>Guardar Pedido</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
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
                    <View style={styles.sectionHeaderColegio}>
                      <Text style={styles.sectionHeaderTextColegio}>🏫 Colegio: {curr.colegio || 'Sin Especificar'}</Text>
                      <TouchableOpacity onPress={() => {
                        const schoolFileName = `Pedidos_Colegio_${curr.colegio || 'General'}`;
                        exportToExcel(orders.filter(o => o.personalInfo?.colegio === curr.colegio && o.personalInfo?.region === curr.region && o.personalInfo?.ciudad === curr.ciudad), schoolFileName);
                      }}>
                        <Download color="#fff" size={20} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {showCurso && (
                    <View style={styles.sectionHeaderCurso}>
                      <Text style={styles.sectionHeaderTextCurso}>📚 Curso: {curr.curso || 'Sin Especificar'}</Text>
                      <TouchableOpacity onPress={() => {
                        const courseFileName = `Pedidos_Colegio_${curr.colegio || 'General'}_Curso_${curr.curso || 'Extra'}`;
                        exportToExcel(orders.filter(o => o.personalInfo?.curso === curr.curso && o.personalInfo?.colegio === curr.colegio), courseFileName);
                      }}>
                        <Download color="#9CA3AF" size={18} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.orderCard}>
                    <View style={styles.orderHeaderRow}>
                      <View style={styles.orderUserBadge}>
                        <Text style={styles.orderUserLetter}>{(curr.nombre || 'A').charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.orderUserTexts}>
                        <Text style={styles.orderName}>{curr.nombre || 'Sin Nombre'}</Text>
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
});
