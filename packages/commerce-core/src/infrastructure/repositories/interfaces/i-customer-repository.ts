import { UniqueId, PaginatedResult, PaginationOptions } from '@wacore/shared';
import { Customer } from '../../../domain/entities/customer';

export interface ICustomerRepository {
  findById(id: UniqueId): Promise<Customer | null>;
  findByPhoneNumber(workspaceId: UniqueId, phoneNumber: string): Promise<Customer | null>;
  findByWorkspaceId(workspaceId: UniqueId, options?: PaginationOptions): Promise<PaginatedResult<Customer>>;
  findByStoreId(storeId: UniqueId, options?: PaginationOptions): Promise<PaginatedResult<Customer>>;
  save(customer: Customer): Promise<void>;
  update(customer: Customer): Promise<void>;
  delete(id: UniqueId): Promise<void>;
  countByWorkspaceId(workspaceId: UniqueId): Promise<number>;
}
