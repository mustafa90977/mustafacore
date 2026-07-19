import { UniqueId, DomainEvent } from '@wacore/shared';
import { MessageType } from '../../../domain/enums/message-type';
import { MessageStatus } from '../../../domain/enums/message-status';
import { MessageDirection } from '../../../domain/enums/message-direction';

export interface IWebhookPublisher {
  publishIncomingMessage(message: IncomingMessage): Promise<void>;
  publishMessageStatus(update: MessageStatusUpdate): Promise<void>;
  publishEvent(event: DomainEvent): Promise<void>;
}

export interface IncomingMessage {
  instanceId: UniqueId;
  externalId: string;
  from: string;
  to: string;
  type: MessageType;
  content: Record<string, unknown>;
  timestamp: Date;
  direction: MessageDirection;
}

export interface MessageStatusUpdate {
  instanceId: UniqueId;
  externalId: string;
  status: MessageStatus;
  timestamp: Date;
}

export type IncomingMessageHandler = (message: IncomingMessage) => Promise<void>;
