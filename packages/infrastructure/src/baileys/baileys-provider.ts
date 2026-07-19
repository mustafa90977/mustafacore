import { EventEmitter } from 'events';
import { UniqueId, ILogger, generateId } from '@wacore/shared';
import {
  IProvider,
  ProviderType,
  ConnectionStatus,
  ConnectionOptions,
  ConnectionResult,
  QRCodeResult,
  SendMessageOptions,
  SendMessageResult,
  AuthState,
  PresenceType,
  MediaType,
  MessageType,
} from '@wacore/wa-core';
import type { WASocket, ConnectionState, WAMessage } from '@whiskeysockets/baileys';
import { BaileysConfig } from './baileys-config';
import { BaileysSocketFactory, SocketInstance, SocketCallbacks } from './baileys-socket-factory';
import { BaileysEventMapper } from './baileys-event-mapper';
import { BaileysMessageMapper } from './baileys-message-mapper';
import { BaileysErrorMapper } from './baileys-error-mapper';

export interface BaileysProviderOptions {
  instanceId: UniqueId;
  logger: ILogger;
  config?: BaileysConfig;
}

export class BaileysProvider extends EventEmitter implements IProvider {
  readonly providerType: ProviderType = ProviderType.BAILEYS;
  readonly instanceId: UniqueId;

  private readonly _logger: ILogger;
  private readonly _config: BaileysConfig;
  private readonly _eventMapper: BaileysEventMapper;
  private readonly _messageMapper: BaileysMessageMapper;
  private readonly _socketFactory: BaileysSocketFactory;

  private _socketInstance: SocketInstance | null = null;
  private _socket: WASocket | null = null;
  private _status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private _qrCode: string | null = null;
  private _qrExpiry: NodeJS.Timeout | null = null;
  private _reconnectAttempts = 0;

  constructor(options: BaileysProviderOptions) {
    super();
    this.instanceId = options.instanceId;
    this._logger = options.logger.child({ module: 'BaileysProvider', instanceId: options.instanceId });
    this._config = options.config || {};
    this._eventMapper = new BaileysEventMapper({ instanceId: options.instanceId });
    this._messageMapper = new BaileysMessageMapper();
    this._socketFactory = new BaileysSocketFactory(options.logger, options.config);
  }

