import { UniqueId, ILogger } from '@wacore/shared';
import { IProvider } from '@wacore/wa-core';
import { EventEmitter } from 'events';
import { AnySessionEvent, createSessionEvent } from './session-events';
import { ISessionPersistence } from './session-persistence';
import { SessionStore } from './session-store';

export interface SessionRecoveryConfig {
  maxReconnectAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

export class SessionRecovery extends EventEmitter {
  private readonly _logger: ILogger;
  private readonly _persistence: ISessionPersistence;
  private readonly _store: SessionStore;
  private readonly _maxReconnectAttempts: number;
  private readonly _baseDelayMs: number;
  private readonly _maxDelayMs: number;
  private readonly _backoffMultiplier: number;

  private readonly _reconnectAttempts: Map<UniqueId, number> = new Map();
  private readonly _reconnectTimers: Map<UniqueId, NodeJS.Timeout> = new Map();
  private readonly _providers: Map<UniqueId, IProvider> = new Map();

  constructor(
    logger: ILogger,
    persistence: ISessionPersistence,
    store: SessionStore,
    config?: SessionRecoveryConfig,
  ) {
    super();
    this._logger = logger.child({ module: 'SessionRecovery' });
    this._persistence = persistence;
    this._store = store;
    this._maxReconnectAttempts = config?.maxReconnectAttempts ?? 5;
    this._baseDelayMs = config?.baseDelayMs ?? 2000;
    this._maxDelayMs = config?.maxDelayMs ?? 30000;
    this._backoffMultiplier = config?.backoffMultiplier ?? 2;
  }

  registerProvider(instanceId: UniqueId, provider: IProvider): void {
    this._providers.set(instanceId, provider);
  }

  unregisterProvider(instanceId: UniqueId): void {
    this._providers.delete(instanceId);
    this.cancelReconnect(instanceId);
  }

  async restoreSession(instanceId: UniqueId): Promise<boolean> {
    const lock = this._store.acquireLock(instanceId);
    if (!lock) {
      this._logger.warn('Cannot acquire lock for restore', { instanceId });
      return false;
    }

    try {
      const authState = await this._persistence.loadAuthState(instanceId);
      if (!authState) {
        this._logger.info('No auth state to restore', { instanceId });
        this._store.releaseLock(instanceId);
        return false;
      }

      const exists = await this._persistence.authStateExists(instanceId);
      if (!exists) {
        this._logger.info('No persisted auth state', { instanceId });
        this._store.releaseLock(instanceId);
        return false;
      }

      const provider = this._providers.get(instanceId);
      if (!provider) {
        this._logger.error('No provider for restore', undefined, { instanceId });
        this._store.releaseLock(instanceId);
        return false;
      }

      await provider.loadAuthState(authState);
      this.emitEvent(createSessionEvent('session.auth.loaded', instanceId, ''));
      this.emitEvent(createSessionEvent('session.restored', instanceId, '', { hasAuthState: true }));
      this._logger.info('Session restored', { instanceId });
      return true;
    } catch (error) {
      this._logger.error('Failed to restore session', error as Error, { instanceId });
      this._store.releaseLock(instanceId);
      return false;
    }
  }

  async attemptReconnect(instanceId: UniqueId): Promise<boolean> {
    const provider = this._providers.get(instanceId);
    if (!provider) return false;

    const currentAttempts = this._reconnectAttempts.get(instanceId) || 0;
    if (currentAttempts >= this._maxReconnectAttempts) {
      this.emitEvent(
        createSessionEvent('session.reconnect.max_attempts', instanceId, '', {
          maxAttempts: this._maxReconnectAttempts,
        }),
      );
      this._logger.warn('Max reconnect attempts reached', {
        instanceId,
        attempts: currentAttempts,
      });
      return false;
    }

    const attempt = currentAttempts + 1;
    this._reconnectAttempts.set(instanceId, attempt);

    const delay = this.calculateDelay(attempt);
    this.emitEvent(
      createSessionEvent('session.reconnect.started', instanceId, '', {
        attempt,
        maxAttempts: this._maxReconnectAttempts,
        delayMs: delay,
      }),
    );

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(async () => {
        this._reconnectTimers.delete(instanceId);
        try {
          const authState = await this._persistence.loadAuthState(instanceId);
          const result = await provider.connect({ authState: authState || undefined });

          if (result.success) {
            this._reconnectAttempts.set(instanceId, 0);
            this.emitEvent(
              createSessionEvent('session.reconnect.success', instanceId, '', {
                attempt,
              }),
            );
            this._logger.info('Reconnect succeeded', { instanceId, attempt });
            resolve(true);
            return;
          }

          this.emitEvent(
            createSessionEvent('session.reconnect.failed', instanceId, '', {
              attempt,
              error: result.error || 'unknown',
            }),
          );
          resolve(false);
        } catch (error) {
          this.emitEvent(
            createSessionEvent('session.reconnect.failed', instanceId, '', {
              attempt,
              error: (error as Error).message,
            }),
          );
          resolve(false);
        }
      }, delay);

      this._reconnectTimers.set(instanceId, timer);
    });
  }

  async reconnectWithBackoff(instanceId: UniqueId): Promise<boolean> {
    for (let attempt = 0; attempt < this._maxReconnectAttempts; attempt++) {
      const success = await this.attemptReconnect(instanceId);
      if (success) return true;
    }
    return false;
  }

  cancelReconnect(instanceId: UniqueId): void {
    const timer = this._reconnectTimers.get(instanceId);
    if (timer) {
      clearTimeout(timer);
      this._reconnectTimers.delete(instanceId);
    }
    this._reconnectAttempts.delete(instanceId);
  }

  getReconnectAttempts(instanceId: UniqueId): number {
    return this._reconnectAttempts.get(instanceId) || 0;
  }

  private calculateDelay(attempt: number): number {
    const delay = this._baseDelayMs * Math.pow(this._backoffMultiplier, attempt - 1);
    return Math.min(delay, this._maxDelayMs);
  }

  private emitEvent(event: AnySessionEvent): void {
    this.emit('recovery_event', event);
    this.emit(event.type, event);
  }
}
