import { UniqueId } from '@wacore/shared';

export interface ProviderMetrics {
  instanceId: UniqueId;
  messagesSent: number;
  messagesReceived: number;
  messagesFailed: number;
  averageLatency: number;
  uptime: number;
  lastActivity?: Date;
  errorRate: number;
}

export interface IProviderMetricsCollector {
  recordMessageSent(instanceId: UniqueId): void;
  recordMessageReceived(instanceId: UniqueId): void;
  recordMessageFailed(instanceId: UniqueId): void;
  recordLatency(instanceId: UniqueId, latencyMs: number): void;
  getMetrics(instanceId: UniqueId): ProviderMetrics;
  resetMetrics(instanceId: UniqueId): void;
}
