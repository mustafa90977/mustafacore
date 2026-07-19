import { UniqueId } from '@wacore/shared';
import { ConnectionState } from './connection-events';

export interface ConnectionMetricsData {
  readonly instanceId: UniqueId;
  readonly state: ConnectionState;
  readonly uptime: number;
  readonly totalConnectTime: number;
  readonly totalDisconnectTime: number;
  readonly connectCount: number;
  readonly disconnectCount: number;
  readonly reconnectCount: number;
  readonly failedReconnectCount: number;
  readonly averageLatency: number;
  readonly maxLatency: number;
  readonly minLatency: number;
  readonly lastConnectedAt: Date | null;
  readonly lastDisconnectedAt: Date | null;
  readonly messagesSent: number;
  readonly messagesReceived: number;
  readonly messagesFailed: number;
  readonly averageMessageLatency: number;
  readonly bytesSent: number;
  readonly bytesReceived: number;
}

interface LatencySample {
  value: number;
  timestamp: Date;
}

export class ConnectionMetrics {
  private readonly _instanceId: UniqueId;
  private _state: ConnectionState;
  private _connectedAt: Date | null;
  private _disconnectedAt: Date | null;
  private _totalConnectTimeMs: number;
  private _totalDisconnectTimeMs: number;
  private _connectCount: number;
  private _disconnectCount: number;
  private _reconnectCount: number;
  private _failedReconnectCount: number;
  private _latencySamples: LatencySample[];
  private _maxLatencySamples: number;
  private _messagesSent: number;
  private _messagesReceived: number;
  private _messagesFailed: number;
  private _messageLatencySamples: LatencySample[];
  private _bytesSent: number;
  private _bytesReceived: number;

  constructor(instanceId: UniqueId) {
    this._instanceId = instanceId;
    this._state = 'disconnected';
    this._connectedAt = null;
    this._disconnectedAt = null;
    this._totalConnectTimeMs = 0;
    this._totalDisconnectTimeMs = 0;
    this._connectCount = 0;
    this._disconnectCount = 0;
    this._reconnectCount = 0;
    this._failedReconnectCount = 0;
    this._latencySamples = [];
    this._maxLatencySamples = 100;
    this._messagesSent = 0;
    this._messagesReceived = 0;
    this._messagesFailed = 0;
    this._messageLatencySamples = [];
    this._bytesSent = 0;
    this._bytesReceived = 0;
  }

  recordConnect(): void {
    this._state = 'connected';
    this._connectedAt = new Date();
    this._disconnectedAt = null;
    this._connectCount++;
  }

  recordDisconnect(): void {
    this._state = 'disconnected';
    this._disconnectedAt = new Date();
    if (this._connectedAt) {
      this._totalConnectTimeMs += Date.now() - this._connectedAt.getTime();
    }
    this._connectedAt = null;
    this._disconnectCount++;
  }

  recordReconnect(): void {
    this._reconnectCount++;
  }

  recordFailedReconnect(): void {
    this._failedReconnectCount++;
  }

  recordLatency(ms: number): void {
    this._latencySamples.push({ value: ms, timestamp: new Date() });
    if (this._latencySamples.length > this._maxLatencySamples) {
      this._latencySamples.shift();
    }
  }

  recordMessageSent(bytes: number, latencyMs: number): void {
    this._messagesSent++;
    this._bytesSent += bytes;
    this._messageLatencySamples.push({ value: latencyMs, timestamp: new Date() });
    if (this._messageLatencySamples.length > this._maxLatencySamples) {
      this._messageLatencySamples.shift();
    }
  }

  recordMessageReceived(bytes: number): void {
    this._messagesReceived++;
    this._bytesReceived += bytes;
  }

  recordMessageFailed(): void {
    this._messagesFailed++;
  }

  updateState(state: ConnectionState): void {
    this._state = state;
  }

  getMetrics(): ConnectionMetricsData {
    const uptime = this._connectedAt ? Date.now() - this._connectedAt.getTime() : 0;
    const latencyValues = this._latencySamples.map((s) => s.value);
    const messageLatencyValues = this._messageLatencySamples.map((s) => s.value);

    return {
      instanceId: this._instanceId,
      state: this._state,
      uptime,
      totalConnectTime: this._totalConnectTimeMs + uptime,
      totalDisconnectTime: this._totalDisconnectTimeMs,
      connectCount: this._connectCount,
      disconnectCount: this._disconnectCount,
      reconnectCount: this._reconnectCount,
      failedReconnectCount: this._failedReconnectCount,
      averageLatency: average(latencyValues),
      maxLatency: Math.max(0, ...latencyValues),
      minLatency: latencyValues.length > 0 ? Math.min(...latencyValues) : 0,
      lastConnectedAt: this._connectedAt,
      lastDisconnectedAt: this._disconnectedAt,
      messagesSent: this._messagesSent,
      messagesReceived: this._messagesReceived,
      messagesFailed: this._messagesFailed,
      averageMessageLatency: average(messageLatencyValues),
      bytesSent: this._bytesSent,
      bytesReceived: this._bytesReceived,
    };
  }

  reset(): void {
    this._state = 'disconnected';
    this._connectedAt = null;
    this._disconnectedAt = null;
    this._totalConnectTimeMs = 0;
    this._totalDisconnectTimeMs = 0;
    this._connectCount = 0;
    this._disconnectCount = 0;
    this._reconnectCount = 0;
    this._failedReconnectCount = 0;
    this._latencySamples = [];
    this._messagesSent = 0;
    this._messagesReceived = 0;
    this._messagesFailed = 0;
    this._messageLatencySamples = [];
    this._bytesSent = 0;
    this._bytesReceived = 0;
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
