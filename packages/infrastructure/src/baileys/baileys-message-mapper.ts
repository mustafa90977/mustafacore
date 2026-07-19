import { generateId } from '@wacore/shared';
import { MessageType, SentMessage } from '@wacore/wa-core';

export class BaileysMessageMapper {
  toSentMessage(messageId: string, msg: any, type: MessageType): SentMessage {
    return {
      messageId: generateId(),
      externalId: messageId,
      timestamp: msg?.messageTimestamp
        ? new Date(typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Number(msg.messageTimestamp))
        : new Date(),
      type,
    };
  }

  toBaileysJid(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    if (cleaned.includes('@')) return cleaned;
    return `${cleaned}@s.whatsapp.net`;
  }

  buildTextContent(text: string): any {
    return { conversation: text };
  }

  buildImageContent(buffer: Buffer, caption?: string, mimetype?: string): any {
    return {
      imageMessage: {
        caption: caption || '',
        mimetype: mimetype || 'image/jpeg',
        fileLength: buffer.length,
      },
    };
  }

  buildVideoContent(buffer: Buffer, caption?: string, mimetype?: string): any {
    return {
      videoMessage: {
        caption: caption || '',
        mimetype: mimetype || 'video/mp4',
        fileLength: buffer.length,
      },
    };
  }

  buildAudioContent(buffer: Buffer, mimetype?: string): any {
    return {
      audioMessage: {
        mimetype: mimetype || 'audio/ogg; codecs=opus',
        fileLength: buffer.length,
      },
    };
  }

  buildDocumentContent(buffer: Buffer, fileName: string, mimetype?: string): any {
    return {
      documentMessage: {
        fileName,
        mimetype: mimetype || 'application/octet-stream',
        fileLength: buffer.length,
      },
    };
  }

  buildLocationContent(latitude: number, longitude: number, name?: string): any {
    return {
      locationMessage: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name: name || '',
      },
    };
  }

  buildContactContent(name: string, phone: string): any {
    return {
      contactMessage: {
        displayName: name,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL:${phone}\nEND:VCARD`,
      },
    };
  }
}
