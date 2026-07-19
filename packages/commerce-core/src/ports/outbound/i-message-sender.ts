import { DomainEvent } from '@wacore/shared';

export interface IMessageSender {
  sendMessage(event: DomainEvent): Promise<void>;
}

export interface INotificationSender {
  sendNotification(event: DomainEvent): Promise<void>;
}
