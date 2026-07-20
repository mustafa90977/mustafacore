export type { MessageLifecycleEvent } from './message-events';
export { createMessageLifecycleEvent } from './message-events';
export type { MessageLifecycleEventPayload, MessageEventHandler } from './message-events';

export { MessageNormalizer } from './message-normalizer';
export type { NormalizedMessage, MessageExtensions } from './message-normalizer';

export { MediaNormalizer } from './media-normalizer';
export type { NormalizedMedia, NormalizedMediaForUpload } from './media-normalizer';

export { MessageMapper } from './message-mapper';

export { InboundMessageHandler } from './inbound-message-handler';
export type { InboundMessageHandlerConfig } from './inbound-message-handler';

export { OutboundMessageHandler } from './outbound-message-handler';
export type { OutboundMessageHandlerConfig } from './outbound-message-handler';

export { MessageRepositoryIntegration } from './message-repository-integration';
export type { MessageRepositoryIntegrationConfig, IMessagePersistenceAdapter } from './message-repository-integration';
