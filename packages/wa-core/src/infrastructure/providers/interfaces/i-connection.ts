import { UniqueId } from '@wacore/shared';
import { ConnectionStatus } from '../../../domain/enums/connection-status';

export interface IConnection {
  readonly instanceId: UniqueId;

  getStatus(): ConnectionStatus;
  isConnected(): boolean;
  getLatency(): number;
  getLastActivity(): Date;
  getConnectionInfo(): ConnectionInfo;

  onStatusChange(callback: (status: ConnectionStatus) => void): void;
  onError(callback: (error: Error) => void): void;
}

export interface ConnectionInfo {
  instanceId: UniqueId;
  status: ConnectionStatus;
  connectedAt?: Date;
  lastActivity?: Date;
  latency?: number;
  reconnectAttempts: number;
}
