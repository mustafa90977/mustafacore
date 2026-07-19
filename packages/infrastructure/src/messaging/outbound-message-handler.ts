import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { IProvider, Message, MessageDirection } from '@wacore/wa-core';
import type { ISendMessageCommand, ISendMessageResult } from '@wacore/wa-core';
import { MessageMapper } from './message-mapper';
import { createMessageLifecycleEvent } from './message-events';

export interface OutboundMessageHandlerConfig {
  readonly maxRetries: number;
  readonly retryDelayMs: number;
}

export class OutboundMessageHandler extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _mapper: MessageMapper;
  private _provider: IProvider | null;
  private _messageStore: Map<string, Message>;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    _config?: Partial<OutboundMessageHandlerConfig>,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._mapper = new MessageMapper();
    this._provider = null;
    this._messageStore = new Map();
  }

  get instanceId(): UniqueId {
    return this._instanceId;
  }

  bindProvider(provider: IProvider): void {
    this._provider = provider;
  }

  unbindProvider(): void {
    this._provider = null;
  }

  async send(command: ISendMessageCommand): Promise<ISendMessageResult> {
    if (!this._provider) {
      this._logger.error(
        `[OutboundMessageHandler] No provider bound`,
        undefined,
        { instanceId: this._instanceId },
      );
      return { success: false, error: 'No provider bound' };
    }

    const message = Message.create({
      instanceId: command.instanceId,
      direction: MessageDirection.OUTBOUND,
      type: command.type,
      content: command.content as Record<string, unknown>,
      timestamp: new Date(),
    });

    if (command.conversationId) {
      message.setConversationId(command.conversationId);
    }

    this._messageStore.set(message.id, message);

    this.emit('event', createMessageLifecycleEvent(
      'message.outbound.requested',
      this._instanceId,
      {
        messageId: message.id,
        to: command.to,
        type: command.type,
      },
      message.id,
    ));

    const sendOptions = this._mapper.toSendOptions(command);

    this.emit('event', createMessageLifecycleEvent(
      'message.outbound.mapped',
      this._instanceId,
      {
        messageId: message.id,
        providerType: this._provider.providerType,
      },
      message.id,
    ));

    return this._executeSend(message, sendOptions);
  }

  async resend(messageId: string): Promise<ISendMessageResult> {
    const message = this._messageStore.get(messageId);
    if (!message) {
      return { success: false, error: 'Message not found' };
    }

    if (!message.canRetry) {
      return { success: false, error: 'Max retries exceeded' };
    }

    if (!this._provider) {
      return { success: false, error: 'No provider bound' };
    }

    message.markSending();
    message.incrementRetry();

    this.emit('event', createMessageLifecycleEvent(
      'message.outbound.retry',
      this._instanceId,
      {
        messageId: message.id,
        retryCount: message.retryCount,
      },
      message.id,
    ));

    const content = message.content;
    const sendOptions = {
      to: (content as any).to ?? '',
      type: message.type,
      content: this._mapper.toInternalContent(message.type, content),
    };

    return this._executeSend(message, sendOptions);
  }

  getMessage(messageId: string): Message | undefined {
    return this._messageStore.get(messageId);
  }

  clearStore(): void {
    this._messageStore.clear();
  }

  private async _executeSend(
    message: Message,
    sendOptions: { to: string; type: any; content: any; quotedMessageId?: string },
  ): Promise<ISendMessageResult> {
    message.markSending();

    this.emit('event', createMessageLifecycleEvent(
      'message.outbound.sending',
      this._instanceId,
      { messageId: message.id, to: sendOptions.to },
      message.id,
    ));

    try {
      const result = await this._provider!.sendMessage({
        to: sendOptions.to,
        type: sendOptions.type,
        content: sendOptions.content,
        quotedMessageId: sendOptions.quotedMessageId,
      });

      if (result.success && result.messageId) {
        message.markSent(result.messageId);

        this.emit('event', createMessageLifecycleEvent(
          'message.outbound.sent',
          this._instanceId,
          {
            messageId: message.id,
            externalId: result.messageId,
            to: sendOptions.to,
            type: sendOptions.type,
            timestamp: result.timestamp?.toISOString(),
          },
          message.id,
          result.messageId,
        ));

        return {
          success: true,
          messageId: message.id as any,
          externalId: result.messageId,
        };
      } else {
        message.markFailed(result.error || 'Send failed');

        this.emit('event', createMessageLifecycleEvent(
          'message.outbound.failed',
          this._instanceId,
          {
            messageId: message.id,
            error: result.error,
            retryable: result.retryable,
          },
          message.id,
        ));

        return {
          success: false,
          messageId: message.id as any,
          error: result.error,
          retryable: result.retryable,
        };
      }
    } catch (error) {
      message.markFailed((error as Error).message);

      this._logger.error(
        `[OutboundMessageHandler] Send error`,
        error as Error,
        { instanceId: this._instanceId, messageId: message.id },
      );

      this.emit('event', createMessageLifecycleEvent(
        'message.outbound.failed',
        this._instanceId,
        {
          messageId: message.id,
          error: (error as Error).message,
        },
        message.id,
      ));

      return {
        success: false,
        messageId: message.id as any,
        error: (error as Error).message,
        retryable: true,
      };
    }
  }
}
