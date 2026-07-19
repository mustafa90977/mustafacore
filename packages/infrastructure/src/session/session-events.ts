import { UniqueId } from '@wacore/shared';

export interface SessionEvent {
  readonly type: SessionEventType;
  readonly instanceId: UniqueId;
  readonly sessionId: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

export type SessionEventType =
  | 'session.created'
  | 'session.restored'
  | 'session.activated'
  | 'session.expired'
  | 'session.revoked'
  | 'session.destroyed'
  | 'session.locked'
  | 'session.unlocked'
  | 'session.heartbeat.ok'
  | 'session.heartbeat.missed'
  | 'session.heartbeat.failed'
  | 'session.reconnect.started'
  | 'session.reconnect.success'
  | 'session.reconnect.failed'
  | 'session.reconnect.max_attempts'
  | 'session.cleanup.started'
  | 'session.cleanup.completed'
  | 'session.auth.saved'
  | 'session.auth.loaded'
  | 'session.auth.destroyed';

export type AnySessionEvent = SessionEvent;

export type SessionEventHandler = (event: AnySessionEvent) => void | Promise<void>;

export function createSessionEvent<T extends SessionEventType>(
  type: T,
  instanceId: UniqueId,
  sessionId: string,
  metadata?: Record<string, unknown>,
): SessionEvent {
  return {
    type,
    instanceId,
    sessionId,
    timestamp: new Date(),
    metadata,
  };
}
