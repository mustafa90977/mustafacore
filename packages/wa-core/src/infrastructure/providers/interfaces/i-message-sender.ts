import { UniqueId } from '@wacore/shared';
import { MessageType } from '../../../domain/enums/message-type';

export interface IMessageSender {
  sendText(instanceId: UniqueId, to: string, text: string): Promise<SentMessage>;
  sendImage(instanceId: UniqueId, to: string, buffer: Buffer, caption?: string): Promise<SentMessage>;
  sendFile(instanceId: UniqueId, to: string, buffer: Buffer, fileName: string): Promise<SentMessage>;
  sendAudio(instanceId: UniqueId, to: string, buffer: Buffer): Promise<SentMessage>;
  sendVideo(instanceId: UniqueId, to: string, buffer: Buffer, caption?: string): Promise<SentMessage>;
  sendLocation(instanceId: UniqueId, to: string, latitude: number, longitude: number, name?: string): Promise<SentMessage>;
  sendContact(instanceId: UniqueId, to: string, name: string, phone: string): Promise<SentMessage>;
}

export interface SentMessage {
  messageId: UniqueId;
  externalId: string;
  timestamp: Date;
  type: MessageType;
}
