import { UniqueId, PaginatedResult } from '@wacore/shared';
import { RepositoryBase, IRepositoryOptions } from '../database/repository-base';
import { IDbContext } from '../database/database-context';

export interface IOrderRepository {
  findById(id: UniqueId): Promise<any | null>;
  findByOrderNumber(orderNumber: string): Promise<any | null>;
  findByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<any[]>;
  findPaginatedByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<PaginatedResult<any>>;
  findByCustomerId(customerId: UniqueId, options?: IRepositoryOptions): Promise<any[]>;
  findByConversationId(conversationId: UniqueId): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  delete(id: UniqueId): Promise<void>;
  countByStoreId(storeId: UniqueId): Promise<number>;
}

export class OrderRepository extends RepositoryBase<any, any, any> implements IOrderRepository {
  constructor(context: IDbContext) {
    super(context, 'order');
  }

  async findByOrderNumber(orderNumber: string): Promise<any | null> {
    return this.client.order.findFirst({ where: { orderNumber } });
  }

  async findByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<any[]> {
    return this.findMany({ ...options, where: { storeId, ...(options?.where || {}) } });
  }

  async findPaginatedByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<PaginatedResult<any>> {
    return this.findManyPaginated({ ...options, where: { storeId, ...(options?.where || {}) } });
  }

  async findByCustomerId(customerId: UniqueId, options?: IRepositoryOptions): Promise<any[]> {
    return this.findMany({ ...options, where: { customerId, ...(options?.where || {}) } });
  }

  async findByConversationId(conversationId: UniqueId): Promise<any | null> {
    return this.client.order.findFirst({ where: { conversationId } });
  }

  async countByStoreId(storeId: UniqueId): Promise<number> {
    return this.count({ storeId });
  }
}
