import { UniqueId } from '@wacore/shared';
import { RepositoryBase, IRepositoryOptions } from '../database/repository-base';
import { IDbContext } from '../database/database-context';
import { mapPrismaError } from '../database/error-mapping';

export interface IMessageRepository {
  findById(id: UniqueId): Promise<any | null>;
  findByExternalId(instanceId: UniqueId, externalId: string): Promise<any | null>;
  findByInstanceId(instanceId: UniqueId, options?: IRepositoryOptions): Promise<any[]>;
  findByConversationId(conversationId: UniqueId, options?: IRepositoryOptions): Promise<any[]>;
  findRecentByInstanceId(instanceId: UniqueId, limit?: number): Promise<any[]>;
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

  async findRecentByInstanceId(instanceId: UniqueId, limit: number = 50): Promise<any[]> {
    try {
      return await this.client.message.findMany({
        where: { instanceId },
        include: {
          conversation: {
            include: {
              customer: {
                select: {
                  id: true,
                  phoneNumber: true,
                  name: true,
                  pushName: true,
                },
              },
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
    } catch (error) {
      throw mapPrismaError(error as Error, this._modelName);
    }
  }
}
