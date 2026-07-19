import { UniqueId, DomainEvent, generateId } from '@wacore/shared';
import { ConnectionStatus, MessageType, MessageStatus, MessageDirection } from '@wacore/wa-core';
import type { ConnectionState, WAMessage, WAMessageKey } from '@whiskeysockets/baileys';
import { proto } from '@whiskeysockets/baileys';
import { IncomingMessage, MessageStatusUpdate } from '@wacore/wa-core';
import { BaileysErrorMapper } from './baileys-error-mapper';

export interface NormalizedConnectionEvent {
  type: 'connection_update';
  instanceId: UniqueId;
  status: ConnectionStatus;
  qr?: string;
  error?: string;
  isRecoverable?: boolean;
  timestamp: Date;
}

export interface NormalizedMessageEvent {
  type: 'message_upsert' | 'message_update' | 'message_delete';
  instanceId: UniqueId;
  messages: WAMessage[];
  upsertType?: string;
  timestamp: Date;
}

export interface BaileysEventMapperOptions {
  instanceId: UniqueId;
}

export class BaileysEventMapper {
  private readonly _instanceId: UniqueId;

  constructor(options: BaileysEventMapperOptions) {
    this._instanceId = options.instanceId;
  }

  mapConnectionUpdate(state: Partial<ConnectionState>): NormalizedConnectionEvent {
    const status = this.mapConnectionState(state.connection);
    const result: NormalizedConnectionEvent = {
      type: 'connection_update',
      instanceId: this._instanceId,
      status,
      qr: state.qr,
      timestamp: new Date(),
    };

    if (state.lastDisconnect?.error) {
      const errorInfo = BaileysErrorMapper.mapError(state.lastDisconnect.error);
      result.error = errorInfo.message;
      result.isRecoverable = errorInfo.isRecoverable;
    }

    return result;
  }

  mapMessageUpsert(data: { messages: WAMessage[]; type: string }): NormalizedMessageEvent {
    return {
      type: 'message_upsert',
      instanceId: this._instanceId,
      messages: data.messages,
      upsertType: data.type,
      timestamp: new Date(),
    };
  }

  mapMessageUpdate(messages: WAMessage[]): NormalizedMessageEvent {
    return {
      type: 'message_update',
      instanceId: this._instanceId,
      messages,
      timestamp: new Date(),
    };
  }

  mapMessageDelete(_data: { keys: WAMessageKey[] } | { jid: string; all: true }): NormalizedMessageEvent {
    return {
      type: 'message_delete',
      instanceId: this._instanceId,
      messages: [],
      timestamp: new Date(),
    };
  }

  toDomainEvent(normalized: NormalizedConnectionEvent): DomainEvent {
    const eventType = this.connectionStatusToEventType(normalized.status);
    return {
      eventId: generateId(),
      eventType,
      aggregateType: 'WhatsAppInstance',
      aggregateId: normalized.instanceId,
      workspaceId: '',
      source: 'WA_CORE',
      payload: {
        status: normalized.status,
        qr: normalized.qr,
        error: normalized.error,
        isRecoverable: normalized.isRecoverable,
      },
      metadata: {
        timestamp: normalized.timestamp,
        version: 1,
      },
      timestamp: normalized.timestamp,
    };
  }

  toIncomingMessage(msg: WAMessage): IncomingMessage | null {
    if (!msg.key.remoteJid || msg.key.remoteJid === 'status@broadcast') return null;
    if (msg.key.fromMe) return null;

    const messageType = this.detectMessageType(msg.message);
    const content = this.extractMessageContent(msg.message, messageType);

    return {
      instanceId: this._instanceId,
      externalId: msg.key.id || '',
      from: msg.key.remoteJid,
      to: '',
      type: messageType,
      content,
      timestamp: msg.messageTimestamp
        ? new Date(typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Number(msg.messageTimestamp))
        : new Date(),
      direction: MessageDirection.INBOUND,
    };
  }

