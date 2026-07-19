import { DomainEvent, EventName, IEventBus, EventHandler, Subscription, generateId } from '@wacore/shared';
import { EventEnvelope, createEventEnvelopeFromDomain } from './event-envelope';
import {
  EnvelopeEventHandler,
  EventHandlerConfig,
  EventBusMiddleware,
  EventBusInterceptor,
  HandlerRegistration,
  RetryPolicy,
  IDeadLetterHandler,
  createHandlerConfig,
} from './event-handlers';

export interface InMemoryEventBusOptions {
  defaultRetryPolicy?: RetryPolicy;
  defaultDeadLetterHandler?: IDeadLetterHandler;
}

export class InMemoryEventBus implements IEventBus {
  private readonly _handlers: Map<string, HandlerRegistration[]> = new Map();
  private readonly _globalHandlers: HandlerRegistration[] = [];
  private readonly _middleware: EventBusMiddleware[] = [];
  private readonly _interceptors: EventBusInterceptor[] = [];
  private readonly _defaultRetryPolicy?: RetryPolicy;
  private readonly _defaultDeadLetterHandler?: IDeadLetterHandler;
  private _running = false;
  private _correlationId?: string;

  constructor(options?: InMemoryEventBusOptions) {
    this._defaultRetryPolicy = options?.defaultRetryPolicy;
    this._defaultDeadLetterHandler = options?.defaultDeadLetterHandler;
  }

  subscribe<T extends DomainEvent>(eventName: EventName, handler: EventHandler<T>): Subscription {
    const envelopeHandler: EnvelopeEventHandler<T> = (envelope) => handler(envelope.event as T);
    return this.subscribeWithConfig(eventName, envelopeHandler, createHandlerConfig());
  }

  subscribeWithConfig<T extends DomainEvent>(
    eventName: EventName,
    handler: EnvelopeEventHandler<T>,
    config?: Partial<EventHandlerConfig>,
  ): Subscription {
    const id = generateId();
    const registration: HandlerRegistration = {
      id,
      eventName,
      handler: handler as EnvelopeEventHandler,
      config: {
        ...createHandlerConfig(),
        ...config,
        retryPolicy: config?.retryPolicy || this._defaultRetryPolicy,
        deadLetterHandler: config?.deadLetterHandler || this._defaultDeadLetterHandler,
      },
      registeredAt: new Date(),
    };

    const handlers = this._handlers.get(eventName) || [];
    handlers.push(registration);
    handlers.sort((a, b) => a.config.priority - b.config.priority);
    this._handlers.set(eventName, handlers);

    return {
      id,
      unsubscribe: () => this.unsubscribe(id, eventName),
    };
  }

  subscribeAll(handler: EventHandler): Subscription {
    const id = generateId();
    const envelopeHandler: EnvelopeEventHandler = (envelope) => handler(envelope.event as DomainEvent);
    const registration: HandlerRegistration = {
      id,
      eventName: '*',
      handler: envelopeHandler,
      config: createHandlerConfig(),
      registeredAt: new Date(),
    };
    this._globalHandlers.push(registration);
    return {
      id,
      unsubscribe: () => {
        const idx = this._globalHandlers.findIndex((h) => h.id === id);
        if (idx !== -1) this._globalHandlers.splice(idx, 1);
      },
    };
  }

  once<T extends DomainEvent>(eventName: EventName, handler: EventHandler<T>): Subscription {
    const id = generateId();
    const wrapper: EnvelopeEventHandler<T> = async (envelope) => {
      this.unsubscribe(id, eventName);
      await handler(envelope.event as T);
    };
    return this.subscribeWithConfig(eventName, wrapper, {
      ...createHandlerConfig(),
      priority: -1,
    });
  }

  addMiddleware(middleware: EventBusMiddleware): void {
    this._middleware.push(middleware);
  }

  removeMiddleware(name: string): void {
    const idx = this._middleware.findIndex((m) => m.name === name);
    if (idx !== -1) this._middleware.splice(idx, 1);
  }

  addInterceptor(interceptor: EventBusInterceptor): void {
    this._interceptors.push(interceptor);
  }

  removeInterceptor(interceptor: EventBusInterceptor): void {
    const idx = this._interceptors.indexOf(interceptor);
    if (idx !== -1) this._interceptors.splice(idx, 1);
  }

