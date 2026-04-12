# Guía de Mantenimiento - Tu Polerón (Apps)

Este proyecto es una solución multiplataforma para la gestión de tallas de polerones. A continuación se explica la estructura para facilitar el mantenimiento futuro.

## Estructura de Carpetas

### 1. `/android`
Contiene el proyecto nativo de Android. 
- **Mantenimiento:** Aquí se gestionan permisos, iconos de la app y configuraciones de compilación de Gradle.
- **Importante:** No modifiques `gradle.properties` sin probar primero la compilación local.

### 2. `/src` (Móvil - React Native)
Aquí reside la lógica de la aplicación móvil (Android/iOS).
- `constants/`: Datos estáticos como regiones, comunas y colegios.
- `screens/`: Vistas de la aplicación (Cliente y Administración).
- `services/`: Conexión con Firebase Firestore y autenticación.

### 3. `/web-version` (Web - React Vite)
Versión optimizada para navegadores.
- Usa **Vite** para una carga ultrarrápida.
- La lógica es deliberadamente similar a la versión móvil para facilitar cambios en ambas plataformas.

### 4. `/backend` (Opcional - Node.js)
Un servidor Node.js independiente.
- Actualmente configurado para gestionar copias de seguridad o lógica pesada que no se quiera en el dispositivo del cliente.

### 5. `/scripts`
Scripts de utilidad para el desarrollador.
- `build-full-apk.bat`: Limpia caché de Metro, exporta el bundle y genera el APK. es el más recomendado para versiones estables.
- `build-local-apk.bat`: Solo compila el código nativo actual.

---

## Cómo compilar una nueva versión (APK)

1. Asegúrate de tener las dependencias al día: `npm install`.
2. Ejecuta: `npm run local-apk-full`.
3. El archivo resultante estará en `android/app/build/outputs/apk/release/app-release.apk`.

## Notas de Seguridad
- Las llaves de Firebase están en el archivo `.env` en la raíz.
- No compartas el archivo `serviceAccountKey.json` fuera del entorno de producción.
