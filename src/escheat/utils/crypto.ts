import { ethers } from 'ethers';

export class CryptoUtils {
  /**
   * Encrypts data using AES-256-GCM
   */
  static async encrypt(data: string, key: string): Promise<string> {
    try {
      // Derive a 32-byte key using PBKDF2
      const salt = ethers.randomBytes(16);
      const derivedKey = await this.deriveKey(key, salt);

      // Generate a random IV
      const iv = ethers.randomBytes(12);

      // Encrypt the data
      const algorithm = { name: 'AES-GCM', iv: iv };
      const encodedData = new TextEncoder().encode(data);
      const cryptoKey = await crypto.subtle.importKey('raw', derivedKey, 'AES-GCM', false, [
        'encrypt',
      ]);

      const encryptedData = await crypto.subtle.encrypt(algorithm, cryptoKey, encodedData);

      // Combine salt + iv + encrypted data
      const result = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
      result.set(salt, 0);
      result.set(iv, salt.length);
      result.set(new Uint8Array(encryptedData), salt.length + iv.length);

      // Return as base64
      return Buffer.from(result).toString('base64');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error during encryption';
      throw new Error(`Encryption failed: ${message}`);
    }
  }

  /**
   * Decrypts data using AES-256-GCM
   */
  static async decrypt(encryptedData: string, key: string): Promise<string> {
    try {
      // Decode base64
      const data = Buffer.from(encryptedData, 'base64');

      // Extract salt, iv, and encrypted data
      const salt = data.slice(0, 16);
      const iv = data.slice(16, 28);
      const encrypted = data.slice(28);

      // Derive the key
      const derivedKey = await this.deriveKey(key, salt);

      // Decrypt the data
      const algorithm = { name: 'AES-GCM', iv: iv };
      const cryptoKey = await crypto.subtle.importKey('raw', derivedKey, 'AES-GCM', false, [
        'decrypt',
      ]);

      const decryptedData = await crypto.subtle.decrypt(algorithm, cryptoKey, encrypted);

      return new TextDecoder().decode(decryptedData);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error during decryption';
      throw new Error(`Decryption failed: ${message}`);
    }
  }

  /**
   * Derives a key using PBKDF2
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const importedKey = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, [
      'deriveBits',
    ]);

    return crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      importedKey,
      256,
    );
  }

  /**
   * Generates a random encryption key
   */
  static generateEncryptionKey(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }
}
