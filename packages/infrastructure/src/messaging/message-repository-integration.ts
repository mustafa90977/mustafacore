import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { Message } from '@wacore/wa-core';
import { createMessageLifecycleEvent } from './message-events';

export interface MessageRepositoryIntegrationConfig {
  readonly persistInbound: boolean;
  readonly persistOutbound: boolean;
  readonly updateStatus: boolean;
}

const DEFAULT_REPO_CONFIG: MessageRepositoryIntegrationConfig = {
  persistInbound: true,
  persistOutbound: true,
  updateStatus: true,
};

export interface IMessagePersistenceAdapter {
  save(message: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  findByExternalId(instanceId: UniqueId, externalId: string): Promise<any | null>;
  findById(id: UniqueId): Promise<any | null>;
}

export class MessageRepositoryIntegration extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _config: MessageRepositoryIntegrationConfig;
  private _persistenceAdapter: IMessagePersistenceAdapter | null;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    config?: Partial<MessageRepositoryIntegrationConfig>,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._config = { ...DEFAULT_REPO_CONFIG, ...config };
    this._persistenceAdapter = null;
  }

  bindPersistence(adapter: IMessagePersistenceAdapter): void {
    this._persistenceAdapter = adapter;
  }

  unbindPersistence(): void {
    this._persistenceAdapter = null;
  }

  async persistInbound(message: Message): Promise<any> {
    if (!this._config.persistInbound || !this._persistenceAdapter) {
      return null;
    }

    try {
      const data = {
        id: message.id,
        instanceId: message.instanceId,
        externalId: message.externalId,
        direction: message.direction,
        type: message.type,
        content: message.content,
        status: message.status,
        timestamp: message.timestamp,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      };

      const saved = await this._persistenceAdapter.save(data);

      this.emit('event', createMessageLifecycleEvent(
        'message.inbound.stored',
        this._instanceId,
        {
          messageId: message.id,
          externalId: message.externalId,
          persisted: true,
        },
        message.id,
        message.externalId,
      ));

      return saved;
    } catch (error) {
      this._logger.error(
        `[MessageRepositoryIntegration] Failed to persist inbound`,
        error as Error,
        { instanceId: this._instanceId, messageId: message.id },
      );
      return null;
    }
  }

  async persistOutbound(message: Message): Promise<any> {
    if (!this._config.persistOutbound || !this._persistenceAdapter) {
      return null;
    }

    try {
      const data = {
        id: message.id,
        instanceId: message.instanceId,
        externalId: message.externalId,
        direction: message.direction,
        type: message.type,
        content: message.content,
        status: message.status,
        timestamp: message.timestamp,
        retryCount: message.retryCount,
        maxRetries: message.maxRetries,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      };

      return await this._persistenceAdapter.save(data);
    } catch (error) {
      this._logger.error(
        `[MessageRepositoryIntegration] Failed to persist outbound`,
        error as Error,
        { instanceId: this._instanceId, messageId: message.id },
      );
      return null;
    }
  }

  async updateStatus(
    instanceId: UniqueId,
    externalId: string,
    status: string,
  ): Promise<void> {
    if (!this._config.updateStatus || !this._persistenceAdapter) {
      return;
    }

    try {
      const existing = await this._persistenceAdapter.findByExternalId(instanceId, externalId);
      if (!existing) {
        this._logger.debug(
          `[MessageRepositoryIntegration] Message not found for status update`,
          { instanceId, externalId },
        );
        return;
      }

      await this._persistenceAdapter.update(existing.id, {
        status,
        updatedAt: new Date(),
      });
    } catch (error) {
      this._logger.error(
        `[MessageRepositoryIntegration] Failed to update status`,
        error as Error,
        { instanceId, externalId, status },
      );
    }
  }

  async findById(messageId: UniqueId): Promise<any | null> {
    if (!this._persistenceAdapter) return null;
    return this._persistenceAdapter.findById(messageId);
  }

  async findByExternalId(instanceId: UniqueId, externalId: string): Promise<any | null> {
    if (!this._persistenceAdapter) return null;
    return this._persistenceAdapter.findByExternalId(instanceId, externalId);
  }
}
