import { UniqueId, PaginatedResult } from '@wacore/shared';
import { RepositoryBase, IRepositoryOptions } from '../database/repository-base';
import { IDbContext } from '../database/database-context';

export interface IStoreRepository {
  findById(id: UniqueId): Promise<any | null>;
  findByWorkspaceId(workspaceId: UniqueId, options?: IRepositoryOptions): Promise<any[]>;
  findPaginatedByWorkspaceId(workspaceId: UniqueId, options?: IRepositoryOptions): Promise<PaginatedResult<any>>;
  findByPhoneNumber(workspaceId: UniqueId, phoneNumber: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  delete(id: UniqueId): Promise<void>;
  countByWorkspaceId(workspaceId: UniqueId): Promise<number>;
}

export class StoreRepository extends RepositoryBase<any, any, any> implements IStoreRepository {
  constructor(context: IDbContext) {
    super(context, 'store');
  }

  async findByWorkspaceId(workspaceId: UniqueId, options?: IRepositoryOptions): Promise<any[]> {
    return this.findMany({ ...options, where: { workspaceId, ...(options?.where || {}) } });
  }

  async findPaginatedByWorkspaceId(workspaceId: UniqueId, options?: IRepositoryOptions): Promise<PaginatedResult<any>> {
    return this.findManyPaginated({ ...options, where: { workspaceId, ...(options?.where || {}) } });
  }

  async findByPhoneNumber(workspaceId: UniqueId, phoneNumber: string): Promise<any | null> {
    return this.client.store.findFirst({ where: { workspaceId, phoneNumber } });
  }

  async countByWorkspaceId(workspaceId: UniqueId): Promise<number> {
    return this.count({ workspaceId });
  }
}
