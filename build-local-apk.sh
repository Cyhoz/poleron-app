#!/usr/bin/env bash
# Local APK build script
echo "Generando APK localmente (Android Nativo Puro sin Expo)..."

# 1. Navegamos a la carpeta de Android
cd android || exit

# 2. Limpiamos y construimos el APK de lanzamiento
./gradlew clean assembleRelease

echo "¡Hecho! El APK se encuentra en: android/app/build/outputs/apk/release/app-release.apk"
