import { UniqueId } from '@wacore/shared';
import { InstanceStatus } from '@prisma/client';
import { RepositoryBase } from '../database/repository-base';
import { IDbContext } from '../database/database-context';
import { mapPrismaError } from '../database/error-mapping';

export interface IInstanceRepository {
  findById(id: UniqueId): Promise<any | null>;
  findByWorkspaceId(workspaceId: UniqueId): Promise<any[]>;
  findByStoreId(storeId: UniqueId): Promise<any | null>;
  findByPhoneNumber(workspaceId: UniqueId, phoneNumber: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  delete(id: UniqueId): Promise<void>;
  updateStatus(id: UniqueId, status: InstanceStatus): Promise<void>;
  recordConnection(id: UniqueId): Promise<void>;
  recordDisconnection(id: UniqueId): Promise<void>;
  recordError(id: UniqueId, errorMessage: string): Promise<void>;
}

export class InstanceRepository extends RepositoryBase<any, any, any> implements IInstanceRepository {
  constructor(context: IDbContext) {
    super(context, 'whatsAppInstance');
  }

  async findByWorkspaceId(workspaceId: UniqueId): Promise<any[]> {
    return this.client.whatsAppInstance.findMany({ where: { workspaceId } });
  }

  async findByStoreId(storeId: UniqueId): Promise<any | null> {
    return this.client.whatsAppInstance.findFirst({ where: { storeId } });
  }

  async findByPhoneNumber(workspaceId: UniqueId, phoneNumber: string): Promise<any | null> {
    return this.client.whatsAppInstance.findUnique({
      where: { workspaceId_phoneNumber: { workspaceId, phoneNumber } },
    });
  }

  async updateStatus(id: UniqueId, status: InstanceStatus): Promise<void> {
    try {
      await this.client.whatsAppInstance.update({ where: { id }, data: { status } });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async recordConnection(id: UniqueId): Promise<void> {
    try {
      await this.client.whatsAppInstance.update({
        where: { id },
        data: { status: 'CONNECTED', lastConnectedAt: new Date(), errorCount: 0 },
      });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async recordDisconnection(id: UniqueId): Promise<void> {
    try {
      await this.client.whatsAppInstance.update({
        where: { id },
        data: { status: 'DISCONNECTED', lastDisconnectedAt: new Date() },
      });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async recordError(id: UniqueId, errorMessage: string): Promise<void> {
    try {
      await this.client.whatsAppInstance.update({
        where: { id },
        data: {
          status: 'ERROR',
          lastError: errorMessage,
          errorCount: { increment: 1 },
        },
      });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }
}
