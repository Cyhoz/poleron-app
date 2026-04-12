# Backend Nueva App Poleron (Chile Schools)

Este backend está construido con Node.js, Express y Firebase Firestore. Contiene información real de establecimientos educacionales en Chile.

## Requisitos

- Node.js instalado
- Un proyecto en Firebase Console
- Un archivo `serviceAccountKey.json` descargado desde Firebase (Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada).

## Instalación

1. Entra a la carpeta del backend:
   ```bash
   cd backend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura tus credenciales:
   - Copia el archivo `.env.example` a `.env`
   - Coloca tu archivo `serviceAccountKey.json` en la raíz de la carpeta `backend/`.

## Carga de Datos Reales

### 1. Carga de Muestra (Semilla)
Hemos incluido una lista de colegios emblemáticos y reales para pruebas inmediatas.
```bash
node scripts/seed.js
```

### 2. Carga del Directorio Completo (12,000+ colegios)
Para tener todos los colegios de Chile:
1. Ve a [Datos Abiertos MINEDUC](https://datosabiertos.mineduc.cl/directorio-de-establecimientos-educacionales/).
2. Descarga el "Directorio Oficial de Establecimientos" más reciente (2023 o 2024).
3. Descomprime el archivo `.rar` y guarda el `.csv` como `backend/data/directorio_completo.csv`.
4. Ejecuta:
   ```bash
   node scripts/import_full_csv.js
   ```

## Endpoints API

### Obtener colegios
`GET /api/schools`
- Params: `comuna`, `region`, `query` (búsqueda por nombre).
- Ejemplo: `http://localhost:3000/api/schools?comuna=SANTIAGO`

### Obtener un colegio por RBD
`GET /api/schools/:rbd`
- Ejemplo: `http://localhost:3000/api/schools/1` (Instituto Nacional)

## Tecnologías
- **Express**: Framework web.
- **Firebase Admin SDK**: Conexión con Firestore.
- **CSV-Parser**: Para procesar bases de datos masivas del MINEDUC.