  setCorrelationId(correlationId: string): void {
    this._correlationId = correlationId;
  }

  getCorrelationId(): string | undefined {
    return this._correlationId;
  }

  async publish(event: DomainEvent): Promise<void> {
    if (!this._running) {
      throw new Error('EventBus is not running. Call start() first.');
    }

    let envelope = createEventEnvelopeFromDomain(event);
    if (this._correlationId && !envelope.correlationId) {
      envelope = {
        ...envelope,
        correlationId: this._correlationId,
        event: {
          ...envelope.event,
          metadata: {
            ...envelope.event.metadata,
            correlationId: this._correlationId,
          },
        } as DomainEvent,
      };
    }

    const processed = await this.applyMiddlewareBefore(envelope);
    if (!processed) return;

    const handlerSets = this._collectHandlers(processed.eventType);

    for (const handler of handlerSets) {
      await this.executeHandlerWithRetry(handler, processed);
    }

    await this.applyMiddlewareAfter(processed);
  }

  async publishMany(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  async start(): Promise<void> {
    this._running = true;
  }

  async stop(): Promise<void> {
    this._running = false;
    this._handlers.clear();
    this._globalHandlers.length = 0;
    this._middleware.length = 0;
    this._interceptors.length = 0;
  }

  isRunning(): boolean {
    return this._running;
  }

  getRegisteredEvents(): string[] {
    return Array.from(this._handlers.keys());
  }

  getHandlerCount(eventName: string): number {
    return (this._handlers.get(eventName) || []).length;
  }

  private unsubscribe(id: string, eventName: string): void {
    const handlers = this._handlers.get(eventName);
    if (!handlers) return;
    const idx = handlers.findIndex((h) => h.id === id);
    if (idx !== -1) handlers.splice(idx, 1);
  }

  private _collectHandlers(eventName: string): HandlerRegistration[] {
    const specific = this._handlers.get(eventName) || [];
    const global = this._globalHandlers;
    const all = [...specific, ...global];
    all.sort((a, b) => a.config.priority - b.config.priority);
    return all;
  }

  private async applyMiddlewareBefore(envelope: EventEnvelope): Promise<EventEnvelope | null> {
    let current: EventEnvelope | null = envelope;
    for (const mw of this._middleware) {
      if (!current) return null;
      if (mw.beforePublish) {
        current = await mw.beforePublish(current);
      }
    }
    return current;
  }

  private async applyMiddlewareAfter(envelope: EventEnvelope): Promise<void> {
    for (const mw of this._middleware) {
      if (mw.afterPublish) {
        await mw.afterPublish(envelope);
      }
    }
  }

  private async executeHandlerWithRetry(
    registration: HandlerRegistration,
    envelope: EventEnvelope,
  ): Promise<void> {
    const config = registration.config;
    const retryPolicy = config.retryPolicy;
    const maxAttempts = retryPolicy ? retryPolicy.maxRetries + 1 : 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.executeWithInterceptors(registration, envelope);
        return;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts && retryPolicy) {
          const delay = this.calculateRetryDelay(attempt, retryPolicy);
          await this.sleep(delay);
        }
      }
    }

    if (lastError && config.deadLetterHandler) {
      try {
        await config.deadLetterHandler.handle(envelope, lastError, maxAttempts);
      } catch {
        // Dead letter handler failure is swallowed to prevent cascade
      }
    }
  }

  private async executeWithInterceptors(
    registration: HandlerRegistration,
    envelope: EventEnvelope,
  ): Promise<void> {
    const interceptors = [...this._interceptors];

    const executeHandler = async (): Promise<void> => {
      const timeout = 30000;
      await Promise.race([
        registration.handler(envelope as EventEnvelope<DomainEvent>),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Handler timeout after ${timeout}ms`)), timeout),
        ),
      ]);
    };

    if (interceptors.length === 0) {
      return executeHandler();
    }

    let chainIndex = 0;
    const next = async (): Promise<void> => {
      if (chainIndex < interceptors.length) {
        const interceptor = interceptors[chainIndex++];
        await interceptor.intercept(envelope, next);
      } else {
        await executeHandler();
      }
    };

    await next();
  }

  private calculateRetryDelay(attempt: number, policy: RetryPolicy): number {
    const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
    return Math.min(delay, policy.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
