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

    // Check if it looks like a CryptoJS encrypted string (starts with "Salted__" in base64 is "U2FsdGVk")
    const isEncrypted = cipherText.startsWith('U2FsdGVk');

    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_KEY);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

        // If decryptedText is empty but input looked encrypted, the key is likely wrong
        if (!decryptedText && isEncrypted) {
            console.warn('[Crypto] Decryption yielded empty string (Wrong Key?)');
            return '[Message Encrypted]';
        }

        // If decryptedText is empty and it didn't look encrypted, it might be just valid empty string or garbage
        if (!decryptedText) {
            return cipherText;
        }

        return decryptedText;
    } catch (error) {
        // If it was definitely encrypted but failed, show error
        if (isEncrypted) {
            console.error('[Crypto] Decryption failed for encrypted message:', error);
            return '[Message Encrypted]';
        }

        // Otherwise assume it was plain text
        return cipherText;
    }
};
