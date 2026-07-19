import { UniqueId } from '@wacore/shared';
import { ProviderType } from '../../../domain/enums/provider-type';
import { IProvider } from './i-provider';
import { ProviderCapabilities } from './provider-capabilities';
import { ProviderHealth } from './provider-health';

export interface IProviderRegistry {
  register(instanceId: UniqueId, provider: IProvider): void;
  unregister(instanceId: UniqueId): void;
  getProvider(instanceId: UniqueId): IProvider | null;
  getHealth(instanceId: UniqueId): ProviderHealth | null;
  getCapabilities(providerType: ProviderType): ProviderCapabilities;
  getAllProviders(): Map<UniqueId, IProvider>;
}
