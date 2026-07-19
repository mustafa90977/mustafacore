import { DomainEvent } from './domain-event';
import { IntegrationEvent } from './integration-event';

export interface IEventDispatcher {
  dispatchDomainEvent(event: DomainEvent): Promise<void>;
  dispatchIntegrationEvent(event: IntegrationEvent): Promise<void>;
  dispatchDomainEvents(events: DomainEvent[]): Promise<void>;
}
