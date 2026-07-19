import { UniqueId, PaginatedResult, PaginationOptions } from '@wacore/shared';
import { Store } from '../../../domain/entities/store';

export interface IStoreRepository {
  findById(id: UniqueId): Promise<Store | null>;
  findByWorkspaceId(workspaceId: UniqueId, options?: PaginationOptions): Promise<PaginatedResult<Store>>;
  findByPhoneNumber(workspaceId: UniqueId, phoneNumber: string): Promise<Store | null>;
  save(store: Store): Promise<void>;
  update(store: Store): Promise<void>;
  delete(id: UniqueId): Promise<void>;
  countByWorkspaceId(workspaceId: UniqueId): Promise<number>;
}
