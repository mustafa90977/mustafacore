import { DomainEvent, UniqueId, createDomainEvent } from '@wacore/shared';

export interface SessionCreatedPayload {
  sessionId: UniqueId;
  instanceId: UniqueId;
  providerSessionId: string;
}

export interface SessionActivatedPayload {
  sessionId: UniqueId;
  instanceId: UniqueId;
}

export interface SessionExpiredPayload {
  sessionId: UniqueId;
  instanceId: UniqueId;
}

export interface SessionRevokedPayload {
  sessionId: UniqueId;
  instanceId: UniqueId;
}

export function createSessionCreatedEvent(
  aggregateId: UniqueId,
  payload: SessionCreatedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'SESSION_CREATED',
    aggregateType: 'WhatsAppSession',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createSessionActivatedEvent(
  aggregateId: UniqueId,
  payload: SessionActivatedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'SESSION_ACTIVATED',
    aggregateType: 'WhatsAppSession',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createSessionExpiredEvent(
  aggregateId: UniqueId,
  payload: SessionExpiredPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'SESSION_EXPIRED',
    aggregateType: 'WhatsAppSession',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createSessionRevokedEvent(
  aggregateId: UniqueId,
  payload: SessionRevokedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'SESSION_REVOKED',
    aggregateType: 'WhatsAppSession',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}
