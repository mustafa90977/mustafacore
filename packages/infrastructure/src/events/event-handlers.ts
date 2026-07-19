import { DomainEvent } from '@wacore/shared';
import { EventEnvelope } from './event-envelope';

export interface EventHandlerConfig {
  priority: number;
  parallel: boolean;
  retryPolicy?: RetryPolicy;
  deadLetterHandler?: IDeadLetterHandler;
}

export const DEFAULT_HANDLER_CONFIG: EventHandlerConfig = {
  priority: 0,
  parallel: false,
};

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrorNames?: string[];
}

export interface IDeadLetterHandler {
  handle(envelope: EventEnvelope, error: Error, attemptCount: number): Promise<void>;
}

export interface EnvelopeEventHandler<T extends DomainEvent = DomainEvent> {
  (envelope: EventEnvelope<T>): Promise<void>;
}

export interface EventBusMiddleware {
  readonly name: string;
  beforePublish?(envelope: EventEnvelope): Promise<EventEnvelope | null>;
  afterPublish?(envelope: EventEnvelope): Promise<void>;
  onError?(envelope: EventEnvelope, error: Error): Promise<void>;
}

export interface EventBusInterceptor {
  intercept(envelope: EventEnvelope, next: () => Promise<void>): Promise<void>;
}

export interface HandlerRegistration<T extends DomainEvent = DomainEvent> {
  id: string;
  eventName: string;
  handler: EnvelopeEventHandler<T>;
  config: EventHandlerConfig;
  registeredAt: Date;
}

export function createHandlerConfig(overrides?: Partial<EventHandlerConfig>): EventHandlerConfig {
  return { ...DEFAULT_HANDLER_CONFIG, ...overrides };
}
