import { UniqueId, PaginatedResult, PaginationOptions } from '@wacore/shared';
import { Product } from '../../../domain/entities/product';

export interface IProductRepository {
  findById(id: UniqueId): Promise<Product | null>;
  findBySku(storeId: UniqueId, sku: string): Promise<Product | null>;
  findByStoreId(storeId: UniqueId, options?: PaginationOptions): Promise<PaginatedResult<Product>>;
  findByExternalId(storeId: UniqueId, externalId: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
  update(product: Product): Promise<void>;
  delete(id: UniqueId): Promise<void>;
  countByStoreId(storeId: UniqueId): Promise<number>;
  searchByName(storeId: UniqueId, query: string): Promise<Product[]>;
}
