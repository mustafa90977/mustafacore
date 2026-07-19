# Sprint 2.1 — Event Bus Infrastructure: Completion Report

## Files Created

```
packages/infrastructure/src/events/
├── event-envelope.ts          EventEnvelope types and factories
├── event-serializer.ts        EventSerializer (JSON with Date reviver)
├── event-registry.ts          EventRegistry (versioning, validation)
├── event-handlers.ts          Handler types, config, middleware, interceptors
├── in-memory-event-bus.ts     InMemoryEventBus (full IEventBus impl)
├── event-dispatcher.ts        EventDispatcher (IEventDispatcher impl)
└── index.ts                   Barrel export
```

## Components Implemented

### EventEnvelope (`event-envelope.ts`)
- Generic `EventEnvelope<T>` wrapping DomainEvent or IntegrationEvent
- Fields: eventId, eventType, eventVersion, aggregateId, aggregateType, workspaceId, source, event, timestamp, correlationId, causationId, metadata
- Factory functions: `createEventEnvelopeFromDomain()`, `createEventEnvelopeFromIntegration()`, `createEventEnvelope()`

### EventSerializer (`event-serializer.ts`)
- `IEventSerializer` interface
- `EventSerializer` class with JSON serialization
- Custom Date reviver/replacer to handle Date serialization roundtrip
- `serializeDomainEvent()` / `deserializeDomainEvent()`
- `serializeIntegrationEvent()` / `deserializeIntegrationEvent()`
- `serializeEnvelope()` / `deserializeEnvelope()`
- `serialize()` / `deserialize()` with discriminated union `SerializedEvent`

### EventRegistry (`event-registry.ts`)
- `EventRegistry` class for event type registration
- `register()` — registers event type with version (throws on duplicate version)
- `getRegistration(eventType, version?)` — gets specific or latest version
- `isRegistered(eventType)` — check existence
- `getVersions(eventType)` — list all registered versions
- `getLatestVersion(eventType)` — highest registered version
- `getAllRegistrations()` — all registrations
- `getRegistrationsBySource(source)` — filter by source
- `getRegistrationsByAggregate(aggregateType)` — filter by aggregate
- `validateEventMetadata(eventType, metadata)` — validates event against registration

### Event Handler Types (`event-handlers.ts`)
- `EventHandlerConfig` — priority, parallel, retryPolicy, deadLetterHandler
- `DEFAULT_HANDLER_CONFIG` — priority: 0, parallel: false
- `RetryPolicy` — maxRetries, baseDelayMs, maxDelayMs, backoffMultiplier, retryableErrorNames
- `IDeadLetterHandler` — handle(envelope, error, attemptCount)
- `EnvelopeEventHandler<T>` — (envelope: EventEnvelope<T>) => Promise<void>
- `EventBusMiddleware` — beforePublish, afterPublish, onError hooks
- `EventBusInterceptor` — intercept(envelope, next) for AOP-style middleware
- `HandlerRegistration` — full registration metadata

### InMemoryEventBus (`in-memory-event-bus.ts`)
Implements `IEventBus` from `@wacore/shared`:

| Method | Description |
|--------|-------------|
| `subscribe()` | IEventBus-compatible — wraps EventHandler into EnvelopeEventHandler |
| `subscribeWithConfig()` | Rich API — accepts EnvelopeEventHandler + full config |
| `subscribeAll()` | Global wildcard handler |
| `once()` | One-shot handler (auto-unsubscribes after first invocation) |
| `publish()` | Publish single event through middleware pipeline + handler execution |
| `publishMany()` | Sequential publish of multiple events |
| `start()` / `stop()` | Lifecycle management |
| `addMiddleware()` / `removeMiddleware()` | Middleware pipeline management |
| `addInterceptor()` / `removeInterceptor()` | Interceptor chain management |
| `setCorrelationId()` / `getCorrelationId()` | Correlation ID propagation |
| `isRunning()` | Status check |
| `getRegisteredEvents()` | List registered event names |
| `getHandlerCount()` | Handler count per event |

**Execution Features:**
- Priority-based handler ordering (lower number = higher priority)
- Sequential handler execution (handler at a time)
- Retry with configurable backoff (exponential/linear/fixed)
- 30s timeout per handler execution
- Dead letter handler for failed events after all retries exhausted
- Middleware pipeline: beforePublish → handler → afterPublish
- Interceptor chain: AOP-style wrapping with next() delegation
- Correlation ID propagation to all published events

### EventDispatcher (`event-dispatcher.ts`)
Implements `IEventDispatcher` from `@wacore/shared`:

| Method | Description |
|--------|-------------|
| `dispatchDomainEvent()` | Validates against registry, logs, publishes to EventBus |
| `dispatchDomainEvents()` | Sequential dispatch of multiple domain events |
| `dispatchIntegrationEvent()` | Logs and validates destination |
| `start()` / `stop()` | Lifecycle delegation to EventBus |
| `getEventBus()` | Access underlying InMemoryEventBus |
| `getRegistry()` | Access EventRegistry |
| `getSerializer()` | Access EventSerializer |

## Event Metadata Support

Every event going through the bus carries:
- **eventId** — unique identifier
- **eventType** — string event name (from EventNames)
- **eventVersion** — version number for schema evolution
- **aggregateId** — aggregate root identifier
- **aggregateType** — aggregate type name
- **workspaceId** — tenant/workspace identifier
- **source** — WA_CORE, COMMERCE_CORE, SHARED, SYSTEM
- **timestamp** — event creation time
- **correlationId** — request correlation for distributed tracing
- **causationId** — parent event ID for causal chains
- **metadata** — extensible key-value pairs (userId, retryCount, etc.)

## Type Verification Results

| Package | Status |
|---------|--------|
| @wacore/shared | ✅ Zero errors |
| @wacore/wa-core | ✅ Zero errors |
| @wacore/commerce-core | ✅ Zero errors |
| @wacore/infrastructure | ✅ Zero errors |

## Architecture Compliance

- InMemoryEventBus implements `IEventBus` from `@wacore/shared`
- EventDispatcher implements `IEventDispatcher` from `@wacore/shared`
- No references to wa-core or commerce-core from infrastructure events
- No WhatsApp logic, no API routes, no UI components
- Events from shared package are the canonical types

## Usage Example

```typescript
import {
  InMemoryEventBus,
  EventDispatcher,
  EventRegistry,
  EventSerializer,
} from '@wacore/infrastructure';

// Create components
const registry = new EventRegistry();
const bus = new InMemoryEventBus({
  defaultRetryPolicy: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2 },
});
const dispatcher = new EventDispatcher({ eventBus: bus, registry });

// Register events
registry.register({ eventType: 'ORDER_CREATED', version: 1, aggregateType: 'Order', source: 'COMMERCE_CORE' });

// Subscribe with priority and config
bus.subscribeWithConfig('ORDER_CREATED', async (envelope) => {
  console.log('High priority handler', envelope.event);
}, { priority: 0 });

bus.subscribeWithConfig('ORDER_CREATED', async (envelope) => {
  console.log('Low priority handler', envelope.event);
}, { priority: 10 });

// Publish events
await dispatcher.dispatchDomainEvent(orderCreatedEvent);
```

## Remaining TODOs

- Sprint 2.2 should build WaCore domain entities and repository interfaces
- Persistent event store (outbox pattern) deferred to Sprint 3
- External message broker integration (RabbitMQ/Kafka) deferred
- Event sourcing infrastructure deferred
- Dead letter queue persistence deferred

## Sprint 2.2 Recommendation

Ready to proceed with **Sprint 2.2 — WaCore Domain Layer**.
