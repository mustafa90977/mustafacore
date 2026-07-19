import { UniqueId, PaginatedResult, PaginationOptions } from '@wacore/shared';
import { Conversation } from '../../../domain/entities/conversation';

export interface IConversationRepository {
  findById(id: UniqueId): Promise<Conversation | null>;
  findByCustomerId(customerId: UniqueId): Promise<Conversation | null>;
  findByInstanceIdAndCustomerId(instanceId: UniqueId, customerId: UniqueId): Promise<Conversation | null>;
  findByStoreId(storeId: UniqueId, options?: PaginationOptions): Promise<PaginatedResult<Conversation>>;
  findActiveByStoreId(storeId: UniqueId): Promise<Conversation[]>;
  save(conversation: Conversation): Promise<void>;
  update(conversation: Conversation): Promise<void>;
  delete(id: UniqueId): Promise<void>;
  countByStoreId(storeId: UniqueId): Promise<number>;
}
