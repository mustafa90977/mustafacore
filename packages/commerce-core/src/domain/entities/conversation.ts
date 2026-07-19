import { AggregateRoot, BaseEntityProps, UniqueId, generateId } from '@wacore/shared';
import { ConversationStatus } from '../enums/conversation-status';
import { ConversationPriority } from '../enums/conversation-priority';

export interface ConversationProps extends BaseEntityProps {
  instanceId: UniqueId;
  customerId: UniqueId;
  storeId: UniqueId;
  status: ConversationStatus;
  priority: ConversationPriority;
  assigneeId?: UniqueId;
  tags: string[];
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  unreadCount: number;
  metadata?: Record<string, unknown>;
}

export class Conversation extends AggregateRoot<ConversationProps> {
  private static readonly AUTO_CLOSE_DAYS = 30;

  private constructor(props: ConversationProps) {
    super(props);
  }

  static create(props: {
    instanceId: UniqueId;
    customerId: UniqueId;
    storeId: UniqueId;
  }): Conversation {
    return new Conversation({
      id: generateId(),
      instanceId: props.instanceId,
      customerId: props.customerId,
      storeId: props.storeId,
      status: ConversationStatus.ACTIVE,
      priority: ConversationPriority.NORMAL,
      tags: [],
      unreadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: ConversationProps): Conversation {
    return new Conversation(props);
  }

  get instanceId(): UniqueId {
    return this.props.instanceId;
  }

  get customerId(): UniqueId {
    return this.props.customerId;
  }

  get storeId(): UniqueId {
    return this.props.storeId;
  }

  get status(): ConversationStatus {
    return this.props.status;
  }

  get priority(): ConversationPriority {
    return this.props.priority;
  }

  get assigneeId(): UniqueId | undefined {
    return this.props.assigneeId;
  }

  get tags(): string[] {
    return this.props.tags;
  }

  get lastMessageAt(): Date | undefined {
    return this.props.lastMessageAt;
  }

  get lastMessagePreview(): string | undefined {
    return this.props.lastMessagePreview;
  }

  get unreadCount(): number {
    return this.props.unreadCount;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get isActive(): boolean {
    return this.props.status === ConversationStatus.ACTIVE;
  }

  get shouldAutoClose(): boolean {
    if (!this.props.lastMessageAt) return false;
    const daysSinceLastMessage = Math.floor(
      (Date.now() - this.props.lastMessageAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysSinceLastMessage >= Conversation.AUTO_CLOSE_DAYS;
  }

  updateStatus(status: ConversationStatus): void {
    this.props.status = status;
    this.touch();
  }

  setPriority(priority: ConversationPriority): void {
    this.props.priority = priority;
    this.touch();
  }

  assign(assigneeId: UniqueId): void {
    this.props.assigneeId = assigneeId;
    this.touch();
  }

  unassign(): void {
    this.props.assigneeId = undefined;
    this.touch();
  }

  addTag(tag: string): void {
    if (!this.props.tags.includes(tag)) {
      this.props.tags.push(tag);
      this.touch();
    }
  }

  removeTag(tag: string): void {
    const index = this.props.tags.indexOf(tag);
    if (index > -1) {
      this.props.tags.splice(index, 1);
      this.touch();
    }
  }

  recordMessage(preview: string): void {
    this.props.lastMessageAt = new Date();
    this.props.lastMessagePreview = preview.slice(0, 100);
    this.props.unreadCount++;
    this.touch();
  }

  markRead(): void {
    this.props.unreadCount = 0;
    this.touch();
  }

  resolve(): void {
    this.props.status = ConversationStatus.RESOLVED;
    this.touch();
  }

  close(): void {
    this.props.status = ConversationStatus.CLOSED;
    this.props.unreadCount = 0;
    this.touch();
  }

  reopen(): void {
    this.props.status = ConversationStatus.ACTIVE;
    this.touch();
  }

  protected toProps(): ConversationProps {
    return {
      id: this.id,
      instanceId: this.props.instanceId,
      customerId: this.props.customerId,
      storeId: this.props.storeId,
      status: this.props.status,
      priority: this.props.priority,
      assigneeId: this.props.assigneeId,
      tags: [...this.props.tags],
      lastMessageAt: this.props.lastMessageAt,
      lastMessagePreview: this.props.lastMessagePreview,
      unreadCount: this.props.unreadCount,
      metadata: this.props.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
