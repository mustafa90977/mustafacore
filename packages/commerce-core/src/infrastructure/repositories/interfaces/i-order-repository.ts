import { UniqueId, PaginatedResult, PaginationOptions } from '@wacore/shared';
import { Order } from '../../../domain/entities/order';

export interface IOrderRepository {
  findById(id: UniqueId): Promise<Order | null>;
  findByOrderNumber(orderNumber: string): Promise<Order | null>;
  findByStoreId(storeId: UniqueId, options?: PaginationOptions): Promise<PaginatedResult<Order>>;
  findByCustomerId(customerId: UniqueId, options?: PaginationOptions): Promise<PaginatedResult<Order>>;
  findByConversationId(conversationId: UniqueId): Promise<Order | null>;
  save(order: Order): Promise<void>;
  update(order: Order): Promise<void>;
  delete(id: UniqueId): Promise<void>;
  countByStoreId(storeId: UniqueId): Promise<number>;
  getNextSequenceNumber(storeId: UniqueId): Promise<number>;
}
