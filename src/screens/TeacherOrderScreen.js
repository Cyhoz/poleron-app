import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Modal, FlatList, Image, Linking
} from 'react-native';
import { UploadCloud, X, Plus, Trash2, ChevronDown, User, Phone, Mail, FileText, File, MessageCircle } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { REGIONES, CURSOS, COLEGIOS_REALES } from '../constants/chileData';
import {
  saveOrder, getAdminSizes, subscribeToAppData,
  getProducts, subscribeToValidNames, getUserProfile, getCalculatorResultsByCourse,
  normalizeName
} from '../services/firebaseOrderService';
import { auth } from '../services/firebaseConfig';

const SIZES = ['16', 'S', 'M', 'L', 'XL'];
const API_BASE_URL = 'https://poleron-app-2.onrender.com';

export default function TeacherOrderScreen({ navigation }) {
  const [step, setStep] = useState(0); // 0: Catalog, 1: Group Info, 2: Student Cart, 3: Confirmation
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Group Info
  const [groupInfo, setGroupInfo] = useState({
    colegio: '', curso: '', region: '', ciudad: '', comuna: '',
  });
  const [requesterInfo, setRequesterInfo] = useState({
    nombre: '', apellido: '', email: '', telefono: ''
  });
  const [designFiles, setDesignFiles] = useState([]);

  // Student Cart
  const [students, setStudents] = useState([]);
  const [currentStudent, setCurrentStudent] = useState({
    nombre: '', apellido: '', apodo: '', talla: 'S'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  // Modals / Dropdowns
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [filteredSchools, setFilteredSchools] = useState([]);
  const [showSchoolResults, setShowSchoolResults] = useState(false);
  const [validNames, setValidNames] = useState([]);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  useEffect(() => {
    if (!auth.currentUser) {
      Alert.alert('Sesión Requerida', 'Debes iniciar sesión para realizar un pedido grupal.');
      navigation.replace('Auth');
      return;
    }

    const initData = async () => {
      setIsLoading(true);
      const [prodList, profile] = await Promise.all([
        getProducts(),
        getUserProfile(auth.currentUser.uid)
      ]);
      
      setProducts(prodList);
      setUserProfile(profile);
      
      if (profile) {
        setGroupInfo({
          colegio: profile.school || '',
          curso: profile.course || '',
          region: '', ciudad: '', comuna: ''
        });
        setRequesterInfo({
          nombre: profile.nombre || '',
          apellido: '',
          email: profile.email || '',
          telefono: ''
        });
        setSchoolSearch(profile.school || '');
      }
      
      setIsLoading(false);
    };

    const unsubValidNames = subscribeToValidNames((names) => {
      setValidNames(names.map(n => normalizeName(n)));
    });

    const unsubWhatsApp = subscribeToAppData((data) => {
      if (data?.whatsappSupport) setWhatsappNumber(data.whatsappSupport);
    });

    initData();
    return () => {
      unsubValidNames();
      unsubWhatsApp();
    };
  }, [navigation]);

  const openSoporteWhatsApp = () => {
    const phone = whatsappNumber || '+56900000000';
    const msg = `Hola, soy el encargado de ${groupInfo.curso || 'mi curso'} (${groupInfo.colegio || 'mi colegio'}) y necesito ayuda con el pedido grupal en la app Polerón.`;
    const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(msg)}`);
    });
  };

  const updateGroupInfo = (field, value) => {
    setGroupInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleSchoolSearch = (text) => {
    setSchoolSearch(text);
    updateGroupInfo('colegio', text);
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

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets) {
        const newFiles = await Promise.all(result.assets.map(async (file) => {
          const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return {
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            uri: file.uri,
            base64: base64
          };
        }));
        setDesignFiles([...designFiles, ...newFiles]);
      }
    } catch (err) {
      console.error('Error seleccionando archivos:', err);
      Alert.alert('Error', 'No se pudieron cargar los archivos.');
    }
  };

  const removeFile = (index) => {
    setDesignFiles(designFiles.filter((_, i) => i !== index));
  };

  const addStudent = () => {
    if (!currentStudent.nombre || !currentStudent.apellido) {
      Alert.alert('Error', 'Nombre y Apellido son obligatorios.');
      return;
    }
    if (validNames.length > 0) {
      const fullName = `${currentStudent.nombre} ${currentStudent.apellido}`;
      const nameToCheck = normalizeName(fullName);
      
      if (!validNames.includes(nameToCheck)) {
        Alert.alert(
          'Nombre No Autorizado', 
          `El nombre "${fullName}" no está en la lista oficial. Solo puedes agregar alumnos autorizados por la administración.`
        );
        return;
      }
    }
    setStudents([...students, { ...currentStudent, id: Date.now().toString() }]);
    setCurrentStudent({ nombre: '', apellido: '', apodo: '', talla: 'S' });
  };

  const removeStudent = (id) => {
    setStudents(students.filter(s => s.id !== id));
  };

  const handleOrderSubmission = async () => {
    if (students.length < 6) {
      Alert.alert('Pedido Mínimo', 'Debes agregar al menos 6 estudiantes.');
      return;
    }
    Alert.alert(
      'Confirmar Pedido',
      '¿Estás seguro de que deseas enviar este pedido grupal?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', onPress: () => submitFinalOrder() }
      ]
    );
  };

  const submitFinalOrder = async () => {
    setIsSubmitting(true);
    const orderData = {
      groupInfo,
      requesterInfo,
      estudiantes: students,
      producto: selectedProduct.nombre,
      cantidadTotal: students.length,
      disenos: designFiles.map(f => ({
        name: f.name,
        mimeType: f.mimeType,
        base64: f.base64
      })),
      userId: auth.currentUser.uid,
      userEmail: auth.currentUser.email,
      date: new Date().toISOString(),
      status: 'SUBMITTED',
      type: 'GROUP_ORDER'
    };
    const success = await saveOrder(orderData);
    setIsSubmitting(false);
    if (success) setIsDone(true);
  };

  const handleImportFromCalculator = async () => {
    if (!groupInfo.colegio || !groupInfo.curso) {
      Alert.alert('Error', 'Falta información del colegio o curso para importar.');
      return;
    }
    
    setIsImporting(true);
    try {
      const results = await getCalculatorResultsByCourse(groupInfo.colegio, groupInfo.curso);
      if (results.length === 0) {
        Alert.alert('Sin Datos', 'No se encontraron alumnos de este curso que hayan usado la calculadora aún.');
      } else {
        // BLINDAJE: Filtrar solo los nombres autorizados
        const authorizedResults = results.filter(res => {
          const fullName = `${res.userName}`;
          return validNames.includes(normalizeName(fullName));
        });

        if (authorizedResults.length < results.length) {
          Alert.alert(
            'Alumnos Filtrados', 
            `Se detectaron ${results.length} resultados, pero solo ${authorizedResults.length} están en la lista oficial. Solo estos han sido importados.`
          );
        }

        // Mapear resultados al formato de la lista de estudiantes
        const importedStudents = authorizedResults.map(r => ({
          id: r.id || Date.now().toString() + Math.random(),
          nombre: r.userName.split(' ')[0],
          apellido: r.userName.split(' ').slice(1).join(' '),
          apodo: '',
          talla: r.size || 'S'
        }));
        
        // Evitar duplicados (por nombre completo)
        const currentNames = students.map(s => normalizeName(`${s.nombre} ${s.apellido}`));
        const newOnes = importedStudents.filter(s => !currentNames.includes(normalizeName(`${s.nombre} ${s.apellido}`)));
        
        if (newOnes.length === 0 && results.length > 0) {
          Alert.alert('Información', 'Todos los alumnos autorizados ya están en la lista.');
        } else if (newOnes.length > 0) {
          setStudents([...students, ...newOnes]);
          Alert.alert('Éxito', `Se han importado ${newOnes.length} alumnos correctamente.`);
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron importar los datos.');
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  if (isDone) return (
    <View style={styles.centered}>
      <Text style={styles.headerTitle}>¡Pedido Recibido!</Text>
      <Text style={styles.headerSubtitle}>El pedido grupal de {students.length} polerones ha sido registrado con éxito.</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.primaryButtonText}>Volver al Inicio</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {step === 0 && (
        <View>
          <Text style={styles.headerTitle}>Nuevo Pedido Grupal</Text>
          <Text style={styles.headerSubtitle}>Selecciona el pack para tu grupo.</Text>
          {products.map(p => (
            <TouchableOpacity key={p.id} style={styles.productCard} onPress={() => { setSelectedProduct(p); setStep(1); }}>
              <Image source={{ uri: p.imagen }} style={styles.productImage} />
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{p.nombre}</Text>
                <Text style={styles.reservePrice}>Monto a Consultar</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {step === 1 && (
        <View>
          <Text style={styles.headerTitle}>Información del Grupo</Text>
          <Text style={styles.headerSubtitle}>Datos para el despacho y diseño.</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Colegio / Institución</Text>
            <TextInput style={styles.input} value={schoolSearch} onChangeText={handleSchoolSearch} placeholder="Busca tu colegio..." placeholderTextColor="#64748B" />
            {showSchoolResults && filteredSchools.length > 0 && (
              <View style={styles.searchResults}>
                {filteredSchools.map((s, i) => (
                  <TouchableOpacity key={i} style={styles.searchItem} onPress={() => { setSchoolSearch(s); updateGroupInfo('colegio', s); setShowSchoolResults(false); }}>
                    <Text style={{color: '#F1F5F9'}}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.inputGroup} onPress={() => setShowCourseModal(true)}>
             <Text style={styles.label}>Curso / Generación</Text>
             <View style={styles.pickerTrigger}>
               <Text style={{color: groupInfo.curso ? '#F1F5F9' : '#64748B'}}>{groupInfo.curso || 'Selecciona curso'}</Text>
               <ChevronDown color="#64748B" size={20} />
             </View>
          </TouchableOpacity>

          <View style={styles.imageUploadBox}>
            <Text style={styles.label}>Archivos del Diseño (Modelos, Logos, etc.)</Text>
            
            <TouchableOpacity style={styles.uploadBtn} onPress={pickFiles}>
              <UploadCloud color="#38BDF8" size={32} />
              <Text style={{color: '#38BDF8', marginTop: 8}}>Subir Archivos (PNG, PDF, AI...)</Text>
              <Text style={{color: '#64748B', fontSize: 11, marginTop: 4}}>Puedes seleccionar varios</Text>
            </TouchableOpacity>

            {designFiles.length > 0 && (
              <View style={styles.fileListContainer}>
                {designFiles.map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <View style={styles.fileIcon}>
                      {file.mimeType?.startsWith('image/') ? (
                        <Image source={{ uri: file.uri }} style={styles.filePreviewThumb} />
                      ) : (
                        <FileText color="#94A3B8" size={24} />
                      )}
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                      <Text style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</Text>
                    </View>
                    <TouchableOpacity style={styles.removeFileBtn} onPress={() => removeFile(index)}>
                      <X color="#EF4444" size={18} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.sectionDivider} />
          
          <Text style={[styles.headerTitle, {fontSize: 20, marginTop: 10}]}>Tus Datos de Contacto</Text>
          <Text style={styles.headerSubtitle}>Como encargado(a) del pedido.</Text>

          <View style={styles.row}>
            <View style={[styles.inputGroup, {flex: 1, marginRight: 8}]}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} value={requesterInfo.nombre} onChangeText={t => setRequesterInfo({...requesterInfo, nombre: t})} placeholder="Tu nombre" placeholderTextColor="#64748B" />
            </View>
            <View style={[styles.inputGroup, {flex: 1}]}>
              <Text style={styles.label}>Apellido</Text>
              <TextInput style={styles.input} value={requesterInfo.apellido} onChangeText={t => setRequesterInfo({...requesterInfo, apellido: t})} placeholder="Tu apellido" placeholderTextColor="#64748B" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo Electrónico</Text>
            <TextInput style={styles.input} value={requesterInfo.email} onChangeText={t => setRequesterInfo({...requesterInfo, email: t})} placeholder="email@ejemplo.com" placeholderTextColor="#64748B" keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>WhatsApp / Teléfono</Text>
            <TextInput style={styles.input} value={requesterInfo.telefono} onChangeText={t => setRequesterInfo({...requesterInfo, telefono: t})} placeholder="+56 9 ..." placeholderTextColor="#64748B" keyboardType="phone-pad" />
          </View>

          {userProfile?.role === 'manager' && (
            <View style={styles.infoAlert}>
              <Text style={styles.infoAlertText}>
                Has iniciado como Encargado de {groupInfo.curso} | {groupInfo.colegio}. 
                Los datos se han cargado automáticamente.
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.primaryButton, (!groupInfo.colegio || !groupInfo.curso || designFiles.length === 0 || !requesterInfo.nombre || !requesterInfo.telefono) && {opacity: 0.5}]} 
            onPress={() => setStep(2)}
            disabled={!groupInfo.colegio || !groupInfo.curso || designFiles.length === 0 || !requesterInfo.nombre || !requesterInfo.telefono}
          >
            <Text style={styles.primaryButtonText}>Continuar al Carrito</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.headerTitle}>Lista de Estudiantes</Text>
          <Text style={styles.headerSubtitle}>Agrega los nombres y tallas de todos los alumnos.</Text>
          
          <View style={styles.addStudentBox}>
            <View style={styles.row}>
              <View style={{flex: 1, marginRight: 8}}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput style={styles.smallInput} value={currentStudent.nombre} onChangeText={t => setCurrentStudent({...currentStudent, nombre: t})} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Apellido</Text>
                <TextInput style={styles.smallInput} value={currentStudent.apellido} onChangeText={t => setCurrentStudent({...currentStudent, apellido: t})} />
              </View>
            </View>
            
            <View style={[styles.row, {marginTop: 12}]}>
              <View style={{flex: 1, marginRight: 8}}>
                <Text style={styles.label}>Apodo (Opcional)</Text>
                <TextInput style={styles.smallInput} value={currentStudent.apodo} onChangeText={t => setCurrentStudent({...currentStudent, apodo: t})} />
              </View>
              <TouchableOpacity style={{flex: 1}} onPress={() => setShowSizeModal(true)}>
                <Text style={styles.label}>Talla</Text>
                <View style={styles.pickerTriggerSmall}>
                  <Text style={{color: '#F1F5F9'}}>{currentStudent.talla}</Text>
                  <ChevronDown color="#64748B" size={16} />
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={addStudent}>
              <Plus color="#fff" size={20} style={{marginRight: 8}} />
              <Text style={styles.primaryButtonText}>Añadir Manualmente</Text>
            </TouchableOpacity>

            <View style={styles.managerActionBox}>
              <Text style={styles.managerHint}>¿Tus alumnos ya usaron la calculadora?</Text>
              <TouchableOpacity 
                style={[styles.importButton, isImporting && {opacity: 0.7}]} 
                onPress={handleImportFromCalculator}
                disabled={isImporting}
              >
                {isImporting ? <ActivityIndicator color="#3B82F6" size="small" /> : (
                  <>
                    <UploadCloud color="#3B82F6" size={20} style={{marginRight: 8}} />
                    <Text style={styles.importButtonText}>Importar desde Calculadora</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Resumen del Carrito ({students.length})</Text>
            {students.length < 6 && <Text style={{color: '#EF4444', fontSize: 12}}>Mínimo 6 requeridos</Text>}
          </View>

          {students.map((s) => (
            <View key={s.id} style={styles.studentItem}>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{s.nombre} {s.apellido}</Text>
                <Text style={styles.studentDetails}>{s.talla} {s.apodo ? `| Apodo: ${s.apodo}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => removeStudent(s.id)}>
                <Trash2 color="#EF4444" size={20} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity 
            style={[styles.primaryButton, {marginTop: 30, backgroundColor: '#10B981'}, students.length < 6 && {opacity: 0.5}]} 
            onPress={() => setStep(3)}
            disabled={students.length < 6}
          >
            <Text style={styles.primaryButtonText}>Revisar y Confirmar</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 3 && (
        <View style={styles.resultContainer}>
          <Text style={styles.confirmTitle}>Confirmación del Pedido</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryRow}>Producto: {selectedProduct.nombre}</Text>
            <Text style={styles.summaryRow}>Pack: {students.length} polerones</Text>
            <Text style={styles.summaryRow}>Encargado: {requesterInfo.nombre} {requesterInfo.apellido}</Text>
            <View style={styles.divider} />
            <Text style={styles.summaryRow}>Institución: {groupInfo.colegio}</Text>
            <Text style={styles.summaryRow}>Curso: {groupInfo.curso}</Text>
          </View>

          <View style={styles.infoAlert}>
            <Text style={styles.infoAlertText}>
              Al confirmar, el administrador recibirá el detalle de tu pedido por correo para iniciar la preparación.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleOrderSubmission}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Confirmar y Enviar Pedido</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep(2)} style={{marginTop: 15, alignSelf: 'center'}}>
            <Text style={{color: '#94A3B8'}}>Volver al Carrito</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modals for Pickers */}
      <Modal visible={showCourseModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeaderTitle}>Selecciona Curso</Text>
            <FlatList
              data={CURSOS}
              keyExtractor={item => item}
            renderItem={({item}) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => { updateGroupInfo('curso', item); setShowCourseModal(false); }}>
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
            )}
            />
            <TouchableOpacity onPress={() => setShowCourseModal(false)} style={styles.closeBtn}><Text style={{color: '#fff'}}>Cerrar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSizeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeaderTitle}>Selecciona Talla</Text>
            {SIZES.map(s => (
              <TouchableOpacity key={s} style={styles.modalItem} onPress={() => { setCurrentStudent({...currentStudent, talla: s}); setShowSizeModal(false); }}>
                <Text style={styles.modalItemText}>Talla {s}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowSizeModal(false)} style={styles.closeBtn}><Text style={{color: '#fff'}}>Cerrar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* BOTÓN FLOTANTE WHATSAPP */}
      <TouchableOpacity 
        style={styles.whatsappFab} 
        onPress={openSoporteWhatsApp}
        activeOpacity={0.8}
      >
        <MessageCircle color="#fff" size={30} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 10 },
  headerSubtitle: { fontSize: 16, color: '#94A3B8', marginBottom: 30 },
  productCard: { backgroundColor: '#1E293B', borderRadius: 20, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  productImage: { width: '100%', height: 180 },
  productInfo: { padding: 15 },
  productName: { fontSize: 18, fontWeight: 'bold', color: '#F1F5F9', marginBottom: 5 },
  reservePrice: { fontSize: 14, color: '#3B82F6', fontWeight: 'bold' },
  inputGroup: { marginBottom: 20 },
  label: { color: '#94A3B8', marginBottom: 8, fontSize: 14 },
  input: { backgroundColor: '#1E293B', color: '#F1F5F9', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  smallInput: { backgroundColor: '#1E293B', color: '#F1F5F9', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row', alignItems: 'center' },
  primaryButton: { backgroundColor: '#3B82F6', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  pickerTrigger: { backgroundColor: '#1E293B', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerTriggerSmall: { backgroundColor: '#1E293B', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  imageUploadBox: { marginBottom: 25 },
  uploadBtn: { height: 120, borderStyle: 'dashed', borderWidth: 2, borderColor: '#334155', borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E293B' },
  previewContainer: { position: 'relative', width: 120, height: 120 },
  designPreview: { width: 120, height: 120, borderRadius: 10 },
  removeImgBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: '#EF4444', borderRadius: 12, padding: 4 },
  addStudentBox: { backgroundColor: '#1E293B', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#334155', marginBottom: 25 },
  addButton: { backgroundColor: '#3B82F6', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 15, flexDirection: 'row', justifyContent: 'center' },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  whatsappFab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#25D366',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF40',
    zIndex: 100
  },
  cartTitle: { color: '#F1F5F9', fontSize: 18, fontWeight: 'bold' },
  studentItem: { backgroundColor: '#1E293B', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  studentName: { color: '#F1F5F9', fontWeight: 'bold', fontSize: 16 },
  studentDetails: { color: '#94A3B8', fontSize: 14 },
  resultContainer: { backgroundColor: '#1E293B', padding: 25, borderRadius: 24, borderWidth: 1, borderColor: '#334155' },
  confirmTitle: { fontSize: 22, fontWeight: 'bold', color: '#F1F5F9', marginBottom: 20, textAlign: 'center' },
  summaryBox: { backgroundColor: '#0F172A', padding: 15, borderRadius: 15, marginBottom: 20 },
  summaryRow: { color: '#94A3B8', marginBottom: 8, fontSize: 15 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 12 },
  sectionDivider: { height: 1, backgroundColor: '#334155', marginVertical: 25 },
  searchResults: { backgroundColor: '#1E293B', borderRadius: 12, marginTop: 5, padding: 5, borderWidth: 1, borderColor: '#475569' },
  searchItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 40 },
  modalContent: { backgroundColor: '#1E293B', borderRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeaderTitle: { color: '#F1F5F9', fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalItemText: { color: '#F1F5F9', fontSize: 16 },
  closeBtn: { marginTop: 15, padding: 15, alignItems: 'center', backgroundColor: '#374151', borderRadius: 12 },
  infoAlert: { backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 15, borderRadius: 12, marginVertical: 10, borderWidth: 1, borderColor: '#3B82F6' },
  infoAlertText: { color: '#3B82F6', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  managerActionBox: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 15, alignItems: 'center' },
  managerHint: { color: '#94A3B8', fontSize: 13, marginBottom: 10 },
  importButton: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, 
    borderWidth: 1, borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.05)'
  },
  importButtonText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 15 },
  fileListContainer: { marginTop: 15 },
  fileItem: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: '#1E293B', padding: 10, borderRadius: 12, 
    marginBottom: 8, borderWidth: 1, borderColor: '#334155' 
  },
  fileIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  filePreviewThumb: { width: 40, height: 40, borderRadius: 8 },
  fileInfo: { flex: 1 },
  fileName: { color: '#F1F5F9', fontSize: 13, fontWeight: 'bold' },
  fileSize: { color: '#64748B', fontSize: 11 },
  removeFileBtn: { padding: 8 }
});
