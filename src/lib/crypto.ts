import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-secret-key-for-development';

/**
 * Encrypts a plaintext message using AES.
 * @param text The plaintext message to encrypt.
 * @returns The encrypted cipher text.
 */
export const encryptMessage = (text: string): string => {
    try {
        return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
    } catch (error) {
        console.error('[Crypto] Encryption error:', error);
        return text; // Fallback to original text if encryption fails
    }
};

/**
 * Decrypts a cipher text message using AES.
 * Supports backward compatibility by returning the original text if decryption fails.
 * @param cipherText The encrypted cipher text to decrypt.
 * @returns The decrypted plaintext message.
 */
export const decryptMessage = (cipherText: string): string => {
    if (!cipherText) return '';

    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_KEY);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

        // If decryptedText is empty, it might be an unencrypted message
        if (!decryptedText) {
            return cipherText;
        }

        return decryptedText;
    } catch (error) {
        // Decryption failed, likely an old unencrypted message
        console.warn('[Crypto] Decryption failed, returning original text (likely unencrypted)');
        return cipherText;
    }
};
