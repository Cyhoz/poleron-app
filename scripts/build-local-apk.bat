:: 1. Subir a la raiz
cd ..

:: 2. Navegamos a la carpeta de Android
cd android

:: 2. Limpiamos y construimos el APK de lanzamiento
call gradlew.bat assembleRelease

echo.
echo ¡Hecho! El APK se encuentra en: android\app\build\outputs\apk\release\app-release.apk

pause
