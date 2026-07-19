import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { Message } from '@wacore/wa-core';
import type { WAMessage } from '@whiskeysockets/baileys';
import { MessageNormalizer, NormalizedMessage } from './message-normalizer';
import { MessageMapper } from './message-mapper';
import { MediaNormalizer } from './media-normalizer';
import { createMessageLifecycleEvent } from './message-events';

export interface InboundMessageHandlerConfig {
  readonly persistToRepository: boolean;
}

export class InboundMessageHandler extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _normalizer: MessageNormalizer;
  private readonly _mapper: MessageMapper;
  private _messageStore: Map<string, Message>;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    _config?: Partial<InboundMessageHandlerConfig>,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._normalizer = new MessageNormalizer(new MediaNormalizer());
    this._mapper = new MessageMapper();
    this._messageStore = new Map();
  }

  get instanceId(): UniqueId {
    return this._instanceId;
  }

  async handleRawMessage(rawMessage: WAMessage): Promise<Message | null> {
    const normalized = this._normalizer.normalizeInbound(this._instanceId, rawMessage);
    if (!normalized) {
      this._logger.debug(
        `[InboundMessageHandler] Could not normalize message`,
        { instanceId: this._instanceId },
      );
      return null;
    }

    return this.handleNormalizedMessage(normalized);
  }

  async handleNormalizedMessage(normalized: NormalizedMessage): Promise<Message | null> {
    this.emit('event', createMessageLifecycleEvent(
      'message.inbound.normalized',
      this._instanceId,
      {
        externalId: normalized.externalId,
        type: normalized.type,
        from: normalized.from,
        rawType: normalized.extensions.rawType,
      },
    ));

    try {
      const content = this._mapper.buildInboundContent(normalized);

      const message = Message.create({
        instanceId: normalized.instanceId,
        direction: normalized.direction,
        type: normalized.type,
        content,
        timestamp: normalized.timestamp,
      });

      message.setExternalId(normalized.externalId);

      this._messageStore.set(normalized.externalId, message);

      this.emit('event', createMessageLifecycleEvent(
        'message.inbound.stored',
        this._instanceId,
        {
          messageId: message.id,
          externalId: normalized.externalId,
          type: normalized.type,
          direction: normalized.direction,
          from: normalized.from,
          hasMedia: !!normalized.media,
          extensions: normalized.extensions.rawType,
        },
        message.id,
        normalized.externalId,
      ));

      return message;
    } catch (error) {
      this._logger.error(
        `[InboundMessageHandler] Failed to process inbound message`,
        error as Error,
        { instanceId: this._instanceId, externalId: normalized.externalId },
      );

      this.emit('event', createMessageLifecycleEvent(
        'message.inbound.failed',
        this._instanceId,
        {
          externalId: normalized.externalId,
          error: (error as Error).message,
        },
      ));

      return null;
    }
  }

  getMessage(externalId: string): Message | undefined {
    return this._messageStore.get(externalId);
  }

  hasMessage(externalId: string): boolean {
    return this._messageStore.has(externalId);
  }

  clearStore(): void {
    this._messageStore.clear();
  }
}
