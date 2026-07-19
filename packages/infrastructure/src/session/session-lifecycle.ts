import { UniqueId, ILogger } from '@wacore/shared';
import { IProvider, ConnectionStatus, AuthState } from '@wacore/wa-core';
import { EventEmitter } from 'events';
import { AnySessionEvent, createSessionEvent } from './session-events';
import { ISessionPersistence } from './session-persistence';
import { SessionStore } from './session-store';

export interface SessionLifecycleConfig {
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  heartbeatMissedThreshold?: number;
  disconnectTimeoutMs?: number;
}

export class SessionLifecycle extends EventEmitter {
  private readonly _logger: ILogger;
  private readonly _persistence: ISessionPersistence;
  private readonly _store: SessionStore;
  private readonly _heartbeatIntervalMs: number;
  private readonly _heartbeatMissedThreshold: number;

  private readonly _heartbeatTimers: Map<UniqueId, NodeJS.Timeout> = new Map();
  private readonly _heartbeatMissed: Map<UniqueId, number> = new Map();
  private readonly _providers: Map<UniqueId, IProvider> = new Map();

  constructor(
    logger: ILogger,
    persistence: ISessionPersistence,
    store: SessionStore,
    config?: SessionLifecycleConfig,
  ) {
    super();
    this._logger = logger.child({ module: 'SessionLifecycle' });
    this._persistence = persistence;
    this._store = store;
    this._heartbeatIntervalMs = config?.heartbeatIntervalMs ?? 30000;
    this._heartbeatMissedThreshold = config?.heartbeatMissedThreshold ?? 3;
  }

  registerProvider(instanceId: UniqueId, provider: IProvider): void {
    this._providers.set(instanceId, provider);
  }

  unregisterProvider(instanceId: UniqueId): void {
    this._providers.delete(instanceId);
    this.stopHeartbeat(instanceId);
  }

  async connect(instanceId: UniqueId, authState?: AuthState): Promise<boolean> {
    const provider = this._providers.get(instanceId);
    if (!provider) {
      this._logger.error('No provider registered', undefined, { instanceId });
      return false;
    }

    const lock = this._store.acquireLock(instanceId);
    if (!lock) {
      this._logger.warn('Cannot acquire lock', { instanceId });
      return false;
    }

    try {
      const existingAuth = authState || (await this._persistence.loadAuthState(instanceId));
      if (existingAuth) {
        await provider.loadAuthState(existingAuth);
        this.emitEvent(createSessionEvent('session.auth.loaded', instanceId, ''));
      }

      const result = await provider.connect({ authState: existingAuth || undefined });
      if (result.success) {
        this.startHeartbeat(instanceId);
        this.emitEvent(
          createSessionEvent('session.activated', instanceId, '', {
            status: result.status,
          }),
        );
        return true;
      }

      this._logger.warn('Connection failed', { instanceId, error: result.error });
      return false;
    } catch (error) {
      this._logger.error('Connect error', error as Error, { instanceId });
      return false;
    }
  }

  async disconnect(instanceId: UniqueId): Promise<void> {
    const provider = this._providers.get(instanceId);
    if (!provider) return;

    this.stopHeartbeat(instanceId);

    try {
      const authState = await provider.saveAuthState();
      await this._persistence.saveAuthState(instanceId, authState);
      this.emitEvent(createSessionEvent('session.auth.saved', instanceId, ''));
    } catch (error) {
      this._logger.error('Failed to save auth before disconnect', error as Error, { instanceId });
    }

    await provider.disconnect();
    this._store.releaseLock(instanceId);
    this.emitEvent(createSessionEvent('session.destroyed', instanceId, ''));
    this._logger.info('Disconnected', { instanceId });
  }

  async destroy(instanceId: UniqueId): Promise<void> {
    const provider = this._providers.get(instanceId);

    this.stopHeartbeat(instanceId);
    this._heartbeatMissed.delete(instanceId);

    if (provider) {
      try {
        await provider.logout();
      } catch {
        // logout may throw if already disconnected
      }
      await provider.destroy();
    }

    await this._persistence.destroyAuthState(instanceId);
    this.emitEvent(createSessionEvent('session.auth.destroyed', instanceId, ''));
    await this._store.deleteSession(instanceId);
    this._providers.delete(instanceId);
    this._logger.info('Session destroyed', { instanceId });
  }

  startHeartbeat(instanceId: UniqueId): void {
    this.stopHeartbeat(instanceId);
    this._heartbeatMissed.set(instanceId, 0);

    const timer = setInterval(async () => {
      await this.checkHeartbeat(instanceId);
    }, this._heartbeatIntervalMs);

    this._heartbeatTimers.set(instanceId, timer);
    this._logger.debug('Heartbeat started', { instanceId, intervalMs: this._heartbeatIntervalMs });
  }

  stopHeartbeat(instanceId: UniqueId): void {
    const timer = this._heartbeatTimers.get(instanceId);
    if (timer) {
      clearInterval(timer);
      this._heartbeatTimers.delete(instanceId);
    }
    this._heartbeatMissed.delete(instanceId);
  }

  private async checkHeartbeat(instanceId: UniqueId): Promise<void> {
    const provider = this._providers.get(instanceId);
    if (!provider) return;

    const status = provider.getConnectionStatus();
    if (status !== ConnectionStatus.CONNECTED) {
      this._heartbeatMissed.set(instanceId, (this._heartbeatMissed.get(instanceId) || 0) + 1);
      const missed = this._heartbeatMissed.get(instanceId) || 0;

      this.emitEvent(
        createSessionEvent('session.heartbeat.missed', instanceId, '', {
          consecutiveMissed: missed,
          threshold: this._heartbeatMissedThreshold,
        }),
      );

      if (missed >= this._heartbeatMissedThreshold) {
        this.emitEvent(
          createSessionEvent('session.heartbeat.failed', instanceId, '', {
            error: `Heartbeat failed: ${missed} consecutive misses`,
          }),
        );
        this.stopHeartbeat(instanceId);
      }
      return;
    }

    this._heartbeatMissed.set(instanceId, 0);
    this.emitEvent(
      createSessionEvent('session.heartbeat.ok', instanceId, '', {
        latencyMs: 0,
      }),
    );
  }

  private emitEvent(event: AnySessionEvent): void {
    this.emit('lifecycle_event', event);
    this.emit(event.type, event);
  }
}
