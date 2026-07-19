import { UniqueId, PaginatedResult } from '@wacore/shared';
import { RepositoryBase, IRepositoryOptions } from '../database/repository-base';
import { IDbContext } from '../database/database-context';

export interface IConversationRepository {
  findById(id: UniqueId): Promise<any | null>;
  findByInstanceIdAndCustomerId(instanceId: UniqueId, customerId: UniqueId): Promise<any | null>;
  findByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<any[]>;
  findPaginatedByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<PaginatedResult<any>>;
  findActiveByStoreId(storeId: UniqueId): Promise<any[]>;
  create(data: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  delete(id: UniqueId): Promise<void>;
  countByStoreId(storeId: UniqueId): Promise<number>;
}

export class ConversationRepository extends RepositoryBase<any, any, any> implements IConversationRepository {
  constructor(context: IDbContext) {
    super(context, 'conversation');
  }

  async findByInstanceIdAndCustomerId(instanceId: UniqueId, customerId: UniqueId): Promise<any | null> {
    return this.client.conversation.findUnique({
      where: { instanceId_customerId: { instanceId, customerId } },
    });
  }

  async findByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<any[]> {
    return this.findMany({ ...options, where: { storeId, ...(options?.where || {}) } });
  }

  async findPaginatedByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<PaginatedResult<any>> {
    return this.findManyPaginated({ ...options, where: { storeId, ...(options?.where || {}) } });
  }

  async findActiveByStoreId(storeId: UniqueId): Promise<any[]> {
    return this.client.conversation.findMany({
      where: { storeId, status: 'ACTIVE' },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async countByStoreId(storeId: UniqueId): Promise<number> {
    return this.count({ storeId });
  }
}
