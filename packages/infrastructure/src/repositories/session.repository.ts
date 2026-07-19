import { UniqueId } from '@wacore/shared';
import { RepositoryBase } from '../database/repository-base';
import { IDbContext } from '../database/database-context';
import { mapPrismaError } from '../database/error-mapping';

export interface ISessionRepository {
  findById(id: UniqueId): Promise<any | null>;
  findActiveByInstanceId(instanceId: UniqueId): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  delete(id: UniqueId): Promise<void>;
  revokeAllForInstance(instanceId: UniqueId): Promise<void>;
  findByInstanceId(instanceId: UniqueId): Promise<any | null>;
  updateQR(id: UniqueId, qrCode: string, expiresAt: Date): Promise<void>;
  markActive(id: UniqueId): Promise<void>;
}

export class SessionRepository extends RepositoryBase<any, any, any> implements ISessionRepository {
  constructor(context: IDbContext) {
    super(context, 'whatsAppSession');
  }

  async findActiveByInstanceId(instanceId: UniqueId): Promise<any | null> {
    return this.client.whatsAppSession.findFirst({
      where: { instanceId, isActive: true },
    });
  }

  async revokeAllForInstance(instanceId: UniqueId): Promise<void> {
    await this.client.whatsAppSession.updateMany({
      where: { instanceId },
      data: { isActive: false, status: 'REVOKED' },
    });
  }

  async findByInstanceId(instanceId: UniqueId): Promise<any | null> {
    try {
      return await this.client.whatsAppSession.findFirst({
        where: { instanceId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async updateQR(id: UniqueId, qrCode: string, expiresAt: Date): Promise<void> {
    try {
      await this.client.whatsAppSession.update({
        where: { id },
        data: { qrCode, qrGeneratedAt: new Date(), qrExpiresAt: expiresAt, status: 'QR_PENDING' },
      });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }

  async markActive(id: UniqueId): Promise<void> {
    try {
      await this.client.whatsAppSession.update({
        where: { id },
        data: { status: 'ACTIVE', isActive: true, qrCode: null },
      });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }
}
