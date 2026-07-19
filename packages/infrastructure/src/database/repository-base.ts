import { PrismaClient } from '@prisma/client';
import { UniqueId, PaginationOptions, PaginatedResult, createPaginatedResult, MAX_LIMIT } from '@wacore/shared';
import { IDbContext } from './database-context';
import { mapPrismaError } from './error-mapping';

export type WhereClause = Record<string, unknown>;
export type IncludeClause = Record<string, unknown>;
export type OrderByClause = Record<string, 'asc' | 'desc'>;

export interface IRepositoryOptions {
  pagination?: PaginationOptions;
  where?: WhereClause;
  include?: IncludeClause;
  orderBy?: OrderByClause;
}

export abstract class RepositoryBase<TModel, TCreateInput, TUpdateInput> {
  protected readonly _context: IDbContext;
  protected readonly _modelName: string;

  constructor(context: IDbContext, modelName: string) {
    this._context = context;
    this._modelName = modelName;
  }

  protected get client(): PrismaClient {
    return this._context.client;
  }

  protected get delegate() {
    return (this.client as any)[this._modelName];
  }

  async findById(id: UniqueId): Promise<TModel | null> {
    try {
      return await this.delegate.findUnique({ where: { id } });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async findMany(options: IRepositoryOptions = {}): Promise<TModel[]> {
    try {
      const { where, include, orderBy } = options;
      return await this.delegate.findMany({
        where: where || {},
        include: include || undefined,
        orderBy: orderBy || { createdAt: 'desc' },
      });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async findManyPaginated(options: IRepositoryOptions = {}): Promise<PaginatedResult<TModel>> {
    try {
      const { pagination, where, include, orderBy } = options;
      const page = pagination?.page || 1;
      const limit = Math.min(pagination?.limit || 20, MAX_LIMIT);

      const [data, total] = await Promise.all([
        this.delegate.findMany({
          where: where || {},
          include: include || undefined,
          orderBy: orderBy || { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.delegate.count({ where: where || {} }),
      ]);

      return createPaginatedResult(data, page, limit, total);
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async create(data: TCreateInput): Promise<TModel> {
    try {
      return await this.delegate.create({ data });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async update(id: UniqueId, data: TUpdateInput): Promise<TModel> {
    try {
      return await this.delegate.update({ where: { id }, data });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async upsert(args: { where: Record<string, unknown>; create: TCreateInput; update: TUpdateInput }): Promise<TModel> {
    try {
      return await this.delegate.upsert(args);
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async delete(id: UniqueId): Promise<void> {
    try {
      await this.delegate.delete({ where: { id } });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async count(where?: WhereClause): Promise<number> {
    try {
      return await this.delegate.count({ where: where || {} });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async exists(where: WhereClause): Promise<boolean> {
    try {
      const count = await this.delegate.count({ where });
      return count > 0;
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async transaction<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
    return this._context.transaction(fn);
  }
}
