import { DomainEvent } from './domain-event';
import { EventName } from './event-names';

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

export interface Subscription {
  id: string;
  unsubscribe(): void;
}

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventName: EventName,
    handler: EventHandler<T>
  ): Subscription;
  subscribeAll(handler: EventHandler): Subscription;
  start(): Promise<void>;
  stop(): Promise<void>;
}
