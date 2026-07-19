import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from './prisma-client';

export interface IDbContext {
  readonly client: PrismaClient;
  transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T>;
}

export class DbContext implements IDbContext {
  private readonly _client: PrismaClient;

  constructor(client?: PrismaClient) {
    this._client = client || getPrismaClient();
  }

  get client(): PrismaClient {
    return this._client;
  }

  async transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this._client.$transaction(fn as any) as Promise<T>;
  }
}
