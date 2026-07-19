import { EventEmitter } from 'events';
import { UniqueId } from '@wacore/shared';
import { ProviderType } from '../../../domain/enums/provider-type';
import { ConnectionStatus } from '../../../domain/enums/connection-status';
import { MessageType } from '../../../domain/enums/message-type';

export interface IProvider extends EventEmitter {
  readonly providerType: ProviderType;
  readonly instanceId: UniqueId;

  connect(options?: ConnectionOptions): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  getConnectionStatus(): ConnectionStatus;

  getQRCode(): Promise<QRCodeResult>;

  sendMessage(options: SendMessageOptions): Promise<SendMessageResult>;

  sendPresenceUpdate(presence: PresenceType, to: string): Promise<void>;
  sendReadReceipt(messageId: string): Promise<void>;

  saveAuthState(): Promise<AuthState>;
  loadAuthState(state: AuthState): Promise<void>;
  logout(): Promise<void>;

  downloadMedia(messageId: string): Promise<Buffer>;
  uploadMedia(buffer: Buffer, type: MediaType): Promise<string>;

  destroy(): Promise<void>;
}

export interface ConnectionOptions {
  authState?: AuthState;
  qrTimeout?: number;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
}

export interface ConnectionResult {
  success: boolean;
  status: ConnectionStatus;
  error?: string;
}

export interface QRCodeResult {
  qr: string | null;
  expiryRemaining?: number;
  error?: string;
}

export interface SendMessageOptions {
  to: string;
  type: MessageType;
  content: MessageContent;
  quotedMessageId?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  timestamp?: Date;
  error?: string;
  retryable?: boolean;
}

export interface MessageContent {
  text?: string;
  caption?: string;
  fileName?: string;
  fileSize?: number;
  mimetype?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactPhone?: string;
  buffer?: Buffer;
}

export interface AuthState {
  creds: Record<string, unknown>;
  keys: Record<string, unknown>;
}

export type PresenceType = 'composing' | 'recording' | 'paused' | 'available' | 'unavailable';

export type MediaType = 'image' | 'video' | 'audio' | 'document';
