import { UniqueId, PaginatedResult } from '@wacore/shared';
import { RepositoryBase, IRepositoryOptions } from '../database/repository-base';
import { IDbContext } from '../database/database-context';

export interface ICustomerRepository {
  findById(id: UniqueId): Promise<any | null>;
  findByPhoneNumber(workspaceId: UniqueId, phoneNumber: string): Promise<any | null>;
  findByWorkspaceId(workspaceId: UniqueId, options?: IRepositoryOptions): Promise<any[]>;
  findPaginatedByWorkspaceId(workspaceId: UniqueId, options?: IRepositoryOptions): Promise<PaginatedResult<any>>;
  create(data: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  delete(id: UniqueId): Promise<void>;
  countByWorkspaceId(workspaceId: UniqueId): Promise<number>;
}

export class CustomerRepository extends RepositoryBase<any, any, any> implements ICustomerRepository {
  constructor(context: IDbContext) {
    super(context, 'customer');
  }

  async findByPhoneNumber(workspaceId: UniqueId, phoneNumber: string): Promise<any | null> {
    return this.client.customer.findUnique({
      where: { workspaceId_phoneNumber: { workspaceId, phoneNumber } },
    });
  }

  async findByWorkspaceId(workspaceId: UniqueId, options?: IRepositoryOptions): Promise<any[]> {
    return this.findMany({ ...options, where: { workspaceId, ...(options?.where || {}) } });
  }

  async findPaginatedByWorkspaceId(workspaceId: UniqueId, options?: IRepositoryOptions): Promise<PaginatedResult<any>> {
    return this.findManyPaginated({ ...options, where: { workspaceId, ...(options?.where || {}) } });
  }

  async countByWorkspaceId(workspaceId: UniqueId): Promise<number> {
    return this.count({ workspaceId });
  }
}
