import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Screens
import HomeScreen from './src/screens/HomeScreen';
import AdminScreen from './src/screens/AdminScreen';
import ClientScreen from './src/screens/ClientScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  React.useEffect(() => {
    async function prepare() {
      try {
        // Keep splash screen visible for a bit to ensure everything is loaded
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e) {
        console.warn(e);
      } finally {
        try {
          await SplashScreen.hideAsync();
        } catch (e) {
          console.error("SplashScreen.hideAsync error:", e);
        }
      }
    }
    prepare();
  }, []);

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
