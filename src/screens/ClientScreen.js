import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { getAdminSizes, getProducts, getUserProfile, saveCalculatorResult } from '../services/firebaseOrderService';
import { auth } from '../services/firebaseConfig';

// SIZES ahora se deriva dinámicamente de adminSizes

export default function ClientScreen({ navigation }) {
  const [step, setStep] = useState(0); // 0: Catalog, 1: Measurements, 2: Result
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [measurements, setMeasurements] = useState({ pecho: '', largo: '', manga: '' });
  const [recommendedSize, setRecommendedSize] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [adminSizes, setAdminSizes] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
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
      
      if (auth.currentUser) {
        const profile = await getUserProfile(auth.currentUser.uid);
        setUserProfile(profile);
      }
      setIsLoading(false);
    };

    initData();
  }, []);

  const calculateSize = () => {
    if (!measurements.pecho || !measurements.largo || !measurements.manga) {
      Alert.alert('Error', 'Ingresa todas las medidas.');
      return;
    }
    const p = parseFloat(measurements.pecho.replace(',', '.'));
    const l = parseFloat(measurements.largo.replace(',', '.'));
    const m = parseFloat(measurements.manga.replace(',', '.'));

    let found = 'No encontrada';
    const sortedSizes = Object.keys(adminSizes).sort((a, b) => {
      return (adminSizes[a].pecho || 0) - (adminSizes[b].pecho || 0);
    });

    for (const size of sortedSizes) {
      const config = adminSizes[size] || {};
      if (config.pecho >= p - 1 && config.largo >= l - 1 && config.manga >= m - 1) {
        found = size; 
        break;
      }
    }
    // Si no entra en ninguna, sugerir la más grande disponible
    if (found === 'No encontrada' && sortedSizes.length > 0) {
      found = sortedSizes[sortedSizes.length - 1];
    }
    setRecommendedSize(found);
    setStep(2);
    
    // Guardar automáticamente el resultado si hay perfil
    if (userProfile) {
      handleSaveResult(found);
    }
  };

  const handleSaveResult = async (size) => {
    setIsSaving(true);
    const result = {
      userId: auth.currentUser.uid,
      userName: userProfile.nombre,
      size: size,
      school: userProfile.school,
      course: userProfile.course,
      product: selectedProduct.nombre
    };
    await saveCalculatorResult(result);
    setIsSaving(false);
  };

  if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {step === 0 && (
        <View>
          <Text style={styles.headerTitle}>Calculadora de Talla</Text>
          <Text style={styles.headerSubtitle}>Selecciona el producto para el cual quieres calcular tu talla.</Text>
          {products.map(p => (
            <TouchableOpacity key={p.id} style={styles.productCard} onPress={() => { setSelectedProduct(p); setStep(1); }}>
              <Image source={{ uri: p.imagen }} style={styles.productImage} />
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{p.nombre}</Text>
                <Text style={styles.productDesc}>{p.descripcion}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {step === 1 && (
        <View>
          <TouchableOpacity onPress={() => setStep(0)} style={{marginBottom: 20}}>
            <Text style={{color: '#3B82F6'}}>← Cambiar Producto</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tus Medidas</Text>
          <Text style={styles.headerSubtitle}>Ingresa tus medidas para el producto: {selectedProduct.nombre}</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pecho (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.pecho} onChangeText={t => setMeasurements({ ...measurements, pecho: t })} placeholder="Ej: 50" placeholderTextColor="#64748B" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Largo (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.largo} onChangeText={t => setMeasurements({ ...measurements, largo: t })} placeholder="Ej: 65" placeholderTextColor="#64748B" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Manga (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={measurements.manga} onChangeText={t => setMeasurements({ ...measurements, manga: t })} placeholder="Ej: 60" placeholderTextColor="#64748B" />
          </View>
          <TouchableOpacity style={styles.submitButton} onPress={calculateSize}>
            <Text style={styles.submitButtonText}>Calcular Talla</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View style={styles.resultContainer}>
          <Text style={styles.confirmTitle}>Tu Talla Ideal</Text>
          <Text style={{color: '#94A3B8', textAlign: 'center', marginBottom: 20}}>
            Según las medidas ingresadas, te recomendamos la siguiente talla:
          </Text>
          <View style={styles.sizeBadge}><Text style={styles.sizeText}>{recommendedSize}</Text></View>
          <Text style={{color: '#E2E8F0', fontSize: 16, textAlign: 'center', marginVertical: 20, paddingHorizontal: 15, lineHeight: 24}}>
            {userProfile 
              ? `¡Listo! Tu talla ha sido guardada y compartida automáticamente con el encargado de tu curso (${userProfile.course}).`
              : "Por favor, informa esta talla a tu Profesor(a) Jefe o a la persona encargada de realizar el pedido grupal."
            }
          </Text>
          <TouchableOpacity style={[styles.submitButton, { backgroundColor: '#3B82F6', width: '100%' }]} onPress={() => navigation.goBack()}>
            <Text style={styles.submitButtonText}>Entendido, Volver a Inicio</Text>
          </TouchableOpacity>
        </View>
      )}
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
  productDesc: { fontSize: 13, color: '#94A3B8' },
  inputGroup: { marginBottom: 20 },
  label: { color: '#94A3B8', marginBottom: 8, fontSize: 14 },
  input: { backgroundColor: '#1E293B', color: '#F1F5F9', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  submitButton: { backgroundColor: '#3B82F6', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  resultContainer: { backgroundColor: '#1E293B', padding: 25, borderRadius: 24, borderWidth: 1, borderColor: '#334155' },
  confirmTitle: { fontSize: 22, fontWeight: 'bold', color: '#F1F5F9', marginBottom: 10, textAlign: 'center' },
  sizeBadge: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#3B82F6', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  sizeText: { fontSize: 36, fontWeight: 'bold', color: '#FFF' },
});
