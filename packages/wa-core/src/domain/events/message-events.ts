import { DomainEvent, UniqueId, createDomainEvent } from '@wacore/shared';
import { MessageType } from '../enums/message-type';

export interface MessageReceivedPayload {
  messageId: UniqueId;
  instanceId: UniqueId;
  externalId: string;
  from: string;
  to: string;
  type: MessageType;
  content: Record<string, unknown>;
  timestamp: Date;
}

export interface MessageSentPayload {
  messageId: UniqueId;
  instanceId: UniqueId;
  externalId: string;
  to: string;
  timestamp: Date;
}

export interface MessageDeliveredPayload {
  messageId: UniqueId;
  externalId: string;
  deliveredAt: Date;
}

export interface MessageReadPayload {
  messageId: UniqueId;
  externalId: string;
  readAt: Date;
}

export interface MessageFailedPayload {
  messageId: UniqueId;
  instanceId: UniqueId;
  error: string;
  retryable: boolean;
}

export function createMessageReceivedEvent(
  aggregateId: UniqueId,
  payload: MessageReceivedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'MESSAGE_RECEIVED',
    aggregateType: 'Message',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createMessageSentEvent(
  aggregateId: UniqueId,
  payload: MessageSentPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'MESSAGE_SENT',
    aggregateType: 'Message',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createMessageDeliveredEvent(
  aggregateId: UniqueId,
  payload: MessageDeliveredPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'MESSAGE_DELIVERED',
    aggregateType: 'Message',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createMessageReadEvent(
  aggregateId: UniqueId,
  payload: MessageReadPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'MESSAGE_READ',
    aggregateType: 'Message',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createMessageFailedEvent(
  aggregateId: UniqueId,
  payload: MessageFailedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'MESSAGE_FAILED',
    aggregateType: 'Message',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}
