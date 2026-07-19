import { UniqueId } from '@wacore/shared';
import { ProviderType } from '../../../domain/enums/provider-type';
import { ConnectionStatus } from '../../../domain/enums/connection-status';

export interface ProviderHealth {
  instanceId: UniqueId;
  providerType: ProviderType;
  status: ConnectionStatus;
  connectedAt?: Date;
  lastActivity?: Date;
  latency?: number;
  errorCount: number;
  lastError?: string;
  uptime?: number;
}
