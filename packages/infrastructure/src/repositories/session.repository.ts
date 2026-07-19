import { UniqueId } from '@wacore/shared';
import { RepositoryBase } from '../database/repository-base';
import { IDbContext } from '../database/database-context';

export interface ISessionRepository {
  findById(id: UniqueId): Promise<any | null>;
  findActiveByInstanceId(instanceId: UniqueId): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  delete(id: UniqueId): Promise<void>;
  revokeAllForInstance(instanceId: UniqueId): Promise<void>;
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
}
