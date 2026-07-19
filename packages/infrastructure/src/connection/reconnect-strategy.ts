import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { IProvider, ConnectionStatus } from '@wacore/wa-core';
import { ConnectionBackoffStrategy, ConnectionBackoffConfig } from './backoff-strategy';
import { ConnectionStateMachine } from './connection-state-machine';
import { createConnectionEvent } from './connection-events';

export interface ReconnectStrategyConfig {
  readonly backoff?: Partial<ConnectionBackoffConfig>;
  readonly maxReconnectAttempts?: number;
}

interface ReconnectTask {
  timer: ReturnType<typeof setTimeout> | null;
  abortController: AbortController;
}

export class ReconnectStrategy extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _stateMachine: ConnectionStateMachine;
  private readonly _backoff: ConnectionBackoffStrategy;
  private readonly _maxReconnectAttempts: number;
  private _activeTask: ReconnectTask | null;
  private _totalReconnects: number;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    stateMachine: ConnectionStateMachine,
    config?: ReconnectStrategyConfig,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._stateMachine = stateMachine;
    this._backoff = new ConnectionBackoffStrategy(config?.backoff);
    this._maxReconnectAttempts = config?.maxReconnectAttempts ?? 10;
    this._activeTask = null;
    this._totalReconnects = 0;
  }

  get totalReconnects(): number {
    return this._totalReconnects;
  }

  get currentAttempt(): number {
    return this._backoff.attempt;
  }

  get hasExhausted(): boolean {
    return this._backoff.hasExhausted || this._totalReconnects >= this._maxReconnectAttempts;
  }

  async reconnect(provider: IProvider): Promise<boolean> {
    if (this.hasExhausted) {
      this._logger.warn(
        `[ReconnectStrategy] Max reconnect attempts exhausted`,
        { instanceId: this._instanceId, attempts: this._backoff.attempt },
      );
      this.emit('maxRetries', createConnectionEvent('connection.max_retries', this._instanceId, {
        attempts: this._backoff.attempt,
        totalReconnects: this._totalReconnects,
      }));
      return false;
    }

    if (this._activeTask) {
      this._logger.debug(
        `[ReconnectStrategy] Reconnect already in progress`,
        { instanceId: this._instanceId },
      );
      return false;
    }

    this._stateMachine.transition('reconnecting', 'strategy.initiated');

    const abortController = new AbortController();
    this._activeTask = { timer: null, abortController };

    const delay = this._backoff.nextDelay();
    if (delay < 0) {
      this._cleanup();
      return false;
    }

    this._logger.info(
      `[ReconnectStrategy] Scheduling reconnect in ${delay}ms`,
      { instanceId: this._instanceId, attempt: this._backoff.attempt },
    );

    this.emit('backoffApplied', createConnectionEvent('connection.backoff_applied', this._instanceId, {
      delayMs: delay,
      attempt: this._backoff.attempt,
    }));

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(async () => {
        if (abortController.signal.aborted) {
          this._cleanup();
          resolve(false);
          return;
        }

        this._stateMachine.transition('connecting', 'strategy.attempt');

        this.emit('attemptStarted', createConnectionEvent('connection.attempt_started', this._instanceId, {
          attempt: this._backoff.attempt,
          delayMs: delay,
        }));

        try {
          const result = await provider.connect();
          if (abortController.signal.aborted) {
            this._cleanup();
            resolve(false);
            return;
          }

          if (result.status === ConnectionStatus.CONNECTED) {
            this._stateMachine.transition('connected', 'strategy.success');
            this._totalReconnects++;
            this._backoff.reset();

            this.emit('attemptSucceeded', createConnectionEvent('connection.attempt_succeeded', this._instanceId, {
              attempt: this._backoff.attempt,
              totalReconnects: this._totalReconnects,
            }));

            this._cleanup();
            resolve(true);
          } else {
            this._handleAttemptFailure(resolve);
          }
        } catch (error) {
          if (abortController.signal.aborted) {
            this._cleanup();
            resolve(false);
            return;
          }
          this._handleAttemptFailure(resolve, error as Error);
        }
      }, delay);

      if (this._activeTask) {
        this._activeTask.timer = timer;
      }
    });
  }

  cancel(): void {
    if (this._activeTask) {
      this._activeTask.abortController.abort();
      if (this._activeTask.timer) {
        clearTimeout(this._activeTask.timer);
      }
      this._cleanup();

      this._logger.info(
        `[ReconnectStrategy] Reconnect cancelled`,
        { instanceId: this._instanceId },
      );

      this.emit('aborted', createConnectionEvent('connection.recovery.aborted', this._instanceId, {
        attempt: this._backoff.attempt,
      }));
    }
  }

  reset(): void {
    this.cancel();
    this._backoff.reset();
    this._totalReconnects = 0;
  }

  private _handleAttemptFailure(resolve: (value: boolean) => void, error?: Error): void {
    this._stateMachine.transition('reconnecting', 'strategy.attempt_failed');

    this.emit('attemptFailed', createConnectionEvent('connection.attempt_failed', this._instanceId, {
      attempt: this._backoff.attempt,
      error: error?.message,
    }));

    this._cleanup();
    resolve(false);
  }

  private _cleanup(): void {
    this._activeTask = null;
  }
}
