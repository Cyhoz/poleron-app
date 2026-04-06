// Función para enviar datos a Google Forms de manera silenciosa
// Reemplaza <FORM_ID> y <ENTRY_ID> con los correctos de tu formulario.

const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/<FORM_ID>/formResponse';

// Entradas simuladas. Debes obtenerlas desde la vista "Obtener vínculo prellenado" de tu formulario.
const ENTRY_NOMBRE = 'entry.<ENTRY_ID_0>';
const ENTRY_PECHO = 'entry.<ENTRY_ID_1>';
const ENTRY_LARGO = 'entry.<ENTRY_ID_2>';
const ENTRY_MANGA = 'entry.<ENTRY_ID_3>';
const ENTRY_TALLA = 'entry.<ENTRY_ID_4>';

export const submitToGoogleForms = async (nombre, pecho, largo, manga, talla) => {
  if (GOOGLE_FORM_URL.includes('<FORM_ID>')) {
    console.warn('Google Form URL no configurada. Saltando envío.');
    return true; // Simular éxito en modo de desarrollo
  }

  try {
    const data = [
      `${encodeURIComponent(ENTRY_NOMBRE)}=${encodeURIComponent(nombre)}`,
      `${encodeURIComponent(ENTRY_PECHO)}=${encodeURIComponent(pecho.toString())}`,
      `${encodeURIComponent(ENTRY_LARGO)}=${encodeURIComponent(largo.toString())}`,
      `${encodeURIComponent(ENTRY_MANGA)}=${encodeURIComponent(manga.toString())}`,
      `${encodeURIComponent(ENTRY_TALLA)}=${encodeURIComponent(talla)}`
    ].join('&');

    await fetch(GOOGLE_FORM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data
    });

    return true;
  } catch (error) {
    console.error('Error al enviar a Google Forms:', error);
    return false;
  }
};
