import { MessageType, MessageDirection } from '@wacore/wa-core';
import type { WAMessage } from '@whiskeysockets/baileys';
import { MediaNormalizer, NormalizedMedia } from './media-normalizer';

export interface NormalizedMessage {
  readonly instanceId: string;
  readonly externalId: string;
  readonly from: string;
  readonly to: string;
  readonly direction: MessageDirection;
  readonly type: MessageType;
  readonly content: Record<string, unknown>;
  readonly media?: NormalizedMedia;
  readonly timestamp: Date;
  readonly quotedMessageId?: string;
  readonly pushName?: string;
  readonly isForwarded: boolean;
  readonly isStatus: boolean;
  readonly extensions: MessageExtensions;
}

export interface MessageExtensions {
  readonly isSticker: boolean;
  readonly isReaction: boolean;
  readonly reactionEmoji?: string;
  readonly reactedToExternalId?: string;
  readonly isTemplate: boolean;
  readonly templateName?: string;
  readonly templateParams?: Record<string, string>;
  readonly rawType: string;
}

const EMPTY_EXTENSIONS: MessageExtensions = {
  isSticker: false,
  isReaction: false,
  isTemplate: false,
  rawType: 'unknown',
};

export class MessageNormalizer {
  private readonly _mediaNormalizer: MediaNormalizer;

  constructor(mediaNormalizer?: MediaNormalizer) {
    this._mediaNormalizer = mediaNormalizer ?? new MediaNormalizer();
  }

  normalizeInbound(instanceId: string, msg: WAMessage): NormalizedMessage | null {
    if (!msg.key || !msg.message) return null;

    const from = msg.key.participant || msg.key.remoteJid || '';
    const to = msg.key.remoteJid || '';
    const isFromMe = msg.key.fromMe ?? false;
    const externalId = msg.key.id || '';

    if (!externalId) return null;

    const direction = isFromMe ? MessageDirection.OUTBOUND : MessageDirection.INBOUND;
    const timestamp = msg.messageTimestamp
      ? new Date(typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Number(msg.messageTimestamp) * 1000)
      : new Date();

    const messageContent = msg.message;

    const { type, content, extensions, media } = this._extractContent(messageContent, msg);

    return {
      instanceId,
      externalId,
      from: isFromMe ? to : from,
      to: isFromMe ? from : to,
      direction,
      type,
      content,
      media,
      timestamp,
      quotedMessageId: messageContent.extendedTextMessage?.contextInfo?.stanzaId ?? undefined,
      pushName: msg.pushName ?? undefined,
      isForwarded: (messageContent.extendedTextMessage?.contextInfo?.isForwarded ?? false) || false,
      isStatus: from === 'status@broadcast',
      extensions,
    };
  }

  normalizeStatusUpdate(instanceId: string, msg: WAMessage): {
    instanceId: string;
    externalId: string;
    status: string;
    timestamp: Date;
  } | null {
    const externalId = msg.key?.id;
    if (!externalId) return null;

    const status = this._mapStatusFromKey(msg.key);
    if (!status) return null;

    return {
      instanceId,
      externalId,
      status,
      timestamp: new Date(),
    };
  }

