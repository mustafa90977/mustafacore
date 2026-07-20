import { UniqueId, PaginatedResult, createPaginatedResult } from '@wacore/shared';
import { Conversation } from '@wacore/commerce-core';
import type { IConversationRepository } from '@wacore/commerce-core';
import { IConversationRepository as InfraConversationRepo } from '../repositories/conversation.repository';

function toConversationEntity(data: any): Conversation {
  return Conversation.reconstitute({
    id: data.id,
    instanceId: data.instanceId,
    customerId: data.customerId,
    storeId: data.storeId,
    status: data.status,
    priority: data.priority,
    assigneeId: data.assigneeId ?? undefined,
    tags: data.tags ?? [],
    lastMessageAt: data.lastMessageAt ?? undefined,
    lastMessagePreview: data.lastMessagePreview ?? undefined,
    unreadCount: data.unreadCount ?? 0,
    metadata: data.metadata ?? undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });
}

function toPrismaData(conversation: Conversation): Record<string, unknown> {
  return {
    id: conversation.id,
    instanceId: conversation.instanceId,
    customerId: conversation.customerId,
    storeId: conversation.storeId,
    status: conversation.status,
    priority: conversation.priority,
    assigneeId: conversation.assigneeId ?? null,
    tags: conversation.tags,
    lastMessageAt: conversation.lastMessageAt ?? null,
    lastMessagePreview: conversation.lastMessagePreview ?? null,
    unreadCount: conversation.unreadCount,
    metadata: conversation.metadata ?? undefined,
  };
}

export class ConversationRepositoryAdapter implements IConversationRepository {
  constructor(private readonly _repo: InfraConversationRepo) {}

  async findById(id: UniqueId): Promise<Conversation | null> {
    const data = await this._repo.findById(id);
    return data ? toConversationEntity(data) : null;
  }

  async findByCustomerId(_customerId: UniqueId): Promise<Conversation | null> {
    return null;
  }

  async findByInstanceIdAndCustomerId(instanceId: UniqueId, customerId: UniqueId): Promise<Conversation | null> {
    const data = await this._repo.findByInstanceIdAndCustomerId(instanceId, customerId);
    return data ? toConversationEntity(data) : null;
  }

  async findByStoreId(_storeId: UniqueId): Promise<PaginatedResult<Conversation>> {
    return createPaginatedResult([], 1, 0, 0);
  }

  async findActiveByStoreId(_storeId: UniqueId): Promise<Conversation[]> {
    return [];
  }

  async save(conversation: Conversation): Promise<void> {
    await this._repo.create(toPrismaData(conversation));
  }

  async update(conversation: Conversation): Promise<void> {
    await this._repo.update(conversation.id, toPrismaData(conversation));
  }

  async delete(id: UniqueId): Promise<void> {
    await this._repo.delete(id);
  }

  async countByStoreId(storeId: UniqueId): Promise<number> {
    return this._repo.countByStoreId(storeId);
  }
}
