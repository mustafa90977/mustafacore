import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { IProvider } from '@wacore/wa-core';
import { ConnectionState } from './connection-events';
import { ConnectionStateMachine } from './connection-state-machine';
import { ReconnectStrategyConfig } from './reconnect-strategy';
import { ConnectionMonitor, ConnectionMonitorConfig } from './connection-monitor';
import { PresenceManager } from './presence-manager';
import { OfflineQueue, OfflineQueueConfig, QueuedMessage } from './offline-queue';
import { ConnectionMetrics, ConnectionMetricsData } from './connection-metrics';
import { AutoRecovery, AutoRecoveryConfig } from './auto-recovery';
import { HeartbeatConfig } from './heartbeat';
import { createConnectionEvent, ConnectionEvent, ConnectionEventHandler } from './connection-events';

export interface ConnectionManagerConfig {
  readonly heartbeat?: Partial<HeartbeatConfig>;
  readonly monitor?: Partial<ConnectionMonitorConfig>;
  readonly offlineQueue?: Partial<OfflineQueueConfig>;
  readonly reconnect?: Partial<ReconnectStrategyConfig>;
  readonly autoRecovery?: Partial<AutoRecoveryConfig>;
}

export class ConnectionManager extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _stateMachine: ConnectionStateMachine;
  private readonly _monitor: ConnectionMonitor;
  private readonly _presence: PresenceManager;
  private readonly _offlineQueue: OfflineQueue;
  private readonly _metrics: ConnectionMetrics;
  private readonly _autoRecovery: AutoRecovery;
  private _provider: IProvider | null;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    config?: ConnectionManagerConfig,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;

    this._stateMachine = new ConnectionStateMachine(instanceId, logger);
    this._monitor = new ConnectionMonitor(instanceId, logger, this._stateMachine, config?.monitor);
    this._presence = new PresenceManager(instanceId, logger, this._stateMachine);
    this._offlineQueue = new OfflineQueue(instanceId, logger, config?.offlineQueue);
    this._metrics = new ConnectionMetrics(instanceId);
    this._autoRecovery = new AutoRecovery(instanceId, logger, this._stateMachine, config?.autoRecovery);

    this._provider = null;

    this._wireEvents();
  }

  get instanceId(): UniqueId {
    return this._instanceId;
  }

  get state(): ConnectionState {
    return this._stateMachine.state;
  }

  get stateMachine(): ConnectionStateMachine {
    return this._stateMachine;
  }

  get monitor(): ConnectionMonitor {
    return this._monitor;
  }

  get presence(): PresenceManager {
    return this._presence;
  }

  get offlineQueue(): OfflineQueue {
    return this._offlineQueue;
  }

  get metrics(): ConnectionMetrics {
    return this._metrics;
  }

  get autoRecovery(): AutoRecovery {
    return this._autoRecovery;
  }

  bindProvider(provider: IProvider): void {
    this._provider = provider;
    this._presence.bindProvider(provider);
    this._autoRecovery.bindProvider(provider);
  }

  unbindProvider(): void {
    this._presence.unbindProvider();
    this._autoRecovery.unbindProvider();
    this._provider = null;
  }

  async connect(): Promise<boolean> {
    if (this.state === 'connected' || this.state === 'connecting') {
      this._logger.debug(
        `[ConnectionManager] Already connected/connecting`,
        { instanceId: this._instanceId, state: this.state },
      );
      return false;
    }

    if (!this._provider) {
      this._logger.error(
        `[ConnectionManager] No provider bound`,
        undefined,
        { instanceId: this._instanceId },
      );
      return false;
    }

    if (!this._stateMachine.transition('connecting', 'manager.connect')) {
      return false;
    }

    this._metrics.recordConnect();

    this.emit('attemptStarted', createConnectionEvent('connection.attempt_started', this._instanceId, {
      state: this.state,
    }));

    try {
      const result = await this._provider.connect();

      if (result.status === 'CONNECTED' as any) {
        this._stateMachine.transition('connected', 'manager.connect.success');
        this._metrics.recordConnect();
        this._monitor.start();
        await this._presence.setAvailable();
        this._flushOfflineQueue();

        this.emit('established', createConnectionEvent('connection.established', this._instanceId, {
          connectedAt: new Date().toISOString(),
        }));

        this._logger.info(
          `[ConnectionManager] Connected`,
          { instanceId: this._instanceId },
        );

        return true;
      } else {
        this._stateMachine.transition('failed', 'manager.connect.failed');
        this._metrics.recordDisconnect();

        this.emit('attemptFailed', createConnectionEvent('connection.attempt_failed', this._instanceId, {
          status: result.status,
        }));

        return false;
      }
    } catch (error) {
      this._stateMachine.transition('failed', 'manager.connect.error');
      this._metrics.recordDisconnect();

      this.emit('attemptFailed', createConnectionEvent('connection.attempt_failed', this._instanceId, {
        error: (error as Error).message,
      }));

      this._logger.error(
        `[ConnectionManager] Connect failed`,
        error as Error,
        { instanceId: this._instanceId },
      );

      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.state === 'disconnected' || this.state === 'destroyed') {
      return;
    }

    this._autoRecovery.abort();
    this._monitor.stop();
    this._presence.reset();

    if (this._provider) {
      try {
        await this._provider.logout();
      } catch (error) {
        this._logger.warn(
          `[ConnectionManager] Logout error`,
          { instanceId: this._instanceId, error: (error as Error).message },
        );
      }
    }

    this._stateMachine.transition('disconnected', 'manager.disconnect');
    this._metrics.recordDisconnect();

    this.emit('lost', createConnectionEvent('connection.lost', this._instanceId, {
      reason: 'manual_disconnect',
    }));

    this._logger.info(
      `[ConnectionManager] Disconnected`,
      { instanceId: this._instanceId },
    );
  }

  async destroy(): Promise<void> {
    this._autoRecovery.abort();
    this._monitor.stop();
    this._presence.reset();
    this._offlineQueue.clear();

    if (this._provider) {
      try {
        await this._provider.logout();
      } catch {
        // logout may fail if already disconnected — safe to ignore
      }
      this._provider = null;
    }

    this._presence.unbindProvider();
    this._autoRecovery.unbindProvider();
    this._stateMachine.transition('destroyed', 'manager.destroy');

    this.emit('destroyed', createConnectionEvent('connection.destroyed', this._instanceId, {}));

    this._logger.info(
      `[ConnectionManager] Destroyed`,
      { instanceId: this._instanceId },
    );
  }

  async reconnect(): Promise<boolean> {
    if (this.state === 'destroyed') return false;

    this._autoRecovery.abort();

    if (!this._provider) {
      this._logger.error(
        `[ConnectionManager] No provider for reconnect`,
        undefined,
        { instanceId: this._instanceId },
      );
      return false;
    }

    this._metrics.recordReconnect();
    return this._autoRecovery.triggerRecovery('manual_reconnect');
  }

  queueMessage(payload: unknown, priority?: number, metadata?: Record<string, unknown>): QueuedMessage | null {
    if (this.state === 'connected') {
      return null;
    }
    return this._offlineQueue.enqueue(payload, priority, metadata);
  }

  getMetrics(): ConnectionMetricsData {
    return this._metrics.getMetrics();
  }

  onConnectionEvent(handler: ConnectionEventHandler): void {
    this.on('connectionEvent', handler);
  }

  onStateChanged(handler: (state: ConnectionState) => void): void {
    this.on('stateChangedInternal', handler);
  }

  private _wireEvents(): void {
    this._stateMachine.on('stateChanged', (event: any) => {
      this._metrics.updateState(event.metadata?.to as ConnectionState);
      this.emit('stateChangedInternal', event.metadata?.to);
      this._forwardEvent(event);
    });

    this._monitor.on('checked', (event: any) => this._forwardEvent(event));
    this._monitor.on('degraded', (event: any) => this._forwardEvent(event));
    this._monitor.on('unhealthy', (event: any) => this._forwardEvent(event));
    this._monitor.heartbeat.on('tick', (event: any) => this._forwardEvent(event));
    this._monitor.heartbeat.on('missed', (event: any) => this._forwardEvent(event));
    this._monitor.heartbeat.on('failed', (event: any) => this._forwardEvent(event));

    this._presence.on('available', (event: any) => this._forwardEvent(event));
    this._presence.on('unavailable', (event: any) => this._forwardEvent(event));
    this._presence.on('updated', (event: any) => this._forwardEvent(event));

    this._offlineQueue.on('enqueued', (event: any) => this._forwardEvent(event));
    this._offlineQueue.on('flushed', (event: any) => this._forwardEvent(event));
    this._offlineQueue.on('dropped', (event: any) => this._forwardEvent(event));

    this._autoRecovery.on('started', (event: any) => this._forwardEvent(event));
    this._autoRecovery.on('succeeded', (event: any) => this._forwardEvent(event));
    this._autoRecovery.on('failed', (event: any) => this._forwardEvent(event));
    this._autoRecovery.on('aborted', (event: any) => this._forwardEvent(event));
    this._autoRecovery.reconnectStrategy.on('backoffApplied', (event: any) => this._forwardEvent(event));
    this._autoRecovery.reconnectStrategy.on('maxRetries', (event: any) => this._forwardEvent(event));
  }

  private _forwardEvent(event: ConnectionEvent): void {
    this.emit('connectionEvent', event);
  }

  private _flushOfflineQueue(): void {
    const messages = this._offlineQueue.drain();
    if (messages.length > 0) {
      this._logger.info(
        `[ConnectionManager] Flushing ${messages.length} queued messages`,
        { instanceId: this._instanceId },
      );

      for (const msg of messages) {
        this.emit('queue.processed', createConnectionEvent('connection.queue.processed', this._instanceId, {
          messageId: msg.id,
          payload: msg.payload,
        }));
      }
    }
  }
}
