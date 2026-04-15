import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Image, ScrollView } from 'react-native';
import { Settings, LogOut, User, Calculator, ShoppingBag, LayoutDashboard } from 'lucide-react-native';
import { auth } from '../services/firebaseConfig';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { getUserProfile } from '../services/firebaseOrderService';
import { Alert, ActivityIndicator } from 'react-native';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [user, setUser] = React.useState(auth.currentUser);
  const [profile, setProfile] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      setUser(currUser);
      if (currUser) {
        setIsLoading(true);
        const userProfile = await getUserProfile(currUser.uid);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthPress = () => {
    if (user) {
      Alert.alert(
        'Cerrar Sesión',
        '¿Estás seguro de que quieres salir?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', onPress: () => signOut(auth) }
        ]
      );
    } else {
      navigation.navigate('Auth');
    }
  };

  const role = profile?.role || 'student';
  const isAdmin = role === 'admin' || user?.email === 'inzunzajuan202@gmail.com';
  const isManager = role === 'manager' || isAdmin;

  if (isLoading) {
      return (
          <View style={[styles.container, styles.centered]}>
              <ActivityIndicator size="large" color="#3B82F6" />
          </View>
      );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
          <View style={styles.logoRow}>
            <Image 
                source={require('../../assets/icon.png')} 
                style={styles.miniLogo} 
                resizeMode="contain"
            />
            <Text style={styles.brandName}>Tu Polerón</Text>
          </View>

          <View style={styles.topActions}>
            <TouchableOpacity 
                style={styles.circleBtn} 
                onPress={() => navigation.navigate('Admin')}
                activeOpacity={0.7}
            >
                <Settings color="#9CA3AF" size={22} />
            </TouchableOpacity>
            
            <TouchableOpacity 
                style={styles.circleBtn} 
                onPress={handleAuthPress}
            >
                {user ? <LogOut color="#EF4444" size={22} /> : <User color="#9CA3AF" size={22} />}
            </TouchableOpacity>
          </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
            <View style={styles.logoContainer}>
                <Image 
                    source={require('../../assets/icon.png')} 
                    style={styles.mainLogo} 
                    resizeMode="contain"
                />
            </View>
            <Text style={styles.welcomeText}>
                {user ? `¡Hola, ${profile?.nombre || 'Usuario'}!` : '¡Bienvenido!'}
            </Text>
            <Text style={styles.subtitle}>
                Tu plataforma integral para el polerón de tu generación.
            </Text>
        </View>

        {!user ? (
            <View style={styles.authCard}>
                <Text style={styles.authTitle}>Comienza Ahora</Text>
                <Text style={styles.authDesc}>Inicia sesión para guardar tus medidas y gestionar pedidos.</Text>
                <TouchableOpacity 
                    style={styles.loginBtn}
                    onPress={() => navigation.navigate('Auth')}
                >
                    <Text style={styles.loginBtnText}>Ingresar / Registrarse</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <View style={styles.profileBadge}>
                <LayoutDashboard size={16} color="#3B82F6" />
                <Text style={styles.profileBadgeText}>
                    Panel de {role === 'admin' ? 'Administrador' : role === 'manager' ? 'Encargado' : 'Alumno'}
                </Text>
            </View>
        )}

        <View style={styles.actionsGrid}>
            <Text style={styles.sectionTitle}>Acciones Disponibles</Text>
            
            {/* Botón Calculadora: Solo visible tras iniciar sesión */}
            {user && (
                <TouchableOpacity 
                    style={styles.actionCard}
                    onPress={() => navigation.navigate('Client')}
                    activeOpacity={0.8}
                >
                    <View style={[styles.actionIcon, { backgroundColor: '#3B82F620' }]}>
                        <Calculator color="#3B82F6" size={28} />
                    </View>
                    <View style={styles.actionInfo}>
                        <Text style={styles.actionTitle}>Calculadora de Talla</Text>
                        <Text style={styles.actionDesc}>Obtén tu talla ideal ingresando tus medidas.</Text>
                    </View>
                </TouchableOpacity>
            )}

            {/* Botón Pedido Grupal: Solo Encargado y Admin */}
            {(isManager || isAdmin) && (
                <TouchableOpacity 
                    style={[styles.actionCard, { marginTop: 16 }]}
                    onPress={() => navigation.navigate('TeacherOrder')}
                    activeOpacity={0.8}
                >
                    <View style={[styles.actionIcon, { backgroundColor: '#10B98120' }]}>
                        <ShoppingBag color="#10B981" size={28} />
                    </View>
                    <View style={styles.actionInfo}>
                        <Text style={styles.actionTitle}>Realizar Pedido Grupal</Text>
                        <Text style={styles.actionDesc}>Gestiona el pedido completo de tu curso.</Text>
                    </View>
                </TouchableOpacity>
            )}

            {/* Botón Panel Administrador: Solo visible para Admins */}
            {isAdmin && (
                <TouchableOpacity 
                    style={[styles.actionCard, { marginTop: 16, borderColor: '#3B82F6' }]}
                    onPress={() => navigation.navigate('Admin')}
                    activeOpacity={0.8}
                >
                    <View style={[styles.actionIcon, { backgroundColor: '#3B82F620' }]}>
                        <LayoutDashboard color="#3B82F6" size={28} />
                    </View>
                    <View style={styles.actionInfo}>
                        <Text style={styles.actionTitle}>Panel Administrador</Text>
                        <Text style={styles.actionDesc}>Configura tallas, gestiona pedidos y notificaciones.</Text>
                    </View>
                </TouchableOpacity>
            )}
        </View>

        <View style={styles.infoFooter}>
            <Text style={styles.footerText}>Versión 1.2.2</Text>
            <Text style={styles.footerText}>© 2024 Tu Polerón App</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 10,
  },
  brandName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  topActions: {
    flexDirection: 'row',
    gap: 12,
  },
  circleBtn: {
    backgroundColor: '#1E293B',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  logoContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  mainLogo: {
    width: 70,
    height: 70,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  authCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 32,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  authDesc: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
    lineHeight: 20,
  },
  loginBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F615',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B82F630',
    marginBottom: 32,
    gap: 8,
  },
  profileBadgeText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  actionsGrid: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 16,
    marginLeft: 4,
  },
  actionCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  infoFooter: {
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#475569',
  },
});
