import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { ConnectionState, createConnectionEvent } from './connection-events';

const VALID_TRANSITIONS: Record<ConnectionState, ConnectionState[]> = {
  disconnected: ['connecting', 'destroyed'],
  connecting: ['connected', 'reconnecting', 'failed', 'destroyed'],
  connected: ['disconnected', 'reconnecting', 'destroyed'],
  reconnecting: ['connecting', 'disconnected', 'failed', 'destroyed'],
  failed: ['connecting', 'destroyed'],
  destroyed: [],
};

export class ConnectionStateMachine extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private _state: ConnectionState;
  private _previousState: ConnectionState | null;
  private _history: Array<{ from: ConnectionState; to: ConnectionState; at: Date; reason?: string }>;
  private _maxHistory: number;

  constructor(instanceId: UniqueId, logger: ILogger) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._state = 'disconnected';
    this._previousState = null;
    this._history = [];
    this._maxHistory = 50;
  }

  get state(): ConnectionState {
    return this._state;
  }

  get previousState(): ConnectionState | null {
    return this._previousState;
  }

  get history(): ReadonlyArray<{ from: ConnectionState; to: ConnectionState; at: Date; reason?: string }> {
    return [...this._history];
  }

  canTransition(to: ConnectionState): boolean {
    return VALID_TRANSITIONS[this._state]?.includes(to) ?? false;
  }

  transition(to: ConnectionState, reason?: string): boolean {
    if (!this.canTransition(to)) {
      this._logger.warn(
        `[ConnectionStateMachine] Invalid transition: ${this._state} → ${to}`,
        { instanceId: this._instanceId },
      );
      return false;
    }

    const from = this._state;
    this._previousState = from;
    this._state = to;

    this._history.push({ from, to, at: new Date(), reason });
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    this._logger.debug(
      `[ConnectionStateMachine] ${from} → ${to}`,
      { instanceId: this._instanceId, reason },
    );

    const event = createConnectionEvent('connection.state_changed', this._instanceId, {
      from,
      to,
      reason,
    });

    this.emit('stateChanged', event);
    this.emit(to, event);

    return true;
  }

  reset(): void {
    this._previousState = this._state;
    this._state = 'disconnected';
    this._history = [];
  }

  isTerminal(): boolean {
    return this._state === 'destroyed';
  }

  isTransient(): boolean {
    return this._state === 'connecting' || this._state === 'reconnecting';
  }

  onStateChanged(handler: (event: any) => void): void {
    this.on('stateChanged', handler);
  }
}
