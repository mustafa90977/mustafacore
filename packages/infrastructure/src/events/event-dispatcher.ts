import {
  DomainEvent,
  IntegrationEvent,
  IEventDispatcher,
  ILogger,
} from '@wacore/shared';
import { InMemoryEventBus } from './in-memory-event-bus';
import { EventSerializer, IEventSerializer } from './event-serializer';
import { EventRegistry } from './event-registry';

export interface EventDispatcherOptions {
  eventBus: InMemoryEventBus;
  registry?: EventRegistry;
  serializer?: IEventSerializer;
  logger?: ILogger;
  integrationEventDestination?: string;
}

export class EventDispatcher implements IEventDispatcher {
  private readonly _eventBus: InMemoryEventBus;
  private readonly _registry?: EventRegistry;
  private readonly _serializer: IEventSerializer;
  private readonly _logger?: ILogger;
  private readonly _integrationDestination?: string;

  constructor(options: EventDispatcherOptions) {
    this._eventBus = options.eventBus;
    this._registry = options.registry;
    this._serializer = options.serializer || new EventSerializer();
    this._logger = options.logger;
    this._integrationDestination = options.integrationEventDestination;
  }

  async dispatchDomainEvent(event: DomainEvent): Promise<void> {
    if (this._registry) {
      const validation = this._registry.validateEventMetadata(event.eventType, event.metadata);
      if (!validation.valid) {
        this._logger?.warn('Event metadata validation failed', {
          eventType: event.eventType,
          errors: validation.errors,
        });
      }
    }

    this._logger?.debug('Dispatching domain event', {
      eventType: event.eventType,
      eventId: event.eventId,
      aggregateId: event.aggregateId,
    });

    await this._eventBus.publish(event);
  }

  async dispatchDomainEvents(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.dispatchDomainEvent(event);
    }
  }

  async dispatchIntegrationEvent(event: IntegrationEvent): Promise<void> {
    this._logger?.debug('Dispatching integration event', {
      eventType: event.eventType,
      messageId: event.messageId,
      destination: event.destination,
    });

    if (this._integrationDestination && event.destination !== this._integrationDestination) {
      this._logger?.warn('Integration event destination mismatch', {
        expected: this._integrationDestination,
        actual: event.destination,
      });
    }
  }

  async start(): Promise<void> {
    await this._eventBus.start();
    this._logger?.info('EventDispatcher started');
  }

  async stop(): Promise<void> {
    await this._eventBus.stop();
    this._logger?.info('EventDispatcher stopped');
  }

  getEventBus(): InMemoryEventBus {
    return this._eventBus;
  }

  getRegistry(): EventRegistry | undefined {
    return this._registry;
  }

  getSerializer(): IEventSerializer {
    return this._serializer;
  }
}
