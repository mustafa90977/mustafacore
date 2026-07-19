import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { ConnectionStateMachine } from './connection-state-machine';
import { createConnectionEvent } from './connection-events';

export interface HeartbeatConfig {
  readonly intervalMs: number;
  readonly timeoutMs: number;
  readonly missedThreshold: number;
}

const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  intervalMs: 30000,
  timeoutMs: 10000,
  missedThreshold: 3,
};

export class Heartbeat extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _stateMachine: ConnectionStateMachine;
  private readonly _config: HeartbeatConfig;
  private _timer: ReturnType<typeof setInterval> | null;
  private _tickTimer: ReturnType<typeof setTimeout> | null;
  private _consecutiveMissed: number;
  private _lastTickAt: Date | null;
  private _lastAckAt: Date | null;
  private _isRunning: boolean;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    stateMachine: ConnectionStateMachine,
    config?: Partial<HeartbeatConfig>,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._stateMachine = stateMachine;
    this._config = { ...DEFAULT_HEARTBEAT_CONFIG, ...config };
    this._timer = null;
    this._tickTimer = null;
    this._consecutiveMissed = 0;
    this._lastTickAt = null;
    this._lastAckAt = null;
    this._isRunning = false;
  }

  get consecutiveMissed(): number {
    return this._consecutiveMissed;
  }

  get lastTickAt(): Date | null {
    return this._lastTickAt;
  }

  get lastAckAt(): Date | null {
    return this._lastAckAt;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  start(): void {
    if (this._isRunning) return;
    if (this._stateMachine.state !== 'connected') {
      this._logger.warn(
        `[Heartbeat] Cannot start: not connected`,
        { instanceId: this._instanceId, state: this._stateMachine.state },
      );
      return;
    }

    this._isRunning = true;
    this._consecutiveMissed = 0;

    this._timer = setInterval(() => {
      this._tick();
    }, this._config.intervalMs);

    this._logger.debug(
      `[Heartbeat] Started`,
      { instanceId: this._instanceId, intervalMs: this._config.intervalMs },
    );
  }

  stop(): void {
    if (!this._isRunning) return;
    this._isRunning = false;

    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._tickTimer) {
      clearTimeout(this._tickTimer);
      this._tickTimer = null;
    }

    this._logger.debug(
      `[Heartbeat] Stopped`,
      { instanceId: this._instanceId, consecutiveMissed: this._consecutiveMissed },
    );
  }

  ack(): void {
    this._lastAckAt = new Date();
    const missed = this._consecutiveMissed;
    this._consecutiveMissed = 0;

    if (missed > 0) {
      this._logger.debug(
        `[Heartbeat] Ack received after ${missed} missed`,
        { instanceId: this._instanceId },
      );
    }

    this.emit('tick', createConnectionEvent('connection.heartbeat.tick', this._instanceId, {
      missed: 0,
      consecutiveMissed: 0,
    }));
  }

  reset(): void {
    this._consecutiveMissed = 0;
    this._lastTickAt = null;
    this._lastAckAt = null;
  }

  private _tick(): void {
    if (this._stateMachine.state !== 'connected') {
      this.stop();
      return;
    }

    this._lastTickAt = new Date();

    this.emit('tick', createConnectionEvent('connection.heartbeat.tick', this._instanceId, {
      consecutiveMissed: this._consecutiveMissed,
    }));

    this._tickTimer = setTimeout(() => {
      this._consecutiveMissed++;

      this._logger.warn(
        `[Heartbeat] Missed (${this._consecutiveMissed}/${this._config.missedThreshold})`,
        { instanceId: this._instanceId },
      );

      this.emit('missed', createConnectionEvent('connection.heartbeat.missed', this._instanceId, {
        consecutiveMissed: this._consecutiveMissed,
        threshold: this._config.missedThreshold,
      }));

      if (this._consecutiveMissed >= this._config.missedThreshold) {
        this._logger.error(
          `[Heartbeat] Failed: threshold exceeded`,
          undefined,
          { instanceId: this._instanceId, missed: this._consecutiveMissed },
        );

        this.emit('failed', createConnectionEvent('connection.heartbeat.failed', this._instanceId, {
          consecutiveMissed: this._consecutiveMissed,
          threshold: this._config.missedThreshold,
        }));

        this.stop();
      }
    }, this._config.timeoutMs);
  }
}
