import { PrismaClient } from '@prisma/client';
import { IDbContext } from './database-context';

export interface ITransactionManager {
  execute<T>(fn: (ctx: IDbContext) => Promise<T>): Promise<T>;
  executeInTransaction<T>(fn: (tx: PrismaClient) => Promise<T>, timeout?: number): Promise<T>;
}

export class TransactionManager implements ITransactionManager {
  private readonly _context: IDbContext;

  constructor(context: IDbContext) {
    this._context = context;
  }

  async execute<T>(fn: (ctx: IDbContext) => Promise<T>): Promise<T> {
    return this._context.transaction(fn as any);
  }

  async executeInTransaction<T>(fn: (tx: PrismaClient) => Promise<T>, timeout?: number): Promise<T> {
    return this._context.client.$transaction(fn as any, { maxWait: timeout || 10000, timeout: timeout || 30000 });
  }
}
