import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Vibration, Platform, Modal, FlatList } from 'react-native';
import { REGIONES, CURSOS, COLEGIOS_REALES } from '../constants/chileData';
import { saveOrder, getAdminSizes, checkExistingOrder, subscribeToAppData, saveAppData } from '../services/firebaseOrderService';

const SIZES = ['16', 'S', 'M', 'L', 'XL'];
const API_BASE_URL = 'https://poleron-app-2.onrender.com';

export default function ClientScreen() {
  const [measurements, setMeasurements] = useState({
    pecho: '',
    largo: '',
    manga: '',
  });

  const [personalInfo, setPersonalInfo] = useState({
    nombre: '',
    apellido: '',
    colegio: '',
    curso: '',
    apodo: '',
    region: '',
    ciudad: '',
    comuna: '',
    pais: 'Chile',
    rut: '',
  });

  const [recommendedSize, setRecommendedSize] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // States for Modals
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showCommuneModal, setShowCommuneModal] = useState(false);
  
  // States for Autocomplete
  const [schoolSearch, setSchoolSearch] = useState('');
  const [showSchoolResults, setShowSchoolResults] = useState(false);
  const [filteredSchools, setFilteredSchools] = useState([]);

  // App Settings from Firebase
  const [appData, setAppData] = useState({
    schools: COLEGIOS_REALES,
    courses: CURSOS,
    regions: REGIONES
  });

  const [adminSizes, setAdminSizes] = useState(null);

  useEffect(() => {
    // Sync App Config (Schools, Courses, locations)
    const unsubApp = subscribeToAppData((data) => {
      if (data) setAppData(data);
    });

    const fetchSizes = async () => {
      try {
        const stored = await getAdminSizes(); // Firebase call
        if (stored && Object.keys(stored).length > 0) {
          setAdminSizes(stored);
        } else {
          setAdminSizes({
            '16': { pecho: 45, largo: 60, manga: 55 },
            'S': { pecho: 50, largo: 65, manga: 60 },
            'M': { pecho: 55, largo: 70, manga: 65 },
            'L': { pecho: 60, largo: 75, manga: 70 },
            'XL': { pecho: 65, largo: 80, manga: 75 },
          });
        }
      } catch (e) {
        console.error('Error fetching admin sizes', e);
        setAdminSizes({
          '16': { pecho: 45, largo: 60, manga: 55 },
          'S': { pecho: 50, largo: 65, manga: 60 },
          'M': { pecho: 55, largo: 70, manga: 65 },
          'L': { pecho: 60, largo: 75, manga: 70 },
          'XL': { pecho: 65, largo: 80, manga: 75 },
        });
      }
    };
    fetchSizes();
    return () => unsubApp();
  }, []);

  const updatePersonalInfo = (field, value) => {
    let filteredValue = value;

    // Filtros de Seguridad y Realismo
    if (field === 'nombre' || field === 'apellido' || field === 'ciudad') {
      // Solo letras y espacios (Nombres Reales)
      filteredValue = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    } else if (field === 'colegio') {
      // Letras, números y espacios (Colegios pueden tener números como "Escuela 143")
      // Pero sin símbolos raros como @, #, $, etc.
      filteredValue = value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.-]/g, '');
    }
    } else if (field === 'rut') {
      // Limpiar RUT: quitar puntos y guiones, dejar números y K
      filteredValue = value.replace(/[^0-9kK]/g, '').toUpperCase();
    }
    // 'apodo' no tiene filtro para permitir emojis y cualquier texto

    setPersonalInfo(prev => {
      const updated = { ...prev, [field]: filteredValue };
      // Reset comuna if region changes
      if (field === 'region') {
        updated.comuna = '';
        updated.ciudad = '';
      }
      return updated;
    });
  };

  const handleSchoolSearch = (text) => {
    // Aplicar el mismo filtro que en updatePersonalInfo para 'colegio'
    const filtered = text.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.-]/g, '');
    setSchoolSearch(filtered);
    updatePersonalInfo('colegio', filtered);
    if (text.length > 2) {
      // Búsqueda en el servidor (Render) para acceder a los 12,000+ colegios reales
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

  const selectSchool = (school) => {
    setSchoolSearch(school);
    updatePersonalInfo('colegio', school);
    setShowSchoolResults(false);
  };

  const calculateSize = () => {
    try {
      if (!measurements.pecho || !measurements.largo || !measurements.manga) {
        Alert.alert('Error', 'Por favor ingresa TODAS las medidas corporales.');
        return;
      }

      if (!adminSizes) {
        Alert.alert('Conectando...', 'Comprobando medidas de la tienda en Internet, inténtalo de nuevo.');
        return;
      }

      // Validación de Seguridad: Prevenir fallo matemático si colocan comas (,) en lugar de puntos
      const userPecho = parseFloat(measurements.pecho.replace(',', '.'));
      const userLargo = parseFloat(measurements.largo.replace(',', '.'));
      const userManga = parseFloat(measurements.manga.replace(',', '.'));

      if (isNaN(userPecho) || isNaN(userLargo) || isNaN(userManga)) {
        Alert.alert('Error', 'Asegúrate de escribir solo los números de las medidas (ej: 60).');
        return;
      }

      // Validación de Seguridad: Medidas dentro de rango realista (para evitar números absurdamente grandes o negativos)
      if (userPecho <= 10 || userPecho > 200 || userLargo <= 10 || userLargo > 200 || userManga <= 10 || userManga > 200) {
        Alert.alert('Error', 'Por favor ingresa medidas reales (entre 10cm y 200cm).');
        return;
      }

      let foundSize = 'XL';

      for (const size of SIZES) {
        const sizeConfig = adminSizes[size] || {};
        const sizePecho = parseFloat(sizeConfig.pecho || 0);
        const sizeLargo = parseFloat(sizeConfig.largo || 0);
        const sizeManga = parseFloat(sizeConfig.manga || 0);

        if (sizePecho >= userPecho - 1 && sizeLargo >= userLargo - 1 && sizeManga >= userManga - 1) {
          foundSize = size;
          break;
        }
      }

      setRecommendedSize(foundSize);
      setSelectedSize(foundSize);
    } catch (err) {
      console.error('Crash al calcular la talla:', err);
      Alert.alert('Error de Cálculo', 'Reinicia la aplicación e inténtalo nuevamente.');
    }
  };

  const validateRut = (rut) => {
    if (!rut || rut.length < 8) return false;
    const body = rut.slice(0, -1);
    let dv = rut.slice(-1).toUpperCase();
    
    let sum = 0;
    let mul = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += mul * parseInt(body[i]);
      mul = mul === 7 ? 2 : mul + 1;
    }
    
    const res = 11 - (sum % 11);
    const expectedDv = res === 11 ? '0' : res === 10 ? 'K' : res.toString();
    return dv === expectedDv;
  };

  const isRealName = async (name) => {
    const n = name.trim();
    if (n.length < 2) return false;
    
    // Bloquear números y caracteres especiales (solo letras permitidas)
    const regexLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!regexLetras.test(n)) return false;

    // Validación avanzada contra base de datos de nombres reales en Render
    try {
      const response = await fetch(`${API_BASE_URL}/api/validate-name?name=${n}`);
      const data = await response.json();
      return data.isValid;
    } catch (err) {
      console.warn('Error validando nombre vs DB, usando validación heurística');
      // Fallback a validación simple si el servidor falla
      const lower = n.toLowerCase();
      const fakes = ['asdf', 'qwerty', 'test', 'prueba', 'hola', 'abc', 'zxcv', 'qaz', 'wsx', 'aaa', 'bbb', 'ccc'];
      if (fakes.some(f => lower.includes(f))) return false;
      if (/(.)\1\1\1/.test(lower)) return false; 
      if (!/[aeiouáéíóú]/.test(lower)) return false; 
      return true;
    }
  };

  const formatToTitleCase = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());

  const submitOrder = async () => {
    const { nombre, apellido, colegio, curso, region, ciudad, comuna, pais } = personalInfo;

    const nNombre = formatToTitleCase(nombre);
    const nApellido = formatToTitleCase(apellido);
    const nColegio = formatToTitleCase(colegio);
    const nCurso = curso.trim().replace(/\s+/g, ' ').toUpperCase(); // "4TO A"
    const nRegion = formatToTitleCase(region);
    const nCiudad = formatToTitleCase(ciudad);
    const nComuna = formatToTitleCase(comuna);
    const nPais = formatToTitleCase(pais);

    if (!validateRut(personalInfo.rut)) {
      Alert.alert('RUT Inválido', 'El RUT ingresado no es válido. Por favor revisa que el número y el dígito verificador sean correctos.');
      return;
    }

    const nameIsValid = await isRealName(nNombre);
    if (nNombre.length < 2 || nApellido.length < 2 || !nameIsValid) {
      Alert.alert('Nombre Inválido', 'Por favor ingresa un nombre y apellido real. No se permiten nombres ficticios como "asdf", "goku" o similares.');
      return;
    }

    if (!nNombre || !nApellido || !nColegio || !nCurso || !nRegion || !nCiudad || !nComuna || !nPais) {
      Alert.alert('Error', 'Por favor completa todos los datos personales y de ubicación.');
      return;
    }

    // Validación de Seguridad: Limitar la longitud de los textos para evitar inyecciones gigantes
    if (nNombre.length > 60 || nApellido.length > 60 || nColegio.length > 60 || nCurso.length > 30 || nRegion.length > 50 || nCiudad.length > 50 || nComuna.length > 50 || nPais.length > 50) {
      Alert.alert('Error', 'Los datos ingresados son demasiado largos. Por favor revisa e intenta de nuevo.');
      return;
    }

    if (!selectedSize) {
      Alert.alert('Error', 'Debes seleccionar una talla definitiva.');
      return;
    }

    setIsSubmitting(true);

    const existePedido = await checkExistingOrder(nNombre, nApellido, nCurso);
    if (existePedido) {
      setIsSubmitting(false);
      Alert.alert('Pedido Activo Existente', 'Ya hemos recibido un pedido con este nombre para tu curso. No puedes hacer solicitudes duplicadas.');
      return;
    }

    // Validar que el colegio existe en la lista oficial (Firebase)
    const schoolExists = appData.schools.some(s => s.toLowerCase() === nColegio.toLowerCase());
    if (!schoolExists) {
      setIsSubmitting(false);
      Alert.alert(
        'Colegio no registrado', 
        'El nombre del colegio no coincide con nuestra lista autorizada. Por favor, selecciona tu colegio del buscador o contacta al administrador.'
      );
      return;
    }

    try {
      const orderData = {
        personalInfo: {
          nombre: nNombre,
          apellido: nApellido,
          colegio: nColegio,
          curso: nCurso,
          region: nRegion,
          ciudad: nCiudad,
          comuna: nComuna,
          pais: nPais,
          apodo: personalInfo.apodo.trim().replace(/\s+/g, ' ')
        },
        medidas: measurements,
        tallaRecomendada: recommendedSize,
        tallaElegida: selectedSize
      };

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));

      const success = await Promise.race([saveOrder(orderData), timeoutPromise]);

      if (success) {
        setIsDone(true);
        Alert.alert('¡Pedido Registrado!', 'Tus datos se han guardado exitosamente.');

/* 
        try {
          if (Platform.OS !== 'web') Vibration.vibrate(400);
          await Audio.Sound.createAsync(
            { uri: 'https://www.soundjay.com/buttons/sounds/button-09.mp3' },
            { shouldPlay: true }
          );
        } catch (e) {
          console.log('Notification sound error:', e);
        } */
      } else {
        Alert.alert('Error en Google', 'La base de datos de Firestore no pudo recibir el pedido. Asegurate de haberla creado en Modo Prueba.');
      }
    } catch (err) {
      if (err.message === 'TIMEOUT') {
        Alert.alert('Sin respuesta', 'Se acabó el tiempo de espera. Firebase no responde, verifica que la base de datos esté creada.');
      } else {
        console.error('Submit error:', err);
        Alert.alert('Error Fatal', 'No se pudo contactar el servidor de Firebase.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <View style={styles.sizeBadge}>
          <Text style={styles.sizeText}>✓</Text>
        </View>
        <Text style={styles.headerTitle}>¡Recibido!</Text>
        <Text style={[styles.resultDescription, { marginTop: 16 }]}>
          Nombre: {personalInfo.nombre} {personalInfo.apellido}{'\n'}
          Colegio: {personalInfo.colegio}{'\n'}
          Curso: {personalInfo.curso}{'\n'}
          {personalInfo.apodo ? `Apodo: ${personalInfo.apodo}\n` : ''}
          Talla escogida: {selectedSize}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Asistente de Tallas</Text>

      {!recommendedSize && (
        <View>
          <Text style={styles.headerSubtitle}>
            Usa una cinta métrica y descubre tu talla ideal paso a paso.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ancho de Pecho (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.pecho} onChangeText={(text) => setMeasurements(prev => ({ ...prev, pecho: text.replace(/[^0-9.,]/g, '') }))} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Largo Total (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.largo} onChangeText={(text) => setMeasurements(prev => ({ ...prev, largo: text.replace(/[^0-9.,]/g, '') }))} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Largo de Mangas (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.manga} onChangeText={(text) => setMeasurements(prev => ({ ...prev, manga: text.replace(/[^0-9.,]/g, '') }))} />
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={calculateSize} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Calcular Mi Talla</Text>}
          </TouchableOpacity>
        </View>
      )}

      {recommendedSize && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Te sugerimos la talla:</Text>
          <View style={styles.sizeBadge}>
            <Text style={styles.sizeText}>{recommendedSize}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.confirmTitle}>Elige tu talla definitiva:</Text>
          <View style={styles.sizeSelectorRow}>
            {SIZES.map((size) => (
              <TouchableOpacity
                key={size}
                style={[styles.sizeOption, selectedSize === size && styles.sizeOptionSelected]}
                onPress={() => setSelectedSize(size)}
              >
                <Text style={[styles.sizeOptionText, selectedSize === size && styles.sizeOptionTextSelected]}>{size}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />
          <Text style={styles.confirmTitle}>Datos del Alumno:</Text>

          <View style={styles.inputGroupFull}>
            <Text style={styles.label}>RUT (Para validar identidad)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ej: 12345678K" 
              placeholderTextColor="#6B7280" 
              value={personalInfo.rut} 
              onChangeText={(v) => updatePersonalInfo('rut', v)} 
              maxLength={10}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroupFull, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Nombres</Text>
              <TextInput style={styles.input} placeholder="Ej: Juan" placeholderTextColor="#6B7280" value={personalInfo.nombre} onChangeText={(v) => updatePersonalInfo('nombre', v)} />
            </View>
            <View style={[styles.inputGroupFull, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Apellidos</Text>
              <TextInput style={styles.input} placeholder="Ej: Pérez" placeholderTextColor="#6B7280" value={personalInfo.apellido} onChangeText={(v) => updatePersonalInfo('apellido', v)} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroupFull, { flex: 2, marginRight: 8 }]}>
              <Text style={styles.label}>Colegio / Institución</Text>
              <View style={{ zIndex: 100 }}>
                <TextInput 
                  style={styles.input} 
                  placeholder="Ej: Instituto Nacional" 
                  placeholderTextColor="#6B7280" 
                  value={schoolSearch || personalInfo.colegio} 
                  onChangeText={handleSchoolSearch}
                  onFocus={() => { if(schoolSearch.length > 1) setShowSchoolResults(true) }}
                />
                {showSchoolResults && filteredSchools.length > 0 && (
                  <View style={styles.autocompleteContainer}>
                    {filteredSchools.map((item, idx) => (
                      <TouchableOpacity key={idx} style={styles.autocompleteItem} onPress={() => selectSchool(item)}>
                        <Text style={styles.autocompleteText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.inputGroupFull, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Curso</Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowCourseModal(true)}>
                <Text style={[styles.pickerTriggerText, !personalInfo.curso && { color: '#6B7280' }]}>
                  {personalInfo.curso || "Seleccionar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroupFull}>
            <Text style={styles.label}>Apodo (Opcional)</Text>
            <TextInput style={styles.input} placeholder="Ej: El Negro" placeholderTextColor="#6B7280" value={personalInfo.apodo} onChangeText={(v) => updatePersonalInfo('apodo', v)} />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroupFull, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>País</Text>
              <View style={[styles.pickerTrigger, { backgroundColor: '#111827', borderColor: '#1F2937' }]}>
                <Text style={styles.pickerTriggerText}>Chile</Text>
              </View>
            </View>
            <View style={[styles.inputGroupFull, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Región</Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowRegionModal(true)}>
                <Text style={[styles.pickerTriggerText, !personalInfo.region && { color: '#6B7280' }]}>
                  {personalInfo.region || "Seleccionar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroupFull, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Comuna</Text>
              <TouchableOpacity 
                style={[styles.pickerTrigger, !personalInfo.region && { opacity: 0.5 }]} 
                onPress={() => personalInfo.region ? setShowCommuneModal(true) : Alert.alert('Aviso', 'Selecciona primero una región')}
              >
                <Text style={[styles.pickerTriggerText, !personalInfo.comuna && { color: '#6B7280' }]}>
                  {personalInfo.comuna || "Seleccionar"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputGroupFull, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Ciudad (Opcional)</Text>
              <TextInput style={styles.input} placeholder="Ej: Stgo" placeholderTextColor="#6B7280" value={personalInfo.ciudad} onChangeText={(v) => updatePersonalInfo('ciudad', v)} />
            </View>
          </View>

          {/* Modales de Selección */}
          <SelectionModal 
            visible={showCourseModal} 
            title="Selecciona tu Curso" 
            options={appData.courses} 
            onSelect={(v) => { updatePersonalInfo('curso', v); setShowCourseModal(false); }} 
            onClose={() => setShowCourseModal(false)} 
          />
          <SelectionModal 
            visible={showRegionModal} 
            title="Selecciona tu Región" 
            options={appData.regions.map(r => r.nombre)} 
            onSelect={(v) => { updatePersonalInfo('region', v); setShowRegionModal(false); }} 
            onClose={() => setShowRegionModal(false)} 
          />
          <SelectionModal 
            visible={showCommuneModal} 
            title="Selecciona tu Comuna" 
            options={appData.regions.find(r => r.nombre === personalInfo.region)?.comunas || []} 
            onSelect={(v) => { updatePersonalInfo('comuna', v); updatePersonalInfo('ciudad', v); setShowCommuneModal(false); }} 
            onClose={() => setShowCommuneModal(false)} 
          />

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: '#10B981', width: '100%', marginTop: 10 }]}
            onPress={submitOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Confirmar y Enviar Pedido</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// Componente Auxiliar para Modales de Selección
function SelectionModal({ visible, title, options, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalOption} onPress={() => onSelect(item)}>
                <Text style={styles.modalOptionText}>{item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 24, paddingBottom: 60 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#F9FAFB', marginBottom: 8 },
  headerSubtitle: { fontSize: 15, color: '#9CA3AF', marginBottom: 32, lineHeight: 22 },
  inputGroup: { marginBottom: 20 },
  inputGroupFull: { width: '100%', marginBottom: 16 },
  row: { flexDirection: 'row', width: '100%' },
  label: { color: '#E5E7EB', fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: { backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151', borderRadius: 12, padding: 14, color: '#F9FAFB', fontSize: 15 },
  submitButton: { backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  resultContainer: { marginTop: 10, backgroundColor: '#1F2937', padding: 24, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  resultTitle: { color: '#9CA3AF', fontSize: 16, marginBottom: 16 },
  sizeBadge: { backgroundColor: '#3B82F6', width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  sizeText: { color: '#ffffff', fontSize: 28, fontWeight: 'bold' },
  resultDescription: { color: '#D1D5DB', textAlign: 'center', lineHeight: 22, fontSize: 14 },
  divider: { height: 1, width: '100%', backgroundColor: '#4B5563', marginVertical: 24 },
  confirmTitle: { color: '#E5E7EB', fontSize: 16, fontWeight: '600', marginBottom: 16, alignSelf: 'flex-start' },
  sizeSelectorRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  sizeOption: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#6B7280', justifyContent: 'center', alignItems: 'center' },
  sizeOptionSelected: { backgroundColor: '#10B981', borderColor: '#10B981' },
  sizeOptionText: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  sizeOptionTextSelected: { color: '#fff' },
  pickerTrigger: { backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151', borderRadius: 12, padding: 14, justifyContent: 'center' },
  pickerTriggerText: { color: '#F9FAFB', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#F9FAFB', fontSize: 18, fontWeight: 'bold' },
  modalClose: { color: '#3B82F6', fontWeight: 'bold' },
  modalOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  modalOptionText: { color: '#D1D5DB', fontSize: 16 },
  autocompleteContainer: { 
    position: 'absolute', top: 60, left: 0, right: 0, backgroundColor: '#1F2937', 
    borderRadius: 8, borderWidth: 1, borderColor: '#374151', zIndex: 1000,
    maxHeight: 200, overflow: 'hidden'
  },
  autocompleteItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
  autocompleteText: { color: '#F9FAFB', fontSize: 14 }
});
