import { DomainEvent, UniqueId, createDomainEvent } from '@wacore/shared';

export interface ConversationCreatedPayload {
  conversationId: UniqueId;
  instanceId: UniqueId;
  customerId: UniqueId;
  storeId: UniqueId;
}

export interface ConversationUpdatedPayload {
  conversationId: UniqueId;
  status: string;
  priority?: string;
}

export interface ConversationClosedPayload {
  conversationId: UniqueId;
  closedAt: Date;
}

export function createConversationCreatedEvent(
  aggregateId: UniqueId,
  payload: ConversationCreatedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'CONVERSATION_CREATED',
    aggregateType: 'Conversation',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createConversationUpdatedEvent(
  aggregateId: UniqueId,
  payload: ConversationUpdatedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'CONVERSATION_UPDATED',
    aggregateType: 'Conversation',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createConversationClosedEvent(
  aggregateId: UniqueId,
  payload: ConversationClosedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'CONVERSATION_CLOSED',
    aggregateType: 'Conversation',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}