  toStatusUpdate(msg: WAMessage): MessageStatusUpdate | null {
    if (!msg.key.id) return null;
    const waStatus = (msg as any).update?.status as proto.WebMessageInfo.Status | undefined;
    const status = this.mapMessageStatus(waStatus);
    if (!status) return null;

    return {
      instanceId: this._instanceId,
      externalId: msg.key.id,
      status,
      timestamp: new Date(),
    };
  }

  private mapConnectionState(connection?: string): ConnectionStatus {
    switch (connection) {
      case 'open': return ConnectionStatus.CONNECTED;
      case 'connecting': return ConnectionStatus.CONNECTING;
      case 'close': return ConnectionStatus.DISCONNECTED;
      default: return ConnectionStatus.DISCONNECTED;
    }
  }

  private connectionStatusToEventType(status: ConnectionStatus): string {
    switch (status) {
      case ConnectionStatus.CONNECTED: return 'INSTANCE_CONNECTED';
      case ConnectionStatus.CONNECTING: return 'INSTANCE_CONNECTING';
      case ConnectionStatus.DISCONNECTED: return 'INSTANCE_DISCONNECTED';
      case ConnectionStatus.QR_PENDING: return 'QR_GENERATED';
      case ConnectionStatus.RECONNECTING: return 'INSTANCE_CONNECTING';
      default: return 'INSTANCE_DISCONNECTED';
    }
  }

  private detectMessageType(message?: any): MessageType {
    if (!message) return MessageType.TEXT;
    if (message.imageMessage) return MessageType.IMAGE;
    if (message.videoMessage) return MessageType.VIDEO;
    if (message.audioMessage) return MessageType.AUDIO;
    if (message.documentMessage) return MessageType.FILE;
    if (message.locationMessage || message.liveLocationMessage) return MessageType.LOCATION;
    if (message.contactMessage || message.contactsArrayMessage) return MessageType.CONTACT;
    return MessageType.TEXT;
  }

  private extractMessageContent(message: any, type: MessageType): Record<string, unknown> {
    if (!message) return {};

    switch (type) {
      case MessageType.TEXT:
        return { text: message.conversation || message.extendedTextMessage?.text || '' };
      case MessageType.IMAGE:
        return {
          text: message.imageMessage?.caption || '',
          mimetype: message.imageMessage?.mimetype,
          fileSize: message.imageMessage?.fileLength,
        };
      case MessageType.VIDEO:
        return {
          text: message.videoMessage?.caption || '',
          mimetype: message.videoMessage?.mimetype,
          fileSize: message.videoMessage?.fileLength,
        };
      case MessageType.AUDIO:
        return {
          mimetype: message.audioMessage?.mimetype,
          fileSize: message.audioMessage?.fileLength,
        };
      case MessageType.FILE:
        return {
          fileName: message.documentMessage?.fileName,
          mimetype: message.documentMessage?.mimetype,
          fileSize: message.documentMessage?.fileLength,
        };
      case MessageType.LOCATION:
        return {
          latitude: message.locationMessage?.degreesLatitude,
          longitude: message.locationMessage?.degreesLongitude,
          name: message.locationMessage?.name,
        };
      case MessageType.CONTACT: {
        const contact = message.contactMessage || message.contactsArrayMessage?.contacts?.[0];
        return {
          contactName: contact?.displayName,
          contactPhone: contact?.vcard,
        };
      }
      default:
        return {};
    }
  }

  private mapMessageStatus(status?: proto.WebMessageInfo.Status): MessageStatus | null {
    switch (status) {
      case proto.WebMessageInfo.Status.PENDING: return MessageStatus.PENDING;
      case proto.WebMessageInfo.Status.SERVER_ACK: return MessageStatus.SENT;
      case proto.WebMessageInfo.Status.DELIVERY_ACK: return MessageStatus.DELIVERED;
      case proto.WebMessageInfo.Status.READ: return MessageStatus.READ;
      case proto.WebMessageInfo.Status.PLAYED: return MessageStatus.READ;
      case proto.WebMessageInfo.Status.ERROR: return MessageStatus.FAILED;
      default: return null;
    }
  }
}
