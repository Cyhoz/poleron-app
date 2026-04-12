const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

// Algoritmo de cifrado (AES-256-GCM es el estándar de oro)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Longitud del vector de inicialización para GCM
const AUTH_TAG_LENGTH = 16; 

// La ENCRYPTION_KEY debe ser de 32 bytes (256 bits)
// Si no existe en .env, usamos un fallback (pero se debe configurar en Render)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'; 

/**
 * Cifra un texto plano
 */
function encrypt(text) {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag().toString('hex');
        
        // Retornamos IV + AuthTag + Texto Cifrado (unificado para guardar en un solo campo)
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
        console.error('Error en cifrado:', error);
        return text; // Fallback al texto original en caso de error crítico
    }
}

/**
 * Descifra un texto cifrado
 */
function decrypt(encryptedData) {
    if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
    
    try {
        const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
        
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        // Si falla el descifrado, es probable que el dato no esté cifrado o la llave sea distinta
        return encryptedData; 
    }
}

module.exports = { encrypt, decrypt };
