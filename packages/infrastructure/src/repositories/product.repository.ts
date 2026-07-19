import { UniqueId, PaginatedResult } from '@wacore/shared';
import { RepositoryBase, IRepositoryOptions } from '../database/repository-base';
import { IDbContext } from '../database/database-context';

export interface IProductRepository {
  findById(id: UniqueId): Promise<any | null>;
  findBySku(storeId: UniqueId, sku: string): Promise<any | null>;
  findByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<any[]>;
  findPaginatedByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<PaginatedResult<any>>;
  searchByName(storeId: UniqueId, query: string): Promise<any[]>;
  create(data: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  delete(id: UniqueId): Promise<void>;
  countByStoreId(storeId: UniqueId): Promise<number>;
}

export class ProductRepository extends RepositoryBase<any, any, any> implements IProductRepository {
  constructor(context: IDbContext) {
    super(context, 'product');
  }

  async findBySku(storeId: UniqueId, sku: string): Promise<any | null> {
    return this.client.product.findUnique({
      where: { storeId_sku: { storeId, sku } },
    });
  }

  async findByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<any[]> {
    return this.findMany({ ...options, where: { storeId, ...(options?.where || {}) } });
  }

  async findPaginatedByStoreId(storeId: UniqueId, options?: IRepositoryOptions): Promise<PaginatedResult<any>> {
    return this.findManyPaginated({ ...options, where: { storeId, ...(options?.where || {}) } });
  }

  async searchByName(storeId: UniqueId, query: string): Promise<any[]> {
    return this.client.product.findMany({
      where: {
        storeId,
        name: { contains: query, mode: 'insensitive' },
      },
    });
  }

  async countByStoreId(storeId: UniqueId): Promise<number> {
    return this.count({ storeId });
  }
}
