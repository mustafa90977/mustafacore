import { UniqueId } from '@wacore/shared';
import { ProviderType } from '../../../domain/enums/provider-type';
import { IProvider } from './i-provider';
import { ProviderCapabilities } from './provider-capabilities';

export interface IProviderFactory {
  createProvider(instanceId: UniqueId, providerType: ProviderType): IProvider;
  getCapabilities(providerType: ProviderType): ProviderCapabilities;
  getSupportedProviders(): ProviderType[];
  isProviderSupported(providerType: ProviderType): boolean;
}