  private _extractContent(
    messageContent: any,
    msg: WAMessage,
  ): {
    type: MessageType;
    content: Record<string, unknown>;
    extensions: MessageExtensions;
    media?: NormalizedMedia;
  } {
    if (messageContent.conversation) {
      return {
        type: MessageType.TEXT,
        content: { text: messageContent.conversation },
        extensions: { ...EMPTY_EXTENSIONS, rawType: 'conversation' },
      };
    }

    if (messageContent.extendedTextMessage) {
      const ext = messageContent.extendedTextMessage;
      return {
        type: MessageType.TEXT,
        content: { text: ext.text || '', displayText: ext.displayName },
        extensions: { ...EMPTY_EXTENSIONS, rawType: 'extendedTextMessage' },
      };
    }

    if (messageContent.imageMessage) {
      const img = messageContent.imageMessage;
      const media = this._mediaNormalizer.normalizeFromBaileys(msg, 'image', img.mimetype, img.fileLength);
      return {
        type: MessageType.IMAGE,
        content: { caption: img.caption || '', mimetype: img.mimetype },
        media,
        extensions: { ...EMPTY_EXTENSIONS, rawType: 'imageMessage' },
      };
    }

    if (messageContent.videoMessage) {
      const vid = messageContent.videoMessage;
      const media = this._mediaNormalizer.normalizeFromBaileys(msg, 'video', vid.mimetype, vid.fileLength);
      return {
        type: MessageType.VIDEO,
        content: { caption: vid.caption || '', mimetype: vid.mimetype },
        media,
        extensions: { ...EMPTY_EXTENSIONS, rawType: 'videoMessage' },
      };
    }

    if (messageContent.audioMessage) {
      const aud = messageContent.audioMessage;
      const media = this._mediaNormalizer.normalizeFromBaileys(msg, 'audio', aud.mimetype, aud.fileLength);
      return {
        type: MessageType.AUDIO,
        content: { mimetype: aud.mimetype, ptt: aud.ptt ?? false, duration: aud.seconds },
        media,
        extensions: { ...EMPTY_EXTENSIONS, rawType: 'audioMessage' },
      };
    }

    if (messageContent.documentMessage) {
      const doc = messageContent.documentMessage;
      const media = this._mediaNormalizer.normalizeFromBaileys(msg, 'document', doc.mimetype, doc.fileLength);
      return {
        type: MessageType.FILE,
        content: { fileName: doc.fileName || 'file', mimetype: doc.mimetype, caption: doc.caption || '' },
        media,
        extensions: { ...EMPTY_EXTENSIONS, rawType: 'documentMessage' },
      };
    }

    if (messageContent.stickerMessage) {
      const sticker = messageContent.stickerMessage;
      const media = this._mediaNormalizer.normalizeFromBaileys(msg, 'image', sticker.mimetype, sticker.fileLength);
      return {
        type: MessageType.IMAGE,
        content: { mimetype: sticker.mimetype, isAnimated: sticker.isAnimated ?? false },
        media,
        extensions: { ...EMPTY_EXTENSIONS, isSticker: true, rawType: 'stickerMessage' },
      };
    }

    if (messageContent.reactionMessage) {
      const reaction = messageContent.reactionMessage;
      return {
        type: MessageType.TEXT,
        content: { text: reaction.text || '' },
        extensions: {
          ...EMPTY_EXTENSIONS,
          isReaction: true,
          reactionEmoji: reaction.text,
          reactedToExternalId: reaction.key?.id,
          rawType: 'reactionMessage',
        },
      };
    }

    if (messageContent.locationMessage) {
      const loc = messageContent.locationMessage;
      return {
        type: MessageType.LOCATION,
        content: {
          latitude: loc.degreesLatitude,
          longitude: loc.degreesLongitude,
          name: loc.name || '',
          address: loc.address || '',
        },
        extensions: { ...EMPTY_EXTENSIONS, rawType: 'locationMessage' },
      };
    }

    if (messageContent.contactsArrayMessage) {
      const contacts = (messageContent.contactsArrayMessage.contacts || []).map((c: any) => ({
        name: c.displayName || '',
        phone: c.vcard || '',
      }));
      return {
        type: MessageType.CONTACT,
        content: { contacts },
        extensions: { ...EMPTY_EXTENSIONS, rawType: 'contactsArrayMessage' },
      };
    }

    if (messageContent.templateMessage) {
      const tmpl = messageContent.templateMessage;
      const text = tmpl.text?.text || tmpl.buttons?.[0]?.text?.displayText || '';
      return {
        type: MessageType.TEXT,
        content: { text },
        extensions: {
          ...EMPTY_EXTENSIONS,
          isTemplate: true,
          templateName: tmpl.text?.text,
          rawType: 'templateMessage',
        },
      };
    }

    if (messageContent.protocolMessage) {
      return {
        type: MessageType.TEXT,
        content: { text: '[System message]' },
        extensions: { ...EMPTY_EXTENSIONS, rawType: 'protocolMessage' },
      };
    }

    const firstKey = Object.keys(messageContent)[0] || 'unknown';
    return {
      type: MessageType.TEXT,
      content: { text: `[Unsupported: ${firstKey}]` },
      extensions: { ...EMPTY_EXTENSIONS, rawType: firstKey },
    };
  }

  private _mapStatusFromKey(key: any): string | null {
    if (!key) return null;

    const statusMap: Record<number, string> = {
      0: 'PENDING',
      1: 'SENT',
      2: 'DELIVERED',
      3: 'READ',
      4: 'PLAYED',
    };

    return statusMap[0] ?? null;
  }
}
