import { UniqueId, PaginatedResult } from '@wacore/shared';
import { RepositoryBase, IRepositoryOptions } from '../database/repository-base';
import { IDbContext } from '../database/database-context';

export interface IWorkspaceRepository {
  findById(id: UniqueId): Promise<any | null>;
  findBySlug(slug: string): Promise<any | null>;
  findMany(options?: IRepositoryOptions): Promise<any[]>;
  findManyPaginated(options?: IRepositoryOptions): Promise<PaginatedResult<any>>;
  create(data: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  delete(id: UniqueId): Promise<void>;
  count(): Promise<number>;
}

export class WorkspaceRepository extends RepositoryBase<any, any, any> implements IWorkspaceRepository {
  constructor(context: IDbContext) {
    super(context, 'workspace');
  }

  async findBySlug(slug: string): Promise<any | null> {
    return this.client.workspace.findUnique({ where: { slug } });
  }
}
