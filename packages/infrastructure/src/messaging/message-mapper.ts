import { MessageType, MessageContent, SendMessageOptions } from '@wacore/wa-core';
import type { ISendMessageCommand } from '@wacore/wa-core';
import { NormalizedMessage } from './message-normalizer';

export class MessageMapper {
  toSendOptions(command: ISendMessageCommand): SendMessageOptions {
    return {
      to: command.to,
      type: command.type,
      content: this._mapContent(command.type, command.content as Record<string, unknown>),
      quotedMessageId: command.quotedMessageId,
    };
  }

  toInternalContent(type: MessageType, content: Record<string, unknown>): MessageContent {
    return this._mapContent(type, content);
  }

  buildInboundContent(normalized: NormalizedMessage): Record<string, unknown> {
    const base: Record<string, unknown> = {
      ...normalized.content,
      rawType: normalized.extensions.rawType,
    };

    if (normalized.extensions.isSticker) {
      base.isSticker = true;
    }
    if (normalized.extensions.isReaction) {
      base.isReaction = true;
      base.reactionEmoji = normalized.extensions.reactionEmoji;
      base.reactedToExternalId = normalized.extensions.reactedToExternalId;
    }
    if (normalized.extensions.isTemplate) {
      base.isTemplate = true;
      base.templateName = normalized.extensions.templateName;
      base.templateParams = normalized.extensions.templateParams;
    }
    if (normalized.media) {
      base.media = {
        mediaId: normalized.media.mediaId,
        mimetype: normalized.media.mimetype,
        fileSize: normalized.media.fileSize,
        mediaType: normalized.media.mediaType,
      };
    }

    return base;
  }

  buildMetadata(normalized: NormalizedMessage): Record<string, unknown> {
    return {
      pushName: normalized.pushName,
      isForwarded: normalized.isForwarded,
      isStatus: normalized.isStatus,
      rawType: normalized.extensions.rawType,
      isSticker: normalized.extensions.isSticker,
      isReaction: normalized.extensions.isReaction,
      isTemplate: normalized.extensions.isTemplate,
      reactionEmoji: normalized.extensions.reactionEmoji,
      reactedToExternalId: normalized.extensions.reactedToExternalId,
      templateName: normalized.extensions.templateName,
    };
  }

  mapStatus(externalStatus: string): string {
    const statusMap: Record<string, string> = {
      'PENDING': 'PENDING',
      'SENT': 'SENT',
      'DELIVERED': 'DELIVERED',
      'READ': 'READ',
      'PLAYED': 'READ',
      'FAILED': 'FAILED',
      '1': 'SENT',
      '2': 'DELIVERED',
      '3': 'READ',
      '4': 'READ',
    };
    return statusMap[externalStatus] ?? 'PENDING';
  }

  private _mapContent(type: MessageType, content: Record<string, unknown>): MessageContent {
    const c = content as Record<string, any>;
    switch (type) {
      case MessageType.TEXT:
        return { text: c.text };

      case MessageType.IMAGE:
        return {
          text: c.caption,
          buffer: c.buffer,
          mimetype: c.mimetype,
        };

      case MessageType.VIDEO:
        return {
          text: c.caption,
          buffer: c.buffer,
          mimetype: c.mimetype,
        };

      case MessageType.AUDIO:
        return {
          buffer: c.buffer,
          mimetype: c.mimetype,
        };

      case MessageType.FILE:
        return {
          fileName: c.fileName,
          buffer: c.buffer,
          mimetype: c.mimetype,
          fileSize: c.fileSize,
        };

      case MessageType.LOCATION:
        return {
          latitude: c.latitude,
          longitude: c.longitude,
          contactName: c.name,
        };

      case MessageType.CONTACT: {
        const contacts = c.contacts as Array<{ name: string; phone: string }>;
        const first = contacts?.[0];
        return {
          contactName: first?.name,
          contactPhone: first?.phone,
        };
      }

      default:
        return { text: JSON.stringify(content) };
    }
  }
}
