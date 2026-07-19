import { UniqueId, ILogger } from '@wacore/shared';
import { IProvider, ConnectionStatus, AuthState, SessionData } from '@wacore/wa-core';
import { EventEmitter } from 'events';
import { AnySessionEvent, SessionEventHandler } from './session-events';
import { ISessionPersistence, SessionPersistenceConfig, SessionPersistence } from './session-persistence';
import { SessionStore, SessionStoreConfig } from './session-store';
import { SessionLifecycle, SessionLifecycleConfig } from './session-lifecycle';
import { SessionRecovery, SessionRecoveryConfig } from './session-recovery';

export interface SessionManagerConfig {
  persistence: SessionPersistenceConfig;
  store?: SessionStoreConfig;
  lifecycle?: SessionLifecycleConfig;
  recovery?: SessionRecoveryConfig;
}

export class SessionManager extends EventEmitter {
  private readonly _logger: ILogger;
  private readonly _persistence: ISessionPersistence;
  private readonly _store: SessionStore;
  private readonly _lifecycle: SessionLifecycle;
  private readonly _recovery: SessionRecovery;
  private readonly _providers: Map<UniqueId, IProvider> = new Map();

  constructor(logger: ILogger, config: SessionManagerConfig) {
    super();
    this._logger = logger.child({ module: 'SessionManager' });
    this._persistence = new SessionPersistence(logger, config.persistence);
    this._store = new SessionStore(logger, config.store);
    this._lifecycle = new SessionLifecycle(logger, this._persistence, this._store, config.lifecycle);
    this._recovery = new SessionRecovery(logger, this._persistence, this._store, config.recovery);

    this.wireEvents();
  }

  async start(instanceId: UniqueId, provider: IProvider): Promise<boolean> {
    this._providers.set(instanceId, provider);
    this._lifecycle.registerProvider(instanceId, provider);
    this._recovery.registerProvider(instanceId, provider);

    const lock = this._store.acquireLock(instanceId);
    if (!lock) {
      this._logger.warn('Cannot acquire lock for start', { instanceId });
      return false;
    }

    let session = await this._store.getActiveSession(instanceId);
    if (!session) {
      session = await this._store.createSession(instanceId);
    }

    const restored = await this._recovery.restoreSession(instanceId);
    if (restored) {
      const connected = await this._lifecycle.connect(instanceId);
      if (connected) {
        await this._store.markSessionActive(instanceId);
        this._logger.info('Session started (restored)', { instanceId });
        return true;
      }
    }

    const connected = await this._lifecycle.connect(instanceId);
    if (connected) {
      await this._store.markSessionActive(instanceId);
      this._logger.info('Session started (fresh)', { instanceId });
      return true;
    }

    this._store.releaseLock(instanceId);
    this._logger.warn('Session start failed', { instanceId });
    return false;
  }

  async stop(instanceId: UniqueId): Promise<void> {
    await this._lifecycle.disconnect(instanceId);
    this._recovery.cancelReconnect(instanceId);
    this._providers.delete(instanceId);
    this._lifecycle.unregisterProvider(instanceId);
    this._recovery.unregisterProvider(instanceId);
    this._logger.info('Session stopped', { instanceId });
  }

  async destroy(instanceId: UniqueId): Promise<void> {
    await this._lifecycle.destroy(instanceId);
    this._recovery.cancelReconnect(instanceId);
    this._providers.delete(instanceId);
    this._lifecycle.unregisterProvider(instanceId);
    this._recovery.unregisterProvider(instanceId);
    this._logger.info('Session destroyed', { instanceId });
  }

  async reconnect(instanceId: UniqueId): Promise<boolean> {
    return this._recovery.attemptReconnect(instanceId);
  }

  async getSession(instanceId: UniqueId): Promise<SessionData | null> {
    return this._store.getActiveSession(instanceId);
  }

  async getAllSessions(): Promise<SessionData[]> {
    return this._store.getAllSessions();
  }

  async saveAuthState(instanceId: UniqueId): Promise<void> {
    const provider = this._providers.get(instanceId);
    if (!provider) {
      throw new Error(`No provider for instance ${instanceId}`);
    }
    const authState = await provider.saveAuthState();
    await this._persistence.saveAuthState(instanceId, authState);
    this._logger.info('Auth state saved', { instanceId });
  }

  async loadAuthState(instanceId: UniqueId): Promise<AuthState | null> {
    return this._persistence.loadAuthState(instanceId);
  }

  async hasStoredAuth(instanceId: UniqueId): Promise<boolean> {
    return this._persistence.authStateExists(instanceId);
  }

  isSessionActive(instanceId: UniqueId): boolean {
    return this._store.isLocked(instanceId);
  }

  getConnectionStatus(instanceId: UniqueId): ConnectionStatus | null {
    const provider = this._providers.get(instanceId);
    return provider ? provider.getConnectionStatus() : null;
  }

  onSessionEvent(handler: SessionEventHandler): void {
    this.on('session_event', handler);
  }

  onLifecycleEvent(handler: SessionEventHandler): void {
    this._lifecycle.on('lifecycle_event', handler);
  }

  onRecoveryEvent(handler: SessionEventHandler): void {
    this._recovery.on('recovery_event', handler);
  }

  startCleanup(intervalMs?: number): void {
    this._store.startCleanup(intervalMs);
  }

  stopCleanup(): void {
    this._store.stopCleanup();
  }

  getStore(): SessionStore {
    return this._store;
  }

  getLifecycle(): SessionLifecycle {
    return this._lifecycle;
  }

  getRecovery(): SessionRecovery {
    return this._recovery;
  }

  private wireEvents(): void {
    this._store.on('session_event', (event: AnySessionEvent) => {
      this.emit('session_event', event);
    });

    this._lifecycle.on('lifecycle_event', (event: AnySessionEvent) => {
      this.emit('session_event', event);
    });

    this._recovery.on('recovery_event', (event: AnySessionEvent) => {
      this.emit('session_event', event);
    });
  }
}
