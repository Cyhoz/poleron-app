import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Vibration, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { saveOrder, getAdminSizes } from '../services/firebaseOrderService';

const SIZES = ['16', 'S', 'M', 'L', 'XL'];

export default function ClientScreen() {
  const [measurements, setMeasurements] = useState({
    pecho: '',
    largo: '',
    manga: '',
  });

  const [personalInfo, setPersonalInfo] = useState({
    nombre: '',
    colegio: '',
    curso: '',
    apodo: '',
    region: '',
    ciudad: '',
    comuna: '',
    pais: 'Chile',
  });

  const [recommendedSize, setRecommendedSize] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const [adminSizes, setAdminSizes] = useState(null);

  useEffect(() => {
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
  }, []);

  const updatePersonalInfo = (field, value) => {
    setPersonalInfo(prev => ({ ...prev, [field]: value }));
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

      const userPecho = parseFloat(measurements.pecho);
      const userLargo = parseFloat(measurements.largo);
      const userManga = parseFloat(measurements.manga);

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

  const submitOrder = async () => {
    const { nombre, colegio, curso, region, ciudad, comuna, pais } = personalInfo;

    if (!nombre.trim() || !colegio.trim() || !curso.trim() || !region.trim() || !ciudad.trim() || !comuna.trim() || !pais.trim()) {
      Alert.alert('Error', 'Por favor completa todos los datos personales y de ubicación.');
      return;
    }

    // Validación de Seguridad: Limitar la longitud de los textos para evitar inyecciones gigantes
    if (nombre.length > 60 || colegio.length > 60 || curso.length > 30 || region.length > 50 || ciudad.length > 50 || comuna.length > 50 || pais.length > 50) {
      Alert.alert('Error', 'Los datos ingresados son demasiado largos. Por favor revisa e intenta de nuevo.');
      return;
    }

    if (!selectedSize) {
      Alert.alert('Error', 'Debes seleccionar una talla definitiva.');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderData = {
        personalInfo,
        medidas: measurements,
        tallaRecomendada: recommendedSize,
        tallaElegida: selectedSize
      };

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));

      const success = await Promise.race([saveOrder(orderData), timeoutPromise]);

      if (success) {
        setIsDone(true);
        Alert.alert('¡Pedido Registrado!', 'Tus datos se han guardado exitosamente.');

        try {
          if (Platform.OS !== 'web') Vibration.vibrate(400);
          await Audio.Sound.createAsync(
            { uri: 'https://www.soundjay.com/buttons/sounds/button-09.mp3' },
            { shouldPlay: true }
          );
        } catch (e) {
          console.log('Notification sound error:', e);
        }
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
          Nombre: {personalInfo.nombre}{'\n'}
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
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.pecho} onChangeText={(text) => setMeasurements(prev => ({ ...prev, pecho: text }))} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Largo Total (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.largo} onChangeText={(text) => setMeasurements(prev => ({ ...prev, largo: text }))} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Largo de Mangas (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.manga} onChangeText={(text) => setMeasurements(prev => ({ ...prev, manga: text }))} />
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
            <Text style={styles.label}>Nombre Completo</Text>
            <TextInput style={styles.input} placeholder="Ej: Juan Pérez" placeholderTextColor="#6B7280" value={personalInfo.nombre} onChangeText={(v) => updatePersonalInfo('nombre', v)} />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroupFull, { flex: 2, marginRight: 8 }]}>
              <Text style={styles.label}>Colegio / Institución</Text>
              <TextInput style={styles.input} placeholder="Ej: Liceo Bicentenario" placeholderTextColor="#6B7280" value={personalInfo.colegio} onChangeText={(v) => updatePersonalInfo('colegio', v)} />
            </View>
            <View style={[styles.inputGroupFull, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Curso</Text>
              <TextInput style={styles.input} placeholder="Ej: 4to B" placeholderTextColor="#6B7280" value={personalInfo.curso} onChangeText={(v) => updatePersonalInfo('curso', v)} />
            </View>
          </View>

          <View style={styles.inputGroupFull}>
            <Text style={styles.label}>Apodo (Opcional)</Text>
            <TextInput style={styles.input} placeholder="Ej: El Negro" placeholderTextColor="#6B7280" value={personalInfo.apodo} onChangeText={(v) => updatePersonalInfo('apodo', v)} />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroupFull, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>País</Text>
              <TextInput style={styles.input} value={personalInfo.pais} onChangeText={(v) => updatePersonalInfo('pais', v)} />
            </View>
            <View style={[styles.inputGroupFull, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Región</Text>
              <TextInput style={styles.input} placeholder="Ej: RM" placeholderTextColor="#6B7280" value={personalInfo.region} onChangeText={(v) => updatePersonalInfo('region', v)} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroupFull, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Ciudad</Text>
              <TextInput style={styles.input} placeholder="Ej: Santiago" placeholderTextColor="#6B7280" value={personalInfo.ciudad} onChangeText={(v) => updatePersonalInfo('ciudad', v)} />
            </View>
            <View style={[styles.inputGroupFull, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Comuna</Text>
              <TextInput style={styles.input} placeholder="Ej: Providencia" placeholderTextColor="#6B7280" value={personalInfo.comuna} onChangeText={(v) => updatePersonalInfo('comuna', v)} />
            </View>
          </View>

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
  sizeOptionTextSelected: { color: '#fff' }
});
