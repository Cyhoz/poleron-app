import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Image } from 'react-native';
import { Ruler, Settings, LogOut, User } from 'lucide-react-native';
import { auth } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const user = auth.currentUser;

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.circleBtn} 
            onPress={handleAuthPress}
          >
            {user ? <LogOut color="#EF4444" size={22} /> : <User color="#9CA3AF" size={22} />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.circleBtn} 
            onPress={() => navigation.navigate('Admin')}
            activeOpacity={0.7}
          >
            <Settings color="#9CA3AF" size={22} />
          </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Image 
            source={require('../../assets/icon.png')} 
            style={{ width: 85, height: 85, borderRadius: 10 }} 
            resizeMode="contain"
          />
        </View>
        
        <Text style={styles.title}>Encuentra tu Talla Ideal</Text>
        <Text style={styles.subtitle}>
          Te ayudamos a elegir el polerón perfecto basándonos en tus medidas corporales.
        </Text>

        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Client')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Calcular Mi Talla</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%'
  },
  circleBtn: {
    backgroundColor: '#1F2937',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#374151'
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    backgroundColor: '#1F2937',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#374151',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F9FAFB',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    width: width - 48,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
