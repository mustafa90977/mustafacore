import { UniqueId } from '@wacore/shared';
import { RepositoryBase } from '../database/repository-base';
import { IDbContext } from '../database/database-context';

export interface IInstanceRepository {
  findById(id: UniqueId): Promise<any | null>;
  findByWorkspaceId(workspaceId: UniqueId): Promise<any[]>;
  findByStoreId(storeId: UniqueId): Promise<any | null>;
  findByPhoneNumber(workspaceId: UniqueId, phoneNumber: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  delete(id: UniqueId): Promise<void>;
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
}
