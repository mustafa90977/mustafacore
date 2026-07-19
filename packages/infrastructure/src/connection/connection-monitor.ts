import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { ConnectionStateMachine } from './connection-state-machine';
import { Heartbeat, HeartbeatConfig } from './heartbeat';
import { createConnectionEvent } from './connection-events';

export interface ConnectionHealth {
  readonly instanceId: UniqueId;
  readonly state: string;
  readonly uptime: number;
  readonly lastActivity: Date | null;
  readonly heartbeatMissed: number;
  readonly healthy: boolean;
}

export interface ConnectionMonitorConfig {
  readonly healthCheckIntervalMs: number;
  readonly staleThresholdMs: number;
  readonly heartbeat?: Partial<HeartbeatConfig>;
}

const DEFAULT_MONITOR_CONFIG: ConnectionMonitorConfig = {
  healthCheckIntervalMs: 60000,
  staleThresholdMs: 120000,
};

export class ConnectionMonitor extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _stateMachine: ConnectionStateMachine;
  private readonly _heartbeat: Heartbeat;
  private readonly _config: ConnectionMonitorConfig;
  private _monitorTimer: ReturnType<typeof setInterval> | null;
  private _connectedAt: Date | null;
  private _lastActivity: Date | null;
  private _isRunning: boolean;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    stateMachine: ConnectionStateMachine,
    config?: Partial<ConnectionMonitorConfig>,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._stateMachine = stateMachine;
    this._config = { ...DEFAULT_MONITOR_CONFIG, ...config };
    this._heartbeat = new Heartbeat(instanceId, logger, stateMachine, config?.heartbeat);
    this._monitorTimer = null;
    this._connectedAt = null;
    this._lastActivity = null;
    this._isRunning = false;

    this._wireHeartbeatEvents();
  }

  get heartbeat(): Heartbeat {
    return this._heartbeat;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get uptime(): number {
    if (!this._connectedAt) return 0;
    return Date.now() - this._connectedAt.getTime();
  }

  start(): void {
    if (this._isRunning) return;

    this._connectedAt = new Date();
    this._lastActivity = new Date();
    this._isRunning = true;

    this._heartbeat.start();

    this._monitorTimer = setInterval(() => {
      this._checkHealth();
    }, this._config.healthCheckIntervalMs);

    this._logger.debug(
      `[ConnectionMonitor] Started`,
      { instanceId: this._instanceId },
    );
  }

  stop(): void {
    if (!this._isRunning) return;
    this._isRunning = false;

    this._heartbeat.stop();

    if (this._monitorTimer) {
      clearInterval(this._monitorTimer);
      this._monitorTimer = null;
    }

    this._connectedAt = null;
    this._lastActivity = null;

    this._logger.debug(
      `[ConnectionMonitor] Stopped`,
      { instanceId: this._instanceId },
    );
  }

  recordActivity(): void {
    this._lastActivity = new Date();
  }

  getHealth(): ConnectionHealth {
    const isStale = this._lastActivity
      ? (Date.now() - this._lastActivity.getTime()) > this._config.staleThresholdMs
      : false;

    const healthy = this._stateMachine.state === 'connected' && !isStale && this._heartbeat.consecutiveMissed < 3;

    return {
      instanceId: this._instanceId,
      state: this._stateMachine.state,
      uptime: this.uptime,
      lastActivity: this._lastActivity,
      heartbeatMissed: this._heartbeat.consecutiveMissed,
      healthy,
    };
  }

  private _checkHealth(): void {
    if (this._stateMachine.state !== 'connected') {
      this.stop();
      return;
    }

    const health = this.getHealth();

    this.emit('checked', createConnectionEvent('connection.monitor.checked', this._instanceId, {
      uptime: health.uptime,
      heartbeatMissed: health.heartbeatMissed,
      healthy: health.healthy,
    }));

    if (!health.healthy) {
      this._logger.warn(
        `[ConnectionMonitor] Connection unhealthy`,
        { instanceId: this._instanceId, health },
      );

      if (isStale(health.lastActivity, this._config.staleThresholdMs)) {
        this.emit('unhealthy', createConnectionEvent('connection.monitor.unhealthy', this._instanceId, {
          reason: 'stale',
          uptime: health.uptime,
          lastActivity: health.lastActivity?.toISOString(),
        }));
      } else {
        this.emit('degraded', createConnectionEvent('connection.monitor.degraded', this._instanceId, {
          heartbeatMissed: health.heartbeatMissed,
          uptime: health.uptime,
        }));
      }
    }
  }

  private _wireHeartbeatEvents(): void {
    this._heartbeat.on('failed', (event) => {
      this.emit('unhealthy', createConnectionEvent('connection.monitor.unhealthy', this._instanceId, {
        reason: 'heartbeat_failed',
        consecutiveMissed: event.metadata?.consecutiveMissed,
      }));
    });

    this._heartbeat.on('missed', (event) => {
      this.emit('degraded', createConnectionEvent('connection.monitor.degraded', this._instanceId, {
        reason: 'heartbeat_missed',
        consecutiveMissed: event.metadata?.consecutiveMissed,
      }));
    });
  }
}

function isStale(lastActivity: Date | null, thresholdMs: number): boolean {
  if (!lastActivity) return true;
  return (Date.now() - lastActivity.getTime()) > thresholdMs;
}
