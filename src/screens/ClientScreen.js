import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, 
  Alert, ActivityIndicator, Vibration, Platform, Modal, FlatList, Image 
} from 'react-native';
import { Image as ImageIcon, UploadCloud, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { REGIONES, CURSOS, COLEGIOS_REALES } from '../constants/chileData';
import { 
  saveOrder, getAdminSizes, checkExistingOrder, subscribeToAppData, 
  getProducts, initiatePayment 
} from '../services/firebaseOrderService';
import { auth } from '../services/firebaseConfig';

const SIZES = ['16', 'S', 'M', 'L', 'XL'];
const API_BASE_URL = 'https://poleron-app-2.onrender.com';

export default function ClientScreen({ navigation }) {
  const [step, setStep] = useState(0); // 0: Catalog, 1: Measurements, 2: Info/Payment
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  const [measurements, setMeasurements] = useState({ pecho: '', largo: '', manga: '' });
    nombre: '', apellido: '', colegio: '', curso: '', apodo: '', 
    region: '', ciudad: '', comuna: '', pais: 'Chile',
  });
  const [quantity, setQuantity] = useState(6); // Default 6

  const [recommendedSize, setRecommendedSize] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [designImage, setDesignImage] = useState(null); // PNG model

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentToken, setPaymentToken] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState(null);

  // Modals
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showCommuneModal, setShowCommuneModal] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [showSchoolResults, setShowSchoolResults] = useState(false);
  const [filteredSchools, setFilteredSchools] = useState([]);

  const [appData, setAppData] = useState({ schools: COLEGIOS_REALES, courses: CURSOS, regions: REGIONES });
  const [adminSizes, setAdminSizes] = useState(null);

  useEffect(() => {
    // Verificar si hay sesión
    if (!auth.currentUser) {
        Alert.alert('Sesión Requerida', 'Debes iniciar sesión para realizar un pedido.');
        navigation.replace('Auth');
        return;
    }

    const initData = async () => {
        setIsLoading(true);
        const [prodList, sizes] = await Promise.all([getProducts(), getAdminSizes()]);
        setProducts(prodList);
        setAdminSizes(sizes || {
            '16': { pecho: 45, largo: 60, manga: 55 },
            'S': { pecho: 50, largo: 65, manga: 60 },
            'M': { pecho: 55, largo: 70, manga: 65 },
            'L': { pecho: 60, largo: 75, manga: 70 },
            'XL': { pecho: 65, largo: 80, manga: 75 },
        });
        setIsLoading(false);
    };

    const unsubApp = subscribeToAppData(data => data && setAppData(data));
    initData();
    return () => unsubApp();
  }, []);

  const updatePersonalInfo = (field, value) => {
    let filteredValue = value;
    if (field === 'nombre' || field === 'apellido' || field === 'ciudad') {
      filteredValue = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    } else if (field === 'colegio') {
      filteredValue = value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.-]/g, '');
    }

    setPersonalInfo(prev => {
      const updated = { ...prev, [field]: filteredValue };
      if (field === 'region') {
        updated.comuna = ''; updated.ciudad = '';
      }
      return updated;
    });
  };

  const handleSchoolSearch = (text) => {
    const filtered = text.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.-]/g, '');
    setSchoolSearch(filtered);
    updatePersonalInfo('colegio', filtered);
    if (text.length > 2) {
      fetch(`${API_BASE_URL}/api/schools?query=${text}&limit=10`)
        .then(res => res.json())
        .then(data => {
          setFilteredSchools(data.map(s => s.nombre));
          setShowSchoolResults(true);
        })
        .catch(err => console.error('Error buscando colegios:', err));
    } else {
      setShowSchoolResults(false);
    }
  };

  const calculateSize = () => {
    if (!measurements.pecho || !measurements.largo || !measurements.manga) {
      Alert.alert('Error', 'Ingresa todas las medidas.');
      return;
    }
    const p = parseFloat(measurements.pecho.replace(',', '.'));
    const l = parseFloat(measurements.largo.replace(',', '.'));
    const m = parseFloat(measurements.manga.replace(',', '.'));
    
    let found = 'XL';
    for (const size of SIZES) {
      const config = adminSizes[size] || {};
      if (config.pecho >= p - 1 && config.largo >= l - 1 && config.manga >= m - 1) {
        found = size; break;
      }
    }
    setRecommendedSize(found);
    setSelectedSize(found);
    setStep(2);
  };

  const pickDesign = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
    });

    if (!result.canceled) {
        setDesignImage(result.assets[0]);
    }
  };

  const startPayment = async () => {
    const { nombre, apellido } = personalInfo;
    if (!nombre || !apellido || nombre.length < 2 || apellido.length < 2) {
        Alert.alert('Error', 'Completa tus nombres reales antes de pagar.');
        return;
    }

    setIsSubmitting(true);
    const validName = await isRealName(nombre);
    if (!validName) {
        setIsSubmitting(false);
        Alert.alert('Nombre Inválido', 'Por favor ingresa un nombre real (ej: Juan, María).');
        return;
    }
    const validSurname = await isRealName(apellido);
    if (!validSurname) {
        setIsSubmitting(false);
        Alert.alert('Apellido Inválido', 'Por favor ingresa un apellido real.');
        return;
    }

    if (!designImage) {
        Alert.alert('Diseño Requerido', 'Debes adjuntar el modelo (PNG/JPG) del polerón para continuar.');
        return;
    }

    if (quantity < 6) {
        Alert.alert('Pedido Mínimo', 'La cantidad mínima es de 6 polerones para grupos.');
        return;
    }

    setIsSubmitting(true);
    const totalAmount = selectedProduct.montoReserva * quantity;
    const buyOrder = "ORD-" + Math.floor(Math.random() * 100000);
    const sessionId = "SESS-" + Math.floor(Math.random() * 1000000);
    
    const response = await initiatePayment(totalAmount, buyOrder, sessionId);
    setIsSubmitting(false);

    if (response && response.token && response.url) {
        setPaymentToken(response.token);
        setPaymentUrl(response.url);
        setShowPaymentModal(true);
    } else {
        Alert.alert('Error', 'No se pudo conectar con Webpay. Intenta más tarde.');
    }
  };

  const handleWebViewStateChange = (navState) => {
    // Si la URL contiene /api/pay/confirm, es que Transbank ya retornó al backend
    if (navState.url.includes('/api/pay/confirm')) {
        // En un flujo real, aquí cerraríamos y verificaríamos con el backend
        // Para esta demo, asumimos éxito tras la redirección si no hay error explícito
        setTimeout(() => {
            setShowPaymentModal(false);
            submitFinalOrder();
        }, 3000);
    }
  };

  const submitFinalOrder = async () => {
    setIsSubmitting(true);
    const orderData = {
        personalInfo,
        medidas: measurements,
        tallaRecomendada: recommendedSize,
        tallaElegida: selectedSize,
        producto: selectedProduct.nombre,
        cantidad: quantity,
        montoPagado: selectedProduct.montoReserva * quantity,
        disenoBase64: designImage?.base64,
        userId: auth.currentUser.uid, // Vincular el pedido al usuario logueado
        userEmail: auth.currentUser.email,
        status: 'PAID'
    };

    const success = await saveOrder(orderData);
    setIsSubmitting(false);
    if (success) setIsDone(true);
  };

  if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  if (isDone) return (
    <View style={styles.centered}>
      <Text style={styles.headerTitle}>¡Compra Exitosa!</Text>
      <Text style={styles.resultDescription}>Tu polerón ha sido reservado. Recibirás un correo con los detalles.</Text>
      <TouchableOpacity style={styles.submitButton} onPress={() => setIsDone(false)}><Text style={styles.submitButtonText}>Volver</Text></TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {step === 0 && (
        <View>
          <Text style={styles.headerTitle}>Nuestra Tienda</Text>
          <Text style={styles.headerSubtitle}>Elige el plan ideal para tu generación.</Text>
          {products.map(p => (
            <TouchableOpacity key={p.id} style={styles.productCard} onPress={() => { setSelectedProduct(p); setStep(1); }}>
              <Image source={{ uri: p.imagen }} style={styles.productImage} />
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{p.nombre}</Text>
                <Text style={styles.productDesc}>{p.descripcion}</Text>
                <View style={styles.priceTag}>
                    <Text style={styles.totalPrice}>Total: ${p.precioTotal.toLocaleString()}</Text>
                    <Text style={styles.reservePrice}>Reserva hoy: ${p.montoReserva.toLocaleString()}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {step === 1 && (
        <View>
          <Text style={styles.headerTitle}>Tus Medidas</Text>
          <Text style={styles.headerSubtitle}>Medidas para tu: {selectedProduct.nombre}</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pecho (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.pecho} onChangeText={t => setMeasurements({...measurements, pecho: t})} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Largo (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.largo} onChangeText={t => setMeasurements({...measurements, largo: t})} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Manga (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.manga} onChangeText={t => setMeasurements({...measurements, manga: t})} />
          </View>
          <TouchableOpacity style={styles.submitButton} onPress={calculateSize}><Text style={styles.submitButtonText}>Siguiente</Text></TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View style={styles.resultContainer}>
          <Text style={styles.confirmTitle}>Resumen del Pedido</Text>
          <View style={styles.sizeBadge}><Text style={styles.sizeText}>{selectedSize}</Text></View>
          
          <View style={styles.quantityControl}>
            <Text style={styles.label}>Cantidad de Polerones (Mín. 6):</Text>
            <View style={styles.quantityRow}>
                <TouchableOpacity 
                    style={[styles.qBtn, quantity <= 6 && { opacity: 0.5 }]} 
                    onPress={() => setQuantity(Math.max(6, quantity - 1))}
                    disabled={quantity <= 6}
                >
                    <Text style={styles.qBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qValue}>{quantity}</Text>
                <TouchableOpacity 
                    style={styles.qBtn} 
                    onPress={() => setQuantity(quantity + 1)}
                >
                    <Text style={styles.qBtnText}>+</Text>
                </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.imageUploadBox}>
            <Text style={styles.label}>Modelo del Polerón (PNG):</Text>
            {designImage ? (
                <View style={styles.previewContainer}>
                    <Image source={{ uri: designImage.uri }} style={styles.designPreview} />
                    <TouchableOpacity style={styles.removeImgBtn} onPress={() => setDesignImage(null)}>
                        <X color="#fff" size={16} />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={styles.uploadBtn} onPress={pickDesign}>
                    <UploadCloud color="#38BDF8" size={32} />
                    <Text style={styles.uploadText}>Subir Modelo PNG</Text>
                </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 5 }}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput style={styles.input} value={personalInfo.nombre} onChangeText={v => updatePersonalInfo('nombre', v)} />
            </View>
            <View style={{ flex: 1, marginLeft: 5 }}>
                <Text style={styles.label}>Apellido</Text>
                <TextInput style={styles.input} value={personalInfo.apellido} onChangeText={v => updatePersonalInfo('apellido', v)} />
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.priceLabel}>Monto total a pagar ({quantity} unidades):</Text>
          <Text style={styles.priceAmount}>${(selectedProduct.montoReserva * quantity).toLocaleString()}</Text>

          <TouchableOpacity style={[styles.submitButton, { backgroundColor: '#3B82F6', width: '100%' }]} onPress={startPayment}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Pagar con Webpay</Text>}
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showPaymentModal} animationType="slide">
        <View style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Pago Seguro Webpay</Text>
                <TouchableOpacity onPress={() => setShowPaymentModal(false)}><Text style={{ color: '#fff' }}>Cancelar</Text></TouchableOpacity>
            </View>
            <WebView 
                source={{ 
                    uri: paymentUrl, 
                    method: 'POST', 
                    body: `token_ws=${paymentToken}` 
                }}
                onNavigationStateChange={handleWebViewStateChange}
            />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 10 },
  headerSubtitle: { fontSize: 16, color: '#94A3B8', marginBottom: 30 },
  productCard: { backgroundColor: '#1E293B', borderRadius: 20, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  productImage: { width: '100%', height: 200 },
  productInfo: { padding: 20 },
  productName: { fontSize: 20, fontWeight: 'bold', color: '#F1F5F9', marginBottom: 5 },
  productDesc: { fontSize: 14, color: '#94A3B8', marginBottom: 15 },
  priceTag: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 15 },
  totalPrice: { fontSize: 14, color: '#64748B', textDecorationLine: 'line-through' },
  reservePrice: { fontSize: 18, fontWeight: 'bold', color: '#38BDF8' },
  inputGroup: { marginBottom: 20 },
  inputGroupFull: { width: '100%', marginBottom: 15 },
  label: { color: '#94A3B8', marginBottom: 8, fontSize: 14 },
  input: { backgroundColor: '#0F172A', color: '#F1F5F9', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  submitButton: { backgroundColor: '#3B82F6', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  resultContainer: { backgroundColor: '#1E293B', padding: 20, borderRadius: 20 },
  confirmTitle: { fontSize: 20, fontWeight: 'bold', color: '#F1F5F9', marginBottom: 20, textAlign: 'center' },
  sizeBadge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#3B82F6', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  sizeText: { fontSize: 30, fontWeight: 'bold', color: '#FFF' },
  divider: { h:1, backgroundColor: '#334155', marginVertical: 20 },
  priceLabel: { color: '#94A3B8', textAlign: 'center' },
  priceAmount: { fontSize: 32, fontWeight: 'bold', color: '#10B981', textAlign: 'center', marginBottom: 20 },
  modalHeader: { height: 60, backgroundColor: '#1E293B', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  modalTitle: { color: '#FFF', fontWeight: 'bold' },
  row: { flexDirection: 'row' },
  quantityControl: { marginBottom: 20, alignItems: 'center' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  qBtn: { backgroundColor: '#3B82F6', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  qBtnText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  qValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginHorizontal: 25 },
  imageUploadBox: { marginBottom: 25, width: '100%', alignItems: 'center' },
  uploadBtn: { width: '100%', height: 120, borderRadius: 16, borderStyle: 'dotted', borderWidth: 2, borderColor: '#334155', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  uploadText: { color: '#38BDF8', marginTop: 10, fontWeight: 'bold' },
  previewContainer: { width: '100%', height: 200, borderRadius: 16, overflow: 'hidden' },
  designPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImgBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(239, 68, 68, 0.8)', padding: 8, borderRadius: 20 },
});
