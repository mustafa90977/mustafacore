import { UniqueId } from '@wacore/shared';

export type ConnectionState =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting'
  | 'failed'
  | 'destroyed';

export type ConnectionEventType =
  | 'connection.state_changed'
  | 'connection.established'
  | 'connection.lost'
  | 'connection.attempt_started'
  | 'connection.attempt_succeeded'
  | 'connection.attempt_failed'
  | 'connection.max_retries'
  | 'connection.backoff_applied'
  | 'connection.heartbeat.started'
  | 'connection.heartbeat.tick'
  | 'connection.heartbeat.missed'
  | 'connection.heartbeat.failed'
  | 'connection.presence.updated'
  | 'connection.presence.available'
  | 'connection.presence.unavailable'
  | 'connection.queue.enqueued'
  | 'connection.queue.processed'
  | 'connection.queue.dropped'
  | 'connection.queue.flushed'
  | 'connection.recovery.started'
  | 'connection.recovery.succeeded'
  | 'connection.recovery.failed'
  | 'connection.recovery.aborted'
  | 'connection.monitor.checked'
  | 'connection.monitor.degraded'
  | 'connection.monitor.unhealthy'
  | 'connection.metrics.updated'
  | 'connection.destroyed';

export interface ConnectionEvent {
  readonly type: ConnectionEventType;
  readonly instanceId: UniqueId;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

export type AnyConnectionEvent = ConnectionEvent;

export type ConnectionEventHandler = (event: AnyConnectionEvent) => void | Promise<void>;

export function createConnectionEvent(
  type: ConnectionEventType,
  instanceId: UniqueId,
  metadata?: Record<string, unknown>,
): ConnectionEvent {
  return {
    type,
    instanceId,
    timestamp: new Date(),
    metadata,
  };
}
