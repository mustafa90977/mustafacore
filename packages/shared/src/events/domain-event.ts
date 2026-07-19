import { UniqueId } from '../types/identifier';

export interface DomainEvent {
  eventId: UniqueId;
  eventType: string;
  aggregateType: string;
  aggregateId: UniqueId;
  workspaceId: UniqueId;
  source: EventSource;
  payload: Record<string, unknown>;
  metadata: EventMetadata;
  timestamp: Date;
}

export type EventSource = 'WA_CORE' | 'COMMERCE_CORE' | 'SHARED' | 'SYSTEM';

export interface EventMetadata {
  correlationId?: UniqueId;
  causationId?: UniqueId;
  userId?: UniqueId;
  timestamp: Date;
  version: number;
}

export function createDomainEvent(overrides: Partial<DomainEvent>): DomainEvent {
  return {
    eventId: overrides.eventId || '',
    eventType: overrides.eventType || '',
    aggregateType: overrides.aggregateType || '',
    aggregateId: overrides.aggregateId || '',
    workspaceId: overrides.workspaceId || '',
    source: overrides.source || 'SYSTEM',
    payload: overrides.payload || {},
    metadata: overrides.metadata || {
      timestamp: new Date(),
      version: 1,
    },
    timestamp: overrides.timestamp || new Date(),
  };
}
