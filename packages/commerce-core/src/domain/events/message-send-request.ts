import { DomainEvent, UniqueId, createDomainEvent } from '@wacore/shared';

export interface MessageSendRequestPayload {
  instanceId: UniqueId;
  to: string;
  type: string;
  content: Record<string, unknown>;
  conversationId: UniqueId;
  metadata?: Record<string, unknown>;
}

export function createMessageSendRequestEvent(
  aggregateId: UniqueId,
  payload: MessageSendRequestPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'MESSAGE_SEND_REQUEST',
    aggregateType: 'Message',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}
