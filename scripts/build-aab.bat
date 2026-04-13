@echo off
echo ==========================================
echo GENERANDO BUNDLE (.AAB) PARA GOOGLE PLAY
echo ==========================================
cd android
call gradlew.bat bundleRelease
echo ==========================================
echo PROCESO FINALIZADO
echo El archivo .aab se encuentra en:
echo android\app\build\outputs\bundle\release\app-release.aab
echo ==========================================
pause
