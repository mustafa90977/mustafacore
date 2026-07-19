import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { IProvider } from '@wacore/wa-core';
import { ConnectionStateMachine } from './connection-state-machine';
import { ReconnectStrategy, ReconnectStrategyConfig } from './reconnect-strategy';
import { createConnectionEvent } from './connection-events';

export interface AutoRecoveryConfig {
  readonly enabled: boolean;
  readonly triggerOnStates: string[];
  readonly cooldownMs: number;
  readonly maxRecoveriesPerHour: number;
  readonly reconnect?: Partial<ReconnectStrategyConfig>;
}

const DEFAULT_RECOVERY_CONFIG: AutoRecoveryConfig = {
  enabled: true,
  triggerOnStates: ['failed', 'disconnected'],
  cooldownMs: 30000,
  maxRecoveriesPerHour: 20,
};

interface RecoveryRecord {
  at: Date;
  success: boolean;
}

export class AutoRecovery extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _stateMachine: ConnectionStateMachine;
  private readonly _reconnectStrategy: ReconnectStrategy;
  private readonly _config: AutoRecoveryConfig;
  private _provider: IProvider | null;
  private _recoveryHistory: RecoveryRecord[];
  private _lastRecoveryAt: Date | null;
  private _isActive: boolean;
  private _abortController: AbortController | null;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    stateMachine: ConnectionStateMachine,
    config?: Partial<AutoRecoveryConfig>,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._stateMachine = stateMachine;
    this._config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
    this._reconnectStrategy = new ReconnectStrategy(instanceId, logger, stateMachine, config?.reconnect);
    this._provider = null;
    this._recoveryHistory = [];
    this._lastRecoveryAt = null;
    this._isActive = false;
    this._abortController = null;

    this._wireStateEvents();
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get reconnectStrategy(): ReconnectStrategy {
    return this._reconnectStrategy;
  }

  bindProvider(provider: IProvider): void {
    this._provider = provider;
  }

  unbindProvider(): void {
    this._provider = null;
  }

  async triggerRecovery(reason: string): Promise<boolean> {
    if (!this._config.enabled) {
      this._logger.debug(
        `[AutoRecovery] Disabled, skipping recovery`,
        { instanceId: this._instanceId },
      );
      return false;
    }

    if (this._isActive) {
      this._logger.debug(
        `[AutoRecovery] Already active`,
        { instanceId: this._instanceId },
      );
      return false;
    }

    if (!this._isWithinCooldown()) {
      this._logger.debug(
        `[AutoRecovery] Cooldown active`,
        { instanceId: this._instanceId, lastRecovery: this._lastRecoveryAt?.toISOString() },
      );
      return false;
    }

    if (this._isRateLimited()) {
      this._logger.warn(
        `[AutoRecovery] Rate limited`,
        { instanceId: this._instanceId, recoveriesInHour: this._recentRecoveryCount() },
      );
      return false;
    }

    if (!this._provider) {
      this._logger.warn(
        `[AutoRecovery] No provider bound`,
        { instanceId: this._instanceId },
      );
      return false;
    }

    this._isActive = true;
    this._lastRecoveryAt = new Date();
    this._abortController = new AbortController();

    this._logger.info(
      `[AutoRecovery] Starting recovery`,
      { instanceId: this._instanceId, reason },
    );

    this.emit('started', createConnectionEvent('connection.recovery.started', this._instanceId, {
      reason,
    }));

    try {
      const success = await this._reconnectStrategy.reconnect(this._provider);

      this._recoveryHistory.push({ at: new Date(), success });
      if (this._recoveryHistory.length > 100) {
        this._recoveryHistory.shift();
      }

      if (success) {
        this._logger.info(
          `[AutoRecovery] Recovery succeeded`,
          { instanceId: this._instanceId },
        );

        this.emit('succeeded', createConnectionEvent('connection.recovery.succeeded', this._instanceId, {
          reason,
        }));
      } else {
        this._logger.warn(
          `[AutoRecovery] Recovery failed`,
          { instanceId: this._instanceId },
        );

        this.emit('failed', createConnectionEvent('connection.recovery.failed', this._instanceId, {
          reason,
          attempts: this._reconnectStrategy.currentAttempt,
        }));
      }

      return success;
    } catch (error) {
      this._logger.error(
        `[AutoRecovery] Recovery error`,
        error as Error,
        { instanceId: this._instanceId },
      );

      this.emit('failed', createConnectionEvent('connection.recovery.failed', this._instanceId, {
        reason,
        error: (error as Error).message,
      }));

      return false;
    } finally {
      this._isActive = false;
      this._abortController = null;
    }
  }

  abort(): void {
    if (this._abortController) {
      this._abortController.abort();
    }
    this._reconnectStrategy.cancel();
    this._isActive = false;

    this.emit('aborted', createConnectionEvent('connection.recovery.aborted', this._instanceId, {}));
  }

  reset(): void {
    this.abort();
    this._reconnectStrategy.reset();
    this._recoveryHistory = [];
    this._lastRecoveryAt = null;
  }

  private _wireStateEvents(): void {
    this._stateMachine.on('stateChanged', (event: any) => {
      if (!this._config.enabled) return;

      const to = event.metadata?.to as string;
      if (this._config.triggerOnStates.includes(to) && !this._isActive) {
        this.triggerRecovery(`state_changed_to_${to}`).catch(() => {});
      }
    });
  }

  private _isWithinCooldown(): boolean {
    if (!this._lastRecoveryAt) return true;
    return (Date.now() - this._lastRecoveryAt.getTime()) >= this._config.cooldownMs;
  }

  private _isRateLimited(): boolean {
    return this._recentRecoveryCount() >= this._config.maxRecoveriesPerHour;
  }

  private _recentRecoveryCount(): number {
    const oneHourAgo = Date.now() - 3600000;
    return this._recoveryHistory.filter((r) => r.at.getTime() >= oneHourAgo).length;
  }
}
