import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export class CryptoUtils {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly SALT_LENGTH = 64;
  private static readonly TAG_LENGTH = 16;
  private static readonly KEY_LENGTH = 32;

  static async encrypt(data: any): Promise<string> {
    const iv = randomBytes(this.IV_LENGTH);
    const salt = randomBytes(this.SALT_LENGTH);
    const key = await this.deriveKey(salt);

    const cipher = createCipheriv(this.ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);

    const tag = cipher.getAuthTag();

    // Combine all components
    const result = Buffer.concat([salt, iv, tag, encrypted]);

    return result.toString('base64');
  }

  static async decrypt(encryptedData: string): Promise<any> {
    const buffer = Buffer.from(encryptedData, 'base64');

    // Extract components
    const salt = buffer.slice(0, this.SALT_LENGTH);
    const iv = buffer.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
    const tag = buffer.slice(
      this.SALT_LENGTH + this.IV_LENGTH,
      this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH,
    );
    const encrypted = buffer.slice(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);

    const key = await this.deriveKey(salt);

    const decipher = createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return JSON.parse(decrypted.toString('utf8'));
  }

  private static async deriveKey(salt: Buffer): Promise<Buffer> {
    // In a real implementation, this would use PBKDF2 or similar
    // For now, we'll use a simple key derivation
    return Buffer.from(process.env.RECALL_PRIVATE_KEY || '').slice(0, this.KEY_LENGTH);
  }
}
