export { createConnectionEvent } from './connection-events';
export type { ConnectionEvent, ConnectionEventType, ConnectionState, AnyConnectionEvent, ConnectionEventHandler } from './connection-events';

export { ConnectionStateMachine } from './connection-state-machine';

export { ConnectionBackoffStrategy } from './backoff-strategy';
export type { ConnectionBackoffConfig, ConnectionBackoffState } from './backoff-strategy';

export { ReconnectStrategy } from './reconnect-strategy';
export type { ReconnectStrategyConfig } from './reconnect-strategy';

export { Heartbeat } from './heartbeat';
export type { HeartbeatConfig } from './heartbeat';

export { ConnectionMonitor } from './connection-monitor';
export type { ConnectionMonitorConfig, ConnectionHealth } from './connection-monitor';

export { PresenceManager } from './presence-manager';
export type { PresenceStatus, PresenceInfo } from './presence-manager';

export { OfflineQueue } from './offline-queue';
export type { OfflineQueueConfig, QueuedMessage } from './offline-queue';

export { ConnectionMetrics } from './connection-metrics';
export type { ConnectionMetricsData } from './connection-metrics';

export { AutoRecovery } from './auto-recovery';
export type { AutoRecoveryConfig } from './auto-recovery';

export { ConnectionManager } from './connection-manager';
export type { ConnectionManagerConfig } from './connection-manager';

export { ConnectionOrchestrator } from './connection-orchestrator';
export type { ConnectionOrchestratorConfig } from './connection-orchestrator';
