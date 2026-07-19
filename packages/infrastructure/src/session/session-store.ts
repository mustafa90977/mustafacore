import { UniqueId, ILogger, generateId } from '@wacore/shared';
import { SessionStatus } from '@wacore/wa-core';
import { SessionData, ISessionStore } from '@wacore/wa-core';
import { EventEmitter } from 'events';
import { AnySessionEvent, createSessionEvent } from './session-events';

export interface SessionStoreConfig {
  lockTtlMs?: number;
  sessionTtlMs?: number;
  cleanupIntervalMs?: number;
}

export interface SessionLock {
  lockId: string;
  instanceId: UniqueId;
  acquiredAt: Date;
  expiresAt: Date;
}

export class SessionStore extends EventEmitter implements ISessionStore {
  private readonly _sessions: Map<UniqueId, SessionData> = new Map();
  private readonly _locks: Map<UniqueId, SessionLock> = new Map();
  private readonly _logger: ILogger;
  private readonly _lockTtlMs: number;
  private readonly _sessionTtlMs: number;
  private _cleanupTimer: NodeJS.Timeout | null = null;

  constructor(logger: ILogger, config?: SessionStoreConfig) {
    super();
    this._logger = logger.child({ module: 'SessionStore' });
    this._lockTtlMs = config?.lockTtlMs ?? 30000;
    this._sessionTtlMs = config?.sessionTtlMs ?? 86400000;
  }

  getActiveSession(instanceId: UniqueId): Promise<SessionData | null> {
    const session = this._sessions.get(instanceId);
    if (session && session.isActive && session.status !== SessionStatus.EXPIRED) {
      return Promise.resolve(session);
    }
    return Promise.resolve(null);
  }

  async createSession(instanceId: UniqueId): Promise<SessionData> {
    const existing = this._sessions.get(instanceId);
    if (existing && existing.isActive) {
      throw new Error(`Active session already exists for instance ${instanceId}`);
    }

    const session: SessionData = {
      id: generateId(),
      instanceId,
      sessionId: generateId(),
      status: SessionStatus.INACTIVE,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this._sessions.set(instanceId, session);
    this.emitEvent(createSessionEvent('session.created', instanceId, session.sessionId));
    this._logger.info('Session created', { instanceId, sessionId: session.sessionId });
    return session;
  }

  async updateSession(instanceId: UniqueId, data: Partial<SessionData>): Promise<SessionData> {
    const session = this._sessions.get(instanceId);
    if (!session) {
      throw new Error(`Session not found for instance ${instanceId}`);
    }

    const updated: SessionData = {
      ...session,
      ...data,
      id: session.id,
      instanceId: session.instanceId,
      updatedAt: new Date(),
    };

    this._sessions.set(instanceId, updated);
    return updated;
  }

  async deleteSession(instanceId: UniqueId): Promise<void> {
    const session = this._sessions.get(instanceId);
    if (session) {
      this._sessions.delete(instanceId);
      this.releaseLock(instanceId);
      this.emitEvent(createSessionEvent('session.destroyed', instanceId, session.sessionId));
      this._logger.info('Session deleted', { instanceId });
    }
  }

  async revokeSession(instanceId: UniqueId): Promise<void> {
    const session = this._sessions.get(instanceId);
    if (session) {
      session.status = SessionStatus.REVOKED;
      session.isActive = false;
      session.updatedAt = new Date();
      this.releaseLock(instanceId);
      this.emitEvent(createSessionEvent('session.revoked', instanceId, session.sessionId));
      this._logger.info('Session revoked', { instanceId });
    }
  }

  async markSessionActive(instanceId: UniqueId): Promise<void> {
    const session = this._sessions.get(instanceId);
    if (session) {
      session.status = SessionStatus.ACTIVE;
      session.isActive = true;
      session.updatedAt = new Date();
      this.emitEvent(createSessionEvent('session.activated', instanceId, session.sessionId));
    }
  }

  async markSessionExpired(instanceId: UniqueId): Promise<void> {
    const session = this._sessions.get(instanceId);
    if (session) {
      session.status = SessionStatus.EXPIRED;
      session.isActive = false;
      session.updatedAt = new Date();
      this.releaseLock(instanceId);
      this.emitEvent(
        createSessionEvent('session.expired', instanceId, session.sessionId, {
          reason: 'ttl_exceeded',
        }),
      );
      this._logger.info('Session expired', { instanceId });
    }
  }

  acquireLock(instanceId: UniqueId, ttlMs?: number): SessionLock | null {
    const existing = this._locks.get(instanceId);
    if (existing && existing.expiresAt > new Date()) {
      return null;
    }

    const ttl = ttlMs ?? this._lockTtlMs;
    const lock: SessionLock = {
      lockId: generateId(),
      instanceId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + ttl),
    };

    this._locks.set(instanceId, lock);
    this.emitEvent(
      createSessionEvent('session.locked', instanceId, '', {
        lockId: lock.lockId,
        ttl,
      }),
    );
    this._logger.debug('Lock acquired', { instanceId, lockId: lock.lockId });
    return lock;
  }

