import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface IEncryptionService {
  encrypt(data: string, key: string): EncryptedData;
  decrypt(encrypted: EncryptedData, key: string): string;
  generateKey(): string;
}

export interface EncryptedData {
  iv: string;
  encryptedData: string;
  algorithm: string;
}

export class AesEncryptionService implements IEncryptionService {
  private readonly _algorithm: string;

  constructor(algorithm: string = 'aes-256-gcm') {
    this._algorithm = algorithm;
  }

  encrypt(data: string, key: string): EncryptedData {
    const iv = randomBytes(16);
    const keyBuffer = Buffer.from(key, 'hex').length === 32
      ? Buffer.from(key, 'hex')
      : Buffer.from(key.padEnd(32, '0'));
    const cipher = createCipheriv(this._algorithm, keyBuffer, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      algorithm: this._algorithm,
    };
  }

  decrypt(encrypted: EncryptedData, key: string): string {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const keyBuffer = Buffer.from(key, 'hex').length === 32
      ? Buffer.from(key, 'hex')
      : Buffer.from(key.padEnd(32, '0'));
    const decipher = createDecipheriv(encrypted.algorithm, keyBuffer, iv);

    let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  generateKey(): string {
    return randomBytes(32).toString('hex');
  }
}
