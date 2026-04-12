@echo off
echo ===================================================
echo   CONSTRUCCION DE APK ESTABLE PARA "TU POLERON"
echo ===================================================
echo.

:: 1. Subir a la raiz para ejecutar correctamente
cd ..

:: 2. Limpieza de cache de Metro
echo [1/4] Limpiando cache de empaquetado...
set NODE_OPTIONS=--no-experimental-strip-types
call npx expo export:embed --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

:: 2. Crear carpeta de assets si no existe
if not exist android\app\src\main\assets mkdir android\app\src\main\assets

:: 3. Navegar a carpeta Android y compilar
echo.
echo [2/4] Compilando APK con Gradle (Release)...
cd android
call gradlew.bat --stop
call gradlew.bat clean assembleRelease

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] La compilacion nativa fallo. Revisa los errores arriba.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/4] APK generado con exito.
echo.
echo [4/4] Ubicacion del archivo:
echo android\app\build\outputs\apk\release\app-release.apk
echo.
echo Redirigiendo a la carpeta de salida...
explorer app\build\outputs\apk\release\
echo.
echo Terminado. Ahora puedes instalar el APK en tu celular.
pause