  releaseLock(instanceId: UniqueId): boolean {
    const lock = this._locks.get(instanceId);
    if (lock) {
      this._locks.delete(instanceId);
      this.emitEvent(
        createSessionEvent('session.unlocked', instanceId, '', {
          lockId: lock.lockId,
        }),
      );
      this._logger.debug('Lock released', { instanceId, lockId: lock.lockId });
      return true;
    }
    return false;
  }

  isLocked(instanceId: UniqueId): boolean {
    const lock = this._locks.get(instanceId);
    if (!lock) return false;
    if (lock.expiresAt <= new Date()) {
      this._locks.delete(instanceId);
      return false;
    }
    return true;
  }

  getLock(instanceId: UniqueId): SessionLock | null {
    const lock = this._locks.get(instanceId);
    if (!lock || lock.expiresAt <= new Date()) {
      this._locks.delete(instanceId);
      return null;
    }
    return lock;
  }

  getAllSessions(): SessionData[] {
    return Array.from(this._sessions.values());
  }

  getSessionsByStatus(status: SessionStatus): SessionData[] {
    return this.getAllSessions().filter((s) => s.status === status);
  }

  getExpiredSessions(): SessionData[] {
    const now = Date.now();
    return this.getAllSessions().filter((s) => {
      if (s.status === SessionStatus.EXPIRED || s.status === SessionStatus.REVOKED) return true;
      const age = now - s.updatedAt.getTime();
      return age > this._sessionTtlMs;
    });
  }

  startCleanup(intervalMs?: number): void {
    this.stopCleanup();
    const interval = intervalMs ?? 60000;
    this._cleanupTimer = setInterval(() => this.runCleanup(), interval);
    this._logger.info('Cleanup started', { intervalMs: interval });
  }

  stopCleanup(): void {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  async runCleanup(): Promise<number> {
    this.emitEvent(
      createSessionEvent('session.cleanup.started', '', ''),
    );

    const expired = this.getExpiredSessions();
    let removedCount = 0;

    for (const session of expired) {
      if (session.status !== SessionStatus.REVOKED) {
        await this.markSessionExpired(session.instanceId);
      }
      this._sessions.delete(session.instanceId);
      this.releaseLock(session.instanceId);
      removedCount++;
    }

    const now = Date.now();
    for (const [instanceId, lock] of this._locks.entries()) {
      if (lock.expiresAt.getTime() <= now) {
        this._locks.delete(instanceId);
      }
    }

    if (removedCount > 0) {
      this.emitEvent(
        createSessionEvent('session.cleanup.completed', '', '', { removedCount }),
      );
      this._logger.info('Cleanup completed', { removedCount });
    }

    return removedCount;
  }

  private emitEvent(event: AnySessionEvent): void {
    this.emit('session_event', event);
    this.emit(event.type, event);
  }
}
