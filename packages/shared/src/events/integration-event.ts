import { DomainEvent } from './domain-event';
import { UniqueId } from '../types/identifier';

export interface IntegrationEvent {
  messageId: UniqueId;
  eventType: string;
  source: string;
  destination: string;
  payload: Record<string, unknown>;
  metadata: IntegrationEventMetadata;
  timestamp: Date;
}

export interface IntegrationEventMetadata {
  correlationId: UniqueId;
  causationId?: UniqueId;
  retryCount: number;
  maxRetries: number;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
  nextRetryAt?: Date;
}

export function createIntegrationEvent(
  domainEvent: DomainEvent,
  destination: string
): IntegrationEvent {
  return {
    messageId: domainEvent.eventId,
    eventType: domainEvent.eventType,
    source: domainEvent.source,
    destination,
    payload: domainEvent.payload,
    metadata: {
      correlationId: domainEvent.metadata.correlationId || domainEvent.eventId,
      causationId: domainEvent.eventId,
      retryCount: 0,
      maxRetries: 3,
      firstAttemptAt: new Date(),
      lastAttemptAt: new Date(),
    },
    timestamp: new Date(),
  };
}
