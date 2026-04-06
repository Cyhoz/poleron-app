import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import AdminScreen from './src/screens/AdminScreen';
import ClientScreen from './src/screens/ClientScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#111827' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ title: 'Inicio', headerShown: false }} 
          />
          <Stack.Screen 
            name="Client" 
            component={ClientScreen} 
            options={{ title: 'Recomendación Talla' }} 
          />
          <Stack.Screen 
            name="Admin" 
            component={AdminScreen} 
            options={{ title: 'Panel Administrador', headerBackTitle: 'Atrás' }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