  async connect(_options?: ConnectionOptions): Promise<ConnectionResult> {
    try {
      this._status = ConnectionStatus.CONNECTING;
      this.emit('connecting', { instanceId: this.instanceId });

      const callbacks: SocketCallbacks = {
        onConnectionUpdate: (state) => this.handleConnectionUpdate(state),
        onMessagesUpsert: (data) => this.handleMessagesUpsert(data),
        onMessagesUpdate: (messages) => this.handleMessagesUpdate(messages),
        onCredsUpdate: () => this.handleCredsUpdate(),
      };

      this._socketInstance = await this._socketFactory.createSocket(this.instanceId, callbacks);
      this._socket = this._socketInstance.socket;

      this._logger.info('Baileys socket created, waiting for connection');
      return { success: true, status: this._status };
    } catch (error) {
      const errorInfo = BaileysErrorMapper.mapError(error as Error);
      this._status = ConnectionStatus.DISCONNECTED;
      this._logger.error('Failed to connect', error as Error);
      this.emit('error', { instanceId: this.instanceId, error: errorInfo.message });
      return { success: false, status: this._status, error: errorInfo.message };
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this._socketInstance) {
        this._socketInstance.cleanup();
      }
      if (this._socket) {
        this._socket.end(undefined);
        this._socket = null;
      }
      this._socketInstance = null;
      this._status = ConnectionStatus.DISCONNECTED;
      this._qrCode = null;
      this.clearQrExpiry();
      this._logger.info('Disconnected');
      this.emit('disconnected', { instanceId: this.instanceId });
    } catch (error) {
      this._logger.error('Error during disconnect', error as Error);
    }
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    this._status = ConnectionStatus.RECONNECTING;
    this.emit('reconnecting', { instanceId: this.instanceId });
    await this.connect();
  }

  getConnectionStatus(): ConnectionStatus {
    return this._status;
  }

  async getQRCode(): Promise<QRCodeResult> {
    if (this._qrCode) {
      return { qr: this._qrCode, expiryRemaining: this._config.qrTimeout };
    }
    return { qr: null, error: 'No QR code available' };
  }

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    if (!this._socket || this._status !== ConnectionStatus.CONNECTED) {
      return { success: false, error: 'Not connected', retryable: false };
    }

    try {
      const jid = this._messageMapper.toBaileysJid(options.to);
      const messageId = generateId();
      let result: any;

      switch (options.type) {
        case MessageType.TEXT:
          result = await this._socket.sendMessage(jid, {
            text: options.content.text || '',
          });
          break;
        case MessageType.IMAGE:
          result = await this._socket.sendMessage(jid, {
            image: options.content.buffer as any,
            caption: options.content.caption,
            mimetype: options.content.mimetype,
          });
          break;
        case MessageType.VIDEO:
          result = await this._socket.sendMessage(jid, {
            video: options.content.buffer as any,
            caption: options.content.caption,
            mimetype: options.content.mimetype,
          });
          break;
        case MessageType.AUDIO:
          result = await this._socket.sendMessage(jid, {
            audio: options.content.buffer as any,
            mimetype: options.content.mimetype,
          });
          break;
        case MessageType.FILE:
          result = await this._socket.sendMessage(jid, {
            document: options.content.buffer as any,
            fileName: options.content.fileName!,
            mimetype: options.content.mimetype || 'application/octet-stream',
          });
          break;
        case MessageType.LOCATION:
          result = await this._socket.sendMessage(jid, {
            location: {
              degreesLatitude: options.content.latitude || 0,
              degreesLongitude: options.content.longitude || 0,
            },
          });
          break;
        case MessageType.CONTACT:
          result = await this._socket.sendMessage(jid, {
            contacts: {
              displayName: options.content.contactName || '',
              contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${options.content.contactName}\nTEL;TYPE=CELL:${options.content.contactPhone}\nEND:VCARD` }],
            },
          });
          break;
        default:
          return { success: false, error: `Unsupported message type: ${options.type}`, retryable: false };
      }

      const sentMessage = this._messageMapper.toSentMessage(
        result?.key?.id || messageId,
        result,
        options.type,
      );

      this._logger.debug('Message sent', { externalId: sentMessage.externalId, type: options.type });
      return {
        success: true,
        messageId: sentMessage.messageId,
        timestamp: sentMessage.timestamp,
      };
    } catch (error) {
      const errorInfo = BaileysErrorMapper.mapError(error as Error);
      this._logger.error('Failed to send message', error as Error);
      return {
        success: false,
        error: errorInfo.message,
        retryable: errorInfo.isRecoverable,
      };
    }
  }

  async sendPresenceUpdate(presence: PresenceType, to: string): Promise<void> {
    if (!this._socket || this._status !== ConnectionStatus.CONNECTED) return;

    const jid = this._messageMapper.toBaileysJid(to);
    const baileysPresence = this.mapPresence(presence);
    await this._socket.sendPresenceUpdate(baileysPresence, jid);
  }

  async sendReadReceipt(messageId: string): Promise<void> {
    if (!this._socket || this._status !== ConnectionStatus.CONNECTED) return;
    this.emit('read_receipt_requested', { instanceId: this.instanceId, messageId });
  }

  async saveAuthState(): Promise<AuthState> {
    if (this._socketInstance) {
      await this._socketInstance.saveCreds();
    }
    return { creds: {}, keys: {} };
  }

  async loadAuthState(_state: AuthState): Promise<void> {
    this._logger.debug('Auth state loading delegated to file-based auth');
  }

  async logout(): Promise<void> {
    if (this._socket) {
      try {
        await this._socket.logout();
      } catch {
        // logout may throw if already disconnected
      }
    }
    await this.disconnect();
  }

  async downloadMedia(_messageId: string): Promise<Buffer> {
    if (!this._socket) throw new Error('Not connected');
    throw new Error('Media download not yet implemented — requires full message key resolution');
  }

  async uploadMedia(_buffer: Buffer, _type: MediaType): Promise<string> {
    if (!this._socket) throw new Error('Not connected');
    throw new Error('Media upload not yet implemented — requires media connection info');
  }

  async destroy(): Promise<void> {
    await this.disconnect();
    this.removeAllListeners();
    this._logger.info('Provider destroyed');
  }

  private handleConnectionUpdate(state: Partial<ConnectionState>): void {
    const normalized = this._eventMapper.mapConnectionUpdate(state);
    this._status = normalized.status;

    if (state.qr) {
      this._qrCode = state.qr;
      this._status = ConnectionStatus.QR_PENDING;
      this.startQrExpiry();
      this.emit('qr', { instanceId: this.instanceId, qr: state.qr });
    }

    if (normalized.status === ConnectionStatus.CONNECTED) {
      this._qrCode = null;
      this.clearQrExpiry();
      this._reconnectAttempts = 0;
    }

    if (normalized.status === ConnectionStatus.DISCONNECTED && normalized.isRecoverable) {
      this.handleAutoReconnect();
    }

    const domainEvent = this._eventMapper.toDomainEvent(normalized);
    this.emit('connection_update', normalized);
    this.emit('event', domainEvent);
  }

  private handleMessagesUpsert(data: { messages: WAMessage[]; type: string }): void {
    const normalized = this._eventMapper.mapMessageUpsert(data);

    for (const msg of normalized.messages) {
      const incoming = this._eventMapper.toIncomingMessage(msg);
      if (incoming) {
        this.emit('message_received', { instanceId: this.instanceId, message: incoming });
      }

      const statusUpdate = this._eventMapper.toStatusUpdate(msg);
      if (statusUpdate) {
        this.emit('message_status_update', statusUpdate);
      }
    }
  }

  private handleMessagesUpdate(messages: WAMessage[]): void {
    for (const msg of messages) {
      const statusUpdate = this._eventMapper.toStatusUpdate(msg);
      if (statusUpdate) {
        this.emit('message_status_update', statusUpdate);
      }
    }
  }

  private handleCredsUpdate(): void {
    this._logger.debug('Credentials updated');
    this.emit('creds_updated', { instanceId: this.instanceId });
  }

  private handleAutoReconnect(): void {
    const maxAttempts = this._config.maxReconnectAttempts || 5;
    if (this._reconnectAttempts >= maxAttempts) {
      this._logger.warn('Max reconnect attempts reached', { attempts: this._reconnectAttempts });
      this.emit('reconnect_failed', { instanceId: this.instanceId, attempts: this._reconnectAttempts });
      return;
    }

    this._reconnectAttempts++;
    const delay = this._config.reconnectIntervalMs || 5000;
    this._logger.info('Auto-reconnecting', { attempt: this._reconnectAttempts, delay });

    setTimeout(() => {
      if (this._status === ConnectionStatus.DISCONNECTED) {
        this.reconnect();
      }
    }, delay);
  }

  private startQrExpiry(): void {
    this.clearQrExpiry();
    const timeout = this._config.qrTimeout || 60000;
    this._qrExpiry = setTimeout(() => {
      this._qrCode = null;
      this.emit('qr_expired', { instanceId: this.instanceId });
    }, timeout);
  }

  private clearQrExpiry(): void {
    if (this._qrExpiry) {
      clearTimeout(this._qrExpiry);
      this._qrExpiry = null;
    }
  }

  private mapPresence(presence: PresenceType): 'composing' | 'recording' | 'available' | 'unavailable' {
    switch (presence) {
      case 'composing': return 'composing';
      case 'recording': return 'recording';
      case 'available': return 'available';
      case 'unavailable': return 'unavailable';
      case 'paused': return 'available';
      default: return 'available';
    }
  }
}
