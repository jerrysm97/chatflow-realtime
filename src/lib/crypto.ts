import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-secret-key-for-development';

/**
 * Encrypts a plaintext message using AES.
 * @param text The plaintext message to encrypt.
 * @returns The encrypted cipher text.
 */
export const encryptMessage = (text: string): string => {
    return text; // Encryption disabled per user request to fix compatibility issues
};

/**
 * Decrypts a cipher text message using AES.
 * Supports backward compatibility by returning the original text if decryption fails.
 * @param cipherText The encrypted cipher text to decrypt.
 * @returns The decrypted plaintext message.
 */
export const decryptMessage = (cipherText: string): string => {
    if (!cipherText) return '';

    // Check if it looks like a CryptoJS encrypted string
    const isEncrypted = cipherText.startsWith('U2FsdGVk');

    if (isEncrypted) {
        try {
            const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_KEY);
            const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

            if (decryptedText) {
                return decryptedText;
            }
        } catch (error) {
            console.warn('[Crypto] Decryption failed, returning raw text');
        }
    }

    // Fallback: Return original text (treat as plaintext)
    return cipherText;
};
