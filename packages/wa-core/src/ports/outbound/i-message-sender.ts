import { UniqueId } from '@wacore/shared';
import { MessageType } from '../../domain/enums/message-type';
import { MessageContent } from '../../infrastructure/providers/interfaces/i-provider';

export interface ISendMessageCommand {
  instanceId: UniqueId;
  to: string;
  type: MessageType;
  content: MessageContent;
  conversationId?: UniqueId;
  quotedMessageId?: UniqueId;
}

export interface ISendMessageResult {
  success: boolean;
  messageId?: UniqueId;
  externalId?: string;
  error?: string;
  retryable?: boolean;
}

export interface IOutboundMessageSender {
  send(command: ISendMessageCommand): Promise<ISendMessageResult>;
}
