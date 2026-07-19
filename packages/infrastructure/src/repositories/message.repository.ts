import { UniqueId } from '@wacore/shared';
import { RepositoryBase, IRepositoryOptions } from '../database/repository-base';
import { IDbContext } from '../database/database-context';

export interface IMessageRepository {
  findById(id: UniqueId): Promise<any | null>;
  findByExternalId(instanceId: UniqueId, externalId: string): Promise<any | null>;
  findByInstanceId(instanceId: UniqueId, options?: IRepositoryOptions): Promise<any[]>;
  findByConversationId(conversationId: UniqueId, options?: IRepositoryOptions): Promise<any[]>;
  create(data: any): Promise<any>;
  update(id: UniqueId, data: any): Promise<any>;
  delete(id: UniqueId): Promise<void>;
}

export class MessageRepository extends RepositoryBase<any, any, any> implements IMessageRepository {
  constructor(context: IDbContext) {
    super(context, 'message');
  }

  async findByExternalId(instanceId: UniqueId, externalId: string): Promise<any | null> {
    return this.client.message.findUnique({
      where: { instanceId_externalId: { instanceId, externalId } },
    });
  }

  async findByInstanceId(instanceId: UniqueId, options?: IRepositoryOptions): Promise<any[]> {
    return this.findMany({ ...options, where: { instanceId, ...(options?.where || {}) } });
  }

  async findByConversationId(conversationId: UniqueId, options?: IRepositoryOptions): Promise<any[]> {
    return this.findMany({ ...options, where: { conversationId, ...(options?.where || {}) } });
  }
}
