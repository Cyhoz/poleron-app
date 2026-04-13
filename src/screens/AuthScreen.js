import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { LogIn, UserPlus, Mail, Lock, User } from 'lucide-react-native';

export default function AuthScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !nombre)) {
      Alert.alert('Error', 'Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Guardar datos adicionales del usuario en Firestore
        await setDoc(doc(db, "users", user.uid), {
          nombre: nombre,
          email: email,
          createdAt: new Date().toISOString(),
          role: 'client'
        });
      }
      // La navegación se manejará automáticamente por el listener de estado en App.js o HomeScreen
      navigation.replace('Home');
    } catch (error) {
      console.error(error);
      let message = 'Error en la autenticación.';
      if (error.code === 'auth/email-already-in-use') message = 'El correo ya está en uso.';
      if (error.code === 'auth/wrong-password') message = 'Contraseña incorrecta.';
      if (error.code === 'auth/user-not-found') message = 'Usuario no encontrado.';
      if (error.code === 'auth/weak-password') message = 'La contraseña debe tener al menos 6 caracteres.';
      
      Alert.alert('Fallo', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerBox}>
          <View style={styles.logoCircle}>
             {isLogin ? <LogIn size={40} color="#3B82F6" /> : <UserPlus size={40} color="#10B981" />}
          </View>
          <Text style={styles.title}>{isLogin ? '¡Bienvenido de Nuevo!' : 'Crea tu Cuenta'}</Text>
          <Text style={styles.subtitle}>Inicia sesión para gestionar tus pedidos de polerones.</Text>
        </View>

        <View style={styles.formCard}>
          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre Completo</Text>
              <View style={styles.inputWrapper}>
                <User size={20} color="#94A3B8" style={styles.icon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Ej: Juan Pérez" 
                  placeholderTextColor="#64748B"
                  value={nombre}
                  onChangeText={setNombre}
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo Electrónico</Text>
            <View style={styles.inputWrapper}>
              <Mail size={20} color="#94A3B8" style={styles.icon} />
              <TextInput 
                style={styles.input} 
                placeholder="usuario@ejemplo.com" 
                placeholderTextColor="#64748B"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputWrapper}>
              <Lock size={20} color="#94A3B8" style={styles.icon} />
              <TextInput 
                style={styles.input} 
                placeholder="••••••••" 
                placeholderTextColor="#64748B"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.mainButton, { backgroundColor: isLogin ? '#3B82F6' : '#10B981' }]} 
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.buttonText}>{isLogin ? 'Entrar' : 'Registrarse'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.switchButton} 
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={styles.switchText}>
              {isLogin ? '¿No tienes cuenta? Registrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  scrollContent: { padding: 24, paddingTop: 60 },
  headerBox: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { 
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#1E293B', 
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#334155'
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  formCard: { backgroundColor: '#1E293B', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: '#334155' },
  inputGroup: { marginBottom: 20 },
  label: { color: '#94A3B8', fontSize: 14, marginBottom: 8, fontWeight: '500' },
  inputWrapper: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', 
    borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12 
  },
  icon: { marginRight: 10 },
  input: { flex: 1, color: '#F1F5F9', paddingVertical: 14, fontSize: 15 },
  mainButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#38BDF8', fontSize: 14 }
});
