import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { IProvider, PresenceType } from '@wacore/wa-core';
import { ConnectionStateMachine } from './connection-state-machine';
import { createConnectionEvent } from './connection-events';

export type PresenceStatus = 'available' | 'unavailable' | 'composing' | 'recording' | 'paused';

export interface PresenceInfo {
  readonly instanceId: UniqueId;
  readonly status: PresenceStatus;
  readonly lastUpdated: Date;
  readonly jid?: string;
}

export class PresenceManager extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _stateMachine: ConnectionStateMachine;
  private _provider: IProvider | null;
  private _currentStatus: PresenceStatus;
  private _lastUpdated: Date | null;
  private _presenceMap: Map<string, PresenceStatus>;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    stateMachine: ConnectionStateMachine,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._stateMachine = stateMachine;
    this._provider = null;
    this._currentStatus = 'unavailable';
    this._lastUpdated = null;
    this._presenceMap = new Map();
  }

  get currentStatus(): PresenceStatus {
    return this._currentStatus;
  }

  get lastUpdated(): Date | null {
    return this._lastUpdated;
  }

  bindProvider(provider: IProvider): void {
    this._provider = provider;
  }

  unbindProvider(): void {
    this._provider = null;
  }

  async setAvailable(): Promise<void> {
    await this._updatePresence('available');
  }

  async setUnavailable(): Promise<void> {
    await this._updatePresence('unavailable');
  }

  async markComposing(jid?: string): Promise<void> {
    await this._updatePresence('composing', jid);
  }

  async markRecording(jid?: string): Promise<void> {
    await this._updatePresence('recording', jid);
  }

  async markPaused(jid?: string): Promise<void> {
    await this._updatePresence('paused', jid);
  }

  getPresence(jid: string): PresenceStatus | undefined {
    return this._presenceMap.get(jid);
  }

  updateRemotePresence(jid: string, status: PresenceStatus): void {
    const previous = this._presenceMap.get(jid);
    this._presenceMap.set(jid, status);

    if (previous !== status) {
      this.emit('updated', createConnectionEvent('connection.presence.updated', this._instanceId, {
        jid,
        status,
        previous,
      }));
    }
  }

  reset(): void {
    this._currentStatus = 'unavailable';
    this._lastUpdated = null;
    this._presenceMap.clear();
  }

  private async _updatePresence(status: PresenceStatus, jid?: string): Promise<void> {
    if (this._stateMachine.state !== 'connected') {
      this._logger.debug(
        `[PresenceManager] Cannot update: not connected`,
        { instanceId: this._instanceId, requestedStatus: status },
      );
      return;
    }

    if (!this._provider) {
      this._logger.warn(
        `[PresenceManager] No provider bound`,
        { instanceId: this._instanceId },
      );
      return;
    }

    try {
      const mappedType = this._mapStatusToType(status);
      await this._provider.sendPresenceUpdate(mappedType, jid ?? '');

      const previous = this._currentStatus;
      this._currentStatus = status;
      this._lastUpdated = new Date();

      if (status === 'available') {
        this.emit('available', createConnectionEvent('connection.presence.available', this._instanceId, {
          previous,
        }));
      } else if (status === 'unavailable') {
        this.emit('unavailable', createConnectionEvent('connection.presence.unavailable', this._instanceId, {
          previous,
        }));
      }

      this.emit('updated', createConnectionEvent('connection.presence.updated', this._instanceId, {
        status,
        previous,
        jid,
      }));
    } catch (error) {
      this._logger.error(
        `[PresenceManager] Failed to update presence`,
        error as Error,
        { instanceId: this._instanceId, status },
      );
    }
  }

  private _mapStatusToType(status: PresenceStatus): PresenceType {
    switch (status) {
      case 'available': return 'available';
      case 'unavailable': return 'unavailable';
      case 'composing': return 'composing';
      case 'recording': return 'recording';
      case 'paused': return 'paused';
    }
  }
}
