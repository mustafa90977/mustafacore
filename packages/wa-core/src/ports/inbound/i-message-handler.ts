import { UniqueId, DomainEvent } from '@wacore/shared';

export interface IMessageHandler {
  handle(event: DomainEvent): Promise<void>;
}

export interface IConnectionHandler {
  handleConnectionStatus(instanceId: UniqueId, status: string): Promise<void>;
}
