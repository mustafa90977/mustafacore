import { AggregateRoot, BaseEntityProps, UniqueId, generateId } from '@wacore/shared';
import { MessageType } from '../enums/message-type';
import { MessageStatus } from '../enums/message-status';
import { MessageDirection } from '../enums/message-direction';

export interface MessageProps extends BaseEntityProps {
  instanceId: UniqueId;
  externalId?: string;
  conversationId?: UniqueId;
  direction: MessageDirection;
  type: MessageType;
  content: Record<string, unknown>;
  mediaUrl?: string;
  mimeType?: string;
  status: MessageStatus;
  error?: string;
  retryCount: number;
  maxRetries: number;
  quotedMessageId?: UniqueId;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class Message extends AggregateRoot<MessageProps> {
  private constructor(props: MessageProps) {
    super(props);
  }

  static create(props: {
    instanceId: UniqueId;
    direction: MessageDirection;
    type: MessageType;
    content: Record<string, unknown>;
    timestamp: Date;
  }): Message {
    return new Message({
      id: generateId(),
      instanceId: props.instanceId,
      direction: props.direction,
      type: props.type,
      content: props.content,
      status: props.direction === MessageDirection.OUTBOUND ? MessageStatus.PENDING : MessageStatus.DELIVERED,
      retryCount: 0,
      maxRetries: 3,
      timestamp: props.timestamp,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: MessageProps): Message {
    return new Message(props);
  }

  get instanceId(): UniqueId {
    return this.props.instanceId;
  }

  get externalId(): string | undefined {
    return this.props.externalId;
  }

  get conversationId(): UniqueId | undefined {
    return this.props.conversationId;
  }

  get direction(): MessageDirection {
    return this.props.direction;
  }

  get type(): MessageType {
    return this.props.type;
  }

  get content(): Record<string, unknown> {
    return this.props.content;
  }

  get mediaUrl(): string | undefined {
    return this.props.mediaUrl;
  }

  get mimeType(): string | undefined {
    return this.props.mimeType;
  }

  get status(): MessageStatus {
    return this.props.status;
  }

  get error(): string | undefined {
    return this.props.error;
  }

  get retryCount(): number {
    return this.props.retryCount;
  }

  get maxRetries(): number {
    return this.props.maxRetries;
  }

  get quotedMessageId(): UniqueId | undefined {
    return this.props.quotedMessageId;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get isFailed(): boolean {
    return this.props.status === MessageStatus.FAILED;
  }

  get canRetry(): boolean {
    return this.isFailed && this.props.retryCount < this.props.maxRetries;
  }

  setExternalId(externalId: string): void {
    this.props.externalId = externalId;
    this.touch();
  }

  markSending(): void {
    this.props.status = MessageStatus.SENDING;
    this.touch();
  }

  markSent(externalId: string): void {
    this.props.externalId = externalId;
    this.props.status = MessageStatus.SENT;
    this.touch();
  }

  markDelivered(): void {
    this.props.status = MessageStatus.DELIVERED;
    this.touch();
  }

  markRead(): void {
    this.props.status = MessageStatus.READ;
    this.touch();
  }

  markFailed(error: string): void {
    this.props.status = MessageStatus.FAILED;
    this.props.error = error;
    this.touch();
  }

  incrementRetry(): void {
    this.props.retryCount++;
    this.touch();
  }

  setMediaUrl(url: string, mimeType: string): void {
    this.props.mediaUrl = url;
    this.props.mimeType = mimeType;
    this.touch();
  }

  setConversationId(conversationId: UniqueId): void {
    this.props.conversationId = conversationId;
    this.touch();
  }

  protected toProps(): MessageProps {
    return {
      id: this.id,
      instanceId: this.props.instanceId,
      externalId: this.props.externalId,
      conversationId: this.props.conversationId,
      direction: this.props.direction,
      type: this.props.type,
      content: this.props.content,
      mediaUrl: this.props.mediaUrl,
      mimeType: this.props.mimeType,
      status: this.props.status,
      error: this.props.error,
      retryCount: this.props.retryCount,
      maxRetries: this.props.maxRetries,
      quotedMessageId: this.props.quotedMessageId,
      timestamp: this.props.timestamp,
      metadata: this.props.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
