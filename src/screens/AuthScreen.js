import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Linking 
} from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { LogIn, UserPlus, Mail, Lock, User, GraduationCap, School, BookOpen, MessageCircle } from 'lucide-react-native';
import { 
  checkManagerExists, registerCourseManager, checkNameAuthorized, 
  subscribeToAppData, getAuditLists, checkIdentityOffline, auditSchool 
} from '../services/firebaseOrderService';
import { CURSOS } from '../constants/chileData';

export default function AuthScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [role, setRole] = useState('student'); // 'student' or 'manager'
  const [colegio, setColegio] = useState('');
  const [curso, setCurso] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);
  
  // Estados de Auditoría
  const [auditLists, setAuditLists] = useState({ validNames: [], commonNames: [], commonSurnames: [] });
  const [isNameValid, setIsNameValid] = useState(null); // null: empty, true: valid, false: invalid
  const [isSchoolValid, setIsSchoolValid] = useState(null);

  React.useEffect(() => {
    const unsub = subscribeToAppData(data => {
      if (data?.whatsappSupport) setWhatsappNumber(data.whatsappSupport);
      if (data?.schools) {
        const parsed = data.schools.map(s => typeof s === 'string' ? s : s.nombre);
        setSchoolsList(parsed);
      }
    });

    // Cargar listas de auditoría una sola vez
    getAuditLists().then(setAuditLists);

    return unsub;
  }, []);

  // Validación en tiempo real del nombre
  React.useEffect(() => {
    if (!nombre.trim()) {
      setIsNameValid(null);
    } else {
      const isValid = checkIdentityOffline(nombre, auditLists);
      setIsNameValid(isValid);
    }
  }, [nombre, auditLists]);

  // Validación en tiempo real del colegio
  React.useEffect(() => {
    if (!colegio.trim()) {
      setIsSchoolValid(null);
    } else {
      const isValid = auditSchool(colegio, schoolsList);
      setIsSchoolValid(isValid);
    }
  }, [colegio, schoolsList]);

  const openSoporteWhatsApp = () => {
    const phone = whatsappNumber || '+56900000000';
    const msg = `Hola, mi nombre es ${nombre || '[Tu Nombre]'} y no figuro en la lista oficial para registrarme en la app Polerón. ¿Me podrían ayudar?`;
    const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(msg)}`);
    });
  };

  const handleSchoolSearch = (text) => {
    setColegio(text);
    if (text.length > 0) {
      const filtered = schoolsList.filter(s => s.toLowerCase().includes(text.toLowerCase()));
      setFilteredSchools(filtered);
      setShowSchoolPicker(true);
    } else {
      setShowSchoolPicker(false);
    }
  };

  const selectSchool = (schoolName) => {
    setColegio(schoolName);
    setShowSchoolPicker(false);
  };

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && (!nombre || !colegio || !curso))) {
      Alert.alert('Error', 'Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Validar Colegio usando el servicio robusto (normalizado)
        if (!auditSchool(colegio, schoolsList)) {
          Alert.alert(
            'Colegio No Válido',
            'Debes seleccionar un colegio válido de nuestra lista oficial.'
          );
          setLoading(false);
          return;
        }

        // BLINDAJE: Verificar si el nombre está autorizado
        const isAuthorized = await checkNameAuthorized(nombre);
        if (!isAuthorized) {
          Alert.alert(
            'Nombre No Autorizado',
            'Tu nombre no figura en la lista oficial proporcionada por la administración. Por favor, contacta a soporte por WhatsApp si crees que es un error.'
          );
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Si es encargado, verificar que no exista otro para ese curso
        if (role === 'manager') {
          const exists = await checkManagerExists(colegio, curso);
          if (exists) {
            await user.delete(); 
            Alert.alert('Error', `Ya existe un encargado registrado para el curso ${curso} de ${colegio}.`);
            setLoading(false);
            return;
          }
          await registerCourseManager(user.uid, colegio, curso);
        }

        // Guardar datos adicionales del usuario en Firestore
        await setDoc(doc(db, "users", user.uid), {
          nombre: nombre,
          email: email,
          school: colegio,
          course: curso,
          createdAt: new Date().toISOString(),
          role: role
        });
      }
    } catch (error) {
      console.error(error);
      let alertMsg = 'Ocurrió un error al procesar tu solicitud.';
      if (error.code === 'auth/email-already-in-use') alertMsg = 'Este correo ya está registrado.';
      if (error.code === 'auth/wrong-password') alertMsg = 'Contraseña incorrecta.';
      if (error.code === 'auth/user-not-found') alertMsg = 'Usuario no encontrado.';
      Alert.alert('Error', alertMsg);
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
            {isLogin ? <LogIn size={32} color="#3B82F6" /> : <UserPlus size={32} color="#10B981" />}
          </View>
          <Text style={styles.title}>{isLogin ? 'Bienvenido de Nuevo' : 'Crea tu Cuenta'}</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Ingresa tus credenciales para continuar' : 'Únete a la plataforma oficial de tu generación'}
          </Text>
        </View>

        <View style={styles.formCard}>
          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre Completo (Real)</Text>
              <View style={[
                styles.inputWrapper, 
                isNameValid === true && styles.inputValid, 
                isNameValid === false && styles.inputInvalid
              ]}>
                <User size={20} color="#94A3B8" style={styles.icon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Ej: Juan Pérez" 
                  placeholderTextColor="#64748B"
                  value={nombre}
                  onChangeText={setNombre}
                />
              </View>
              {isNameValid === false && (
                <Text style={styles.errorHint}>Nombre no reconocido en nuestra base de datos.</Text>
              )}
            </View>
          )}

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tipo de Perfil</Text>
              <View style={styles.roleContainer}>
                <TouchableOpacity 
                  style={[styles.roleOption, role === 'student' && styles.roleActive]} 
                  onPress={() => setRole('student')}
                >
                  <GraduationCap size={20} color={role === 'student' ? '#fff' : '#94A3B8'} />
                  <Text style={[styles.roleText, role === 'student' && styles.roleTextActive]}>Alumno</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.roleOption, role === 'manager' && styles.roleActive]} 
                  onPress={() => setRole('manager')}
                >
                  <User size={20} color={role === 'manager' ? '#fff' : '#94A3B8'} />
                  <Text style={[styles.roleText, role === 'manager' && styles.roleTextActive]}>Encargado</Text>
                </TouchableOpacity>
              </View>
              {role === 'manager' && (
                <Text style={styles.infoHint}>Como encargado podrás gestionar el pedido de todo tu curso.</Text>
              )}
            </View>
          )}

          {!isLogin && (
            <>
              <View style={[styles.inputGroup, { zIndex: 50 }]}>
                <Text style={styles.label}>Colegio / Institución</Text>
                <View style={[
                  styles.inputWrapper,
                  isSchoolValid === true && styles.inputValid,
                  isSchoolValid === false && styles.inputInvalid
                ]}>
                  <School size={20} color="#94A3B8" style={styles.icon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Ej: Instituto Nacional" 
                    placeholderTextColor="#64748B"
                    value={colegio}
                    onChangeText={handleSchoolSearch}
                  />
                </View>
                {showSchoolPicker && filteredSchools.length > 0 && (
                  <View style={styles.autocompleteDropdown}>
                    <ScrollView style={{maxHeight: 150}} keyboardShouldPersistTaps="handled">
                      {filteredSchools.map((s, idx) => (
                        <TouchableOpacity 
                          key={idx} 
                          style={styles.autocompleteOption} 
                          onPress={() => selectSchool(s)}
                        >
                          <Text style={styles.autocompleteOptionText}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={[styles.inputGroup, { zIndex: 10 }]}>
                <Text style={styles.label}>Curso / Generación</Text>
                <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowCoursePicker(true)}>
                  <BookOpen size={20} color="#94A3B8" style={styles.icon} />
                  <Text style={[styles.input, { color: curso ? '#F1F5F9' : '#64748B', paddingTop: 14 }]}>
                    {curso || 'Selecciona tu curso'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
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
            style={[
              styles.mainButton, 
              { backgroundColor: isLogin ? '#3B82F6' : '#10B981' },
              (!isLogin && (isNameValid !== true || isSchoolValid !== true)) && styles.buttonDisabled
            ]} 
            onPress={handleAuth}
            disabled={loading || (!isLogin && (isNameValid !== true || isSchoolValid !== true))}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.buttonText}>{isLogin ? 'Entrar' : 'Registrarse'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.switchButton} 
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={styles.footerText}>
              {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            </Text>
            <Text style={styles.footerLink}>
              {isLogin ? 'Regístrate' : 'Inicia Sesión'}
            </Text>
          </TouchableOpacity>

          {!isLogin && (
            <TouchableOpacity style={styles.whatsappSupportBtn} onPress={openSoporteWhatsApp}>
              <MessageCircle color="#25D366" size={20} style={{marginRight: 8}} />
              <Text style={styles.whatsappSupportText}>¿No apareces en la lista? Contacta a soporte</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {showCoursePicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecciona tu Curso</Text>
            <ScrollView style={{maxHeight: 300}}>
              {CURSOS.map((c) => (
                <TouchableOpacity 
                  key={c} 
                  style={styles.modalOption} 
                  onPress={() => { setCurso(c); setShowCoursePicker(false); }}
                >
                  <Text style={styles.modalOptionText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.closeModalBtn} 
              onPress={() => setShowCoursePicker(false)}
            >
              <Text style={styles.closeModalText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  switchButton: { marginTop: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  roleContainer: { flexDirection: 'row', gap: 10, marginTop: 5 },
  roleOption: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 12, borderRadius: 12, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', gap: 8
  },
  roleActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  roleText: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
  roleTextActive: { color: '#fff' },
  footerText: { color: '#94A3B8', fontSize: 14 },
  footerLink: {
    color: '#3B82F6',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  whatsappSupportBtn: {
    marginTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    width: '100%'
  },
  whatsappSupportText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500'
  },
  infoHint: { color: '#38BDF8', fontSize: 12, marginTop: 8, paddingHorizontal: 4 },
  modalOverlay: { 
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000
  },
  modalContent: { backgroundColor: '#1E293B', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalOption: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalOptionText: { color: '#F1F5F9', fontSize: 16, textAlign: 'center' },
  closeModalBtn: { marginTop: 20, padding: 15, alignItems: 'center' },
  closeModalText: { color: '#94A3B8', fontSize: 14 },
  autocompleteDropdown: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  autocompleteOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  autocompleteOptionText: {
    color: '#F1F5F9',
    fontSize: 15
  },
  inputValid: {
    borderColor: '#10B981',
    borderWidth: 1.5,
  },
  inputInvalid: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  errorHint: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5
  },
  buttonDisabled: {
    opacity: 0.5,
  }
});
