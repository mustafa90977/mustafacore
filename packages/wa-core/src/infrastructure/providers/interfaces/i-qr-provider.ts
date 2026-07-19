import { UniqueId } from '@wacore/shared';

export interface IQrProvider {
  getQRCode(instanceId: UniqueId): Promise<QrCodeData>;
  onQRUpdate(instanceId: UniqueId, callback: (qr: QrCodeData) => void): void;
  isQRExpired(instanceId: UniqueId): boolean;
}

export interface QrCodeData {
  qr: string;
  expiryRemaining: number;
  generatedAt: Date;
  expiresAt: Date;
}
