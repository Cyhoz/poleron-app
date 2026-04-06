import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Image } from 'react-native';
import { Ruler, Settings } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.adminButton} 
        onPress={() => navigation.navigate('Admin')}
        activeOpacity={0.7}
      >
        <Settings color="#9CA3AF" size={24} />
      </TouchableOpacity>

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
  adminButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
    zIndex: 10,
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
