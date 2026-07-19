import { UniqueId } from '@wacore/shared';

export type MessageLifecycleEvent =
  | 'message.inbound.received'
  | 'message.inbound.normalized'
  | 'message.inbound.stored'
  | 'message.inbound.failed'
  | 'message.outbound.requested'
  | 'message.outbound.mapped'
  | 'message.outbound.sending'
  | 'message.outbound.sent'
  | 'message.outbound.failed'
  | 'message.outbound.retry'
  | 'message.status.updated'
  | 'message.status.delivered'
  | 'message.status.read'
  | 'message.status.failed'
  | 'message.media.downloaded'
  | 'message.media.uploaded'
  | 'message.media.failed';

export interface MessageLifecycleEventPayload {
  readonly type: MessageLifecycleEvent;
  readonly instanceId: UniqueId;
  readonly messageId?: UniqueId;
  readonly externalId?: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

export type MessageEventHandler = (event: MessageLifecycleEventPayload) => void | Promise<void>;

export function createMessageLifecycleEvent(
  type: MessageLifecycleEvent,
  instanceId: UniqueId,
  metadata?: Record<string, unknown>,
  messageId?: UniqueId,
  externalId?: string,
): MessageLifecycleEventPayload {
  return {
    type,
    instanceId,
    messageId,
    externalId,
    timestamp: new Date(),
    metadata,
  };
}
