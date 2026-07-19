import { DomainEvent, IntegrationEvent } from '@wacore/shared';
import { EventEnvelope } from './event-envelope';

export interface SerializedEvent {
  __type: 'DomainEvent' | 'IntegrationEvent' | 'EventEnvelope';
  data: string;
}

export interface IEventSerializer {
  serializeDomainEvent(event: DomainEvent): string;
  deserializeDomainEvent(data: string): DomainEvent;
  serializeIntegrationEvent(event: IntegrationEvent): string;
  deserializeIntegrationEvent(data: string): IntegrationEvent;
  serializeEnvelope(envelope: EventEnvelope): string;
  deserializeEnvelope(data: string): EventEnvelope;
  serialize(event: DomainEvent | IntegrationEvent): SerializedEvent;
  deserialize(serialized: SerializedEvent): DomainEvent | IntegrationEvent;
}

export class EventSerializer implements IEventSerializer {
  private readonly _reviver: ((key: string, value: unknown) => unknown) | undefined;

  constructor(reviver?: (key: string, value: unknown) => unknown) {
    this._reviver = reviver;
  }

  serializeDomainEvent(event: DomainEvent): string {
    return JSON.stringify(event, this.dateReplacer);
  }

  deserializeDomainEvent(data: string): DomainEvent {
    return JSON.parse(data, this._reviver || this.dateReviver) as DomainEvent;
  }

  serializeIntegrationEvent(event: IntegrationEvent): string {
    return JSON.stringify(event, this.dateReplacer);
  }

  deserializeIntegrationEvent(data: string): IntegrationEvent {
    return JSON.parse(data, this._reviver || this.dateReviver) as IntegrationEvent;
  }

  serializeEnvelope(envelope: EventEnvelope): string {
    return JSON.stringify(envelope, this.dateReplacer);
  }

  deserializeEnvelope(data: string): EventEnvelope {
    return JSON.parse(data, this._reviver || this.dateReviver) as EventEnvelope;
  }

  serialize(event: DomainEvent | IntegrationEvent): SerializedEvent {
    if ('eventId' in event && 'aggregateType' in event) {
      return {
        __type: 'DomainEvent',
        data: this.serializeDomainEvent(event as DomainEvent),
      };
    }
    return {
      __type: 'IntegrationEvent',
      data: this.serializeIntegrationEvent(event as IntegrationEvent),
    };
  }

  deserialize(serialized: SerializedEvent): DomainEvent | IntegrationEvent {
    switch (serialized.__type) {
      case 'DomainEvent':
        return this.deserializeDomainEvent(serialized.data);
      case 'IntegrationEvent':
        return this.deserializeIntegrationEvent(serialized.data);
      default:
        throw new Error(`Unknown event type: ${(serialized as { __type: string }).__type}`);
    }
  }

  private dateReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  private dateReviver(_key: string, value: unknown): unknown {
    if (
      value &&
      typeof value === 'object' &&
      '__type' in value &&
      (value as Record<string, unknown>).__type === 'Date'
    ) {
      return new Date((value as Record<string, unknown>).value as string);
    }
    return value;
  }
}
