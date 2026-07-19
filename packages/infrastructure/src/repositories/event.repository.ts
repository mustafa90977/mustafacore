import { UniqueId } from '@wacore/shared';
import { RepositoryBase, IRepositoryOptions } from '../database/repository-base';
import { IDbContext } from '../database/database-context';

export interface IEventRepository {
  findById(id: UniqueId): Promise<any | null>;
  findByAggregateId(aggregateType: string, aggregateId: UniqueId): Promise<any[]>;
  findByEventType(eventType: string, options?: IRepositoryOptions): Promise<any[]>;
  findByWorkspaceId(workspaceId: UniqueId, options?: IRepositoryOptions): Promise<any[]>;
  create(data: any): Promise<any>;
  markProcessed(id: UniqueId): Promise<void>;
}

export class EventRepository extends RepositoryBase<any, any, any> implements IEventRepository {
  constructor(context: IDbContext) {
    super(context, 'event');
  }

  async findByAggregateId(aggregateType: string, aggregateId: UniqueId): Promise<any[]> {
    return this.client.event.findMany({
      where: { aggregateType, aggregateId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByEventType(eventType: string, options?: IRepositoryOptions): Promise<any[]> {
    return this.findMany({ ...options, where: { eventType, ...(options?.where || {}) } });
  }

  async findByWorkspaceId(workspaceId: UniqueId, options?: IRepositoryOptions): Promise<any[]> {
    return this.findMany({ ...options, where: { workspaceId, ...(options?.where || {}) } });
  }

  async markProcessed(id: UniqueId): Promise<void> {
    await this.client.event.update({
      where: { id },
      data: { processedAt: new Date() },
    });
  }
}
