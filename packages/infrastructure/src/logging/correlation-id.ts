import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

const correlationStorage = new AsyncLocalStorage<string>();

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}

export function setCorrelationId(_correlationId: string): void {
  // This creates a new context; typically used with run()
}

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationStorage.run(correlationId, fn);
}

export function generateCorrelationId(): string {
  return randomUUID();
}

export function getOrCreateCorrelationId(): string {
  return getCorrelationId() || generateCorrelationId();
}
