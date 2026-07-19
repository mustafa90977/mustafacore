import { UniqueId } from '@wacore/shared';
import { IncomingMessageHandler } from './i-webhook-publisher';

export interface IMessageReceiver {
  startListening(instanceId: UniqueId, handler: IncomingMessageHandler): Promise<void>;
  stopListening(instanceId: UniqueId): Promise<void>;
  isListening(instanceId: UniqueId): boolean;
}
