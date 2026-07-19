import { AggregateRoot, BaseEntityProps, UniqueId, generateId } from '@wacore/shared';
import { Money } from '../value-objects/money';

export interface CustomerProps extends BaseEntityProps {
  workspaceId: UniqueId;
  phoneNumber: string;
  name?: string;
  pushName?: string;
  profilePictureUrl?: string;
  isBusiness: boolean;
  businessName?: string;
  tags: string[];
  notes?: string;
  totalOrders: number;
  totalSpent: Money;
  lastInteractionAt?: Date;
  metadata?: Record<string, unknown>;
}

export class Customer extends AggregateRoot<CustomerProps> {
  private constructor(props: CustomerProps) {
    super(props);
  }

  static create(props: {
    workspaceId: UniqueId;
    phoneNumber: string;
    name?: string;
    pushName?: string;
    profilePictureUrl?: string;
    isBusiness?: boolean;
    businessName?: string;
  }): Customer {
    return new Customer({
      id: generateId(),
      workspaceId: props.workspaceId,
      phoneNumber: props.phoneNumber,
      name: props.name,
      pushName: props.pushName,
      profilePictureUrl: props.profilePictureUrl,
      isBusiness: props.isBusiness ?? false,
      businessName: props.businessName,
      tags: [],
      totalOrders: 0,
      totalSpent: Money.zero('USD'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: CustomerProps): Customer {
    return new Customer(props);
  }

  get workspaceId(): UniqueId {
    return this.props.workspaceId;
  }

  get phoneNumber(): string {
    return this.props.phoneNumber;
  }

  get name(): string | undefined {
    return this.props.name;
  }

  get pushName(): string | undefined {
    return this.props.pushName;
  }

  get profilePictureUrl(): string | undefined {
    return this.props.profilePictureUrl;
  }

  get isBusiness(): boolean {
    return this.props.isBusiness;
  }

  get businessName(): string | undefined {
    return this.props.businessName;
  }

  get tags(): string[] {
    return this.props.tags;
  }

  get notes(): string | undefined {
    return this.props.notes;
  }

  get totalOrders(): number {
    return this.props.totalOrders;
  }

  get totalSpent(): Money {
    return this.props.totalSpent;
  }

  get lastInteractionAt(): Date | undefined {
    return this.props.lastInteractionAt;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  updateName(name: string): void {
    this.props.name = name;
    this.touch();
  }

  updatePushName(pushName: string): void {
    this.props.pushName = pushName;
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

  updateNotes(notes: string): void {
    this.props.notes = notes;
    this.touch();
  }

  recordOrder(amount: Money): void {
    this.props.totalOrders++;
    this.props.totalSpent = this.props.totalSpent.add(amount);
    this.props.lastInteractionAt = new Date();
    this.touch();
  }

  updateLastInteraction(): void {
    this.props.lastInteractionAt = new Date();
    this.touch();
  }

  protected toProps(): CustomerProps {
    return {
      id: this.id,
      workspaceId: this.props.workspaceId,
      phoneNumber: this.props.phoneNumber,
      name: this.props.name,
      pushName: this.props.pushName,
      profilePictureUrl: this.props.profilePictureUrl,
      isBusiness: this.props.isBusiness,
      businessName: this.props.businessName,
      tags: [...this.props.tags],
      notes: this.props.notes,
      totalOrders: this.props.totalOrders,
      totalSpent: this.props.totalSpent,
      lastInteractionAt: this.props.lastInteractionAt,
      metadata: this.props.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
