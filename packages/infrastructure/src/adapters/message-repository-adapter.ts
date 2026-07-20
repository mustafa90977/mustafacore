import { UniqueId } from '@wacore/shared';
import type { IMessageRepository, MessageData } from '@wacore/commerce-core';
import { IMessageRepository as InfraMessageRepo } from '../repositories/message.repository';

export class MessageRepositoryAdapter implements IMessageRepository {
  constructor(private readonly _repo: InfraMessageRepo) {}

  async findById(id: UniqueId): Promise<MessageData | null> {
    const data = await this._repo.findById(id);
    return data ? this.toMessageData(data) : null;
  }

  async findByExternalId(instanceId: UniqueId, externalId: string): Promise<MessageData | null> {
    const data = await this._repo.findByExternalId(instanceId, externalId);
    return data ? this.toMessageData(data) : null;
  }

  async save(message: MessageData): Promise<void> {
    await this._repo.create({
      id: message.id,
      instanceId: message.instanceId,
      externalId: message.externalId,
      conversationId: message.conversationId,
      direction: message.direction,
      type: message.type,
      content: message.content,
      status: message.status,
      timestamp: message.timestamp,
      metadata: message.metadata ?? undefined,
    });
  }

  async findRecentByInstanceId(instanceId: UniqueId, limit?: number): Promise<MessageData[]> {
    const data = await this._repo.findRecentByInstanceId(instanceId, limit);
    return data.map((item) => this.toMessageData(item));
  }

  private toMessageData(data: any): MessageData {
    return {
      id: data.id,
      instanceId: data.instanceId,
      externalId: data.externalId ?? '',
      conversationId: data.conversationId ?? '',
      direction: data.direction,
      type: data.type,
      content: (data.content as Record<string, unknown>) ?? {},
      status: data.status,
      timestamp: data.timestamp,
      metadata: (data.metadata as Record<string, unknown>) ?? undefined,
    };
  }
}
