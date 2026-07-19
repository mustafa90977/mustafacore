import { ProviderType } from '../../../domain/enums/provider-type';

export interface ProviderCapabilities {
  providerType: ProviderType;
  features: ProviderFeatures;
  limits: ProviderLimits;
}

export interface ProviderFeatures {
  text: boolean;
  media: boolean;
  location: boolean;
  contacts: boolean;
  reactions: boolean;
  replies: boolean;
  groups: boolean;
  presence: boolean;
  readReceipts: boolean;
  qrCode: boolean;
  pairingCode: boolean;
}

export interface ProviderLimits {
  maxMessageLength: number;
  maxMediaSize: number;
  supportedMimeTypes: string[];
  maxGroupSize: number;
  maxBroadcastSize: number;
  rateLimit: RateLimit;
}

export interface RateLimit {
  messagesPerSecond: number;
  messagesPerMinute: number;
  messagesPerHour: number;
}
