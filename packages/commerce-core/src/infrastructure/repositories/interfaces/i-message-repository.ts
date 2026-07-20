import { UniqueId } from '@wacore/shared';

export interface MessageData {
  id: UniqueId;
  instanceId: UniqueId;
  externalId: string;
  conversationId: UniqueId;
  direction: string;
  type: string;
  content: Record<string, unknown>;
  status: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface IMessageRepository {
  findById(id: UniqueId): Promise<MessageData | null>;
  findByExternalId(instanceId: UniqueId, externalId: string): Promise<MessageData | null>;
  save(message: MessageData): Promise<void>;
  findRecentByInstanceId(instanceId: UniqueId, limit?: number): Promise<MessageData[]>;
}
