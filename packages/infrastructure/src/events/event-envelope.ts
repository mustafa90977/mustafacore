import { DomainEvent, IntegrationEvent } from '@wacore/shared';

export interface EventEnvelope<T extends DomainEvent | IntegrationEvent = DomainEvent | IntegrationEvent> {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly workspaceId: string;
  readonly source: string;
  readonly event: T;
  readonly timestamp: Date;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly metadata: Record<string, unknown>;
}

export function createEventEnvelopeFromDomain(
  event: DomainEvent,
  extraMetadata?: Record<string, unknown>,
): EventEnvelope<DomainEvent> {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    eventVersion: event.metadata.version,
    aggregateId: event.aggregateId,
    aggregateType: event.aggregateType,
    workspaceId: event.workspaceId,
    source: event.source,
    event,
    timestamp: event.timestamp,
    correlationId: event.metadata.correlationId,
    causationId: event.metadata.causationId,
    metadata: {
      userId: event.metadata.userId,
      ...extraMetadata,
    },
  };
}

export function createEventEnvelopeFromIntegration(
  event: IntegrationEvent,
  extraMetadata?: Record<string, unknown>,
): EventEnvelope<IntegrationEvent> {
  return {
    eventId: event.messageId,
    eventType: event.eventType,
    eventVersion: 1,
    aggregateId: '',
    aggregateType: '',
    workspaceId: '',
    source: event.source,
    event,
    timestamp: event.timestamp,
    correlationId: event.metadata.correlationId,
    causationId: event.metadata.causationId,
    metadata: {
      retryCount: event.metadata.retryCount,
      maxRetries: event.metadata.maxRetries,
      destination: event.destination,
      ...extraMetadata,
    },
  };
}

export function createEventEnvelope<T extends DomainEvent | IntegrationEvent>(params: {
  eventId: string;
  eventType: string;
  eventVersion?: number;
  aggregateId?: string;
  aggregateType?: string;
  workspaceId?: string;
  source: string;
  event: T;
  timestamp?: Date;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, unknown>;
}): EventEnvelope<T> {
  return {
    eventId: params.eventId,
    eventType: params.eventType,
    eventVersion: params.eventVersion ?? 1,
    aggregateId: params.aggregateId ?? '',
    aggregateType: params.aggregateType ?? '',
    workspaceId: params.workspaceId ?? '',
    source: params.source,
    event: params.event,
    timestamp: params.timestamp ?? new Date(),
    correlationId: params.correlationId,
    causationId: params.causationId,
    metadata: params.metadata ?? {},
  };
}
