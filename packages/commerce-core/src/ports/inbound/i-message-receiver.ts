import { DomainEvent } from '@wacore/shared';

export interface IMessageReceiver {
  handleIncomingMessage(event: DomainEvent): Promise<void>;
}

export interface INotificationReceiver {
  handleNotification(event: DomainEvent): Promise<void>;
}
