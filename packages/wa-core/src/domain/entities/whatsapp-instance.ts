import { AggregateRoot, BaseEntityProps, UniqueId, generateId } from '@wacore/shared';
import { InstanceStatus } from '../enums/instance-status';
import { ProviderType } from '../enums/provider-type';

export interface WhatsAppInstanceProps extends BaseEntityProps {
  workspaceId: UniqueId;
  storeId?: UniqueId;
  name: string;
  phoneNumber: string;
  provider: ProviderType;
  status: InstanceStatus;
  lastConnectedAt?: Date;
  lastDisconnectedAt?: Date;
  errorCount: number;
  maxErrors: number;
  lastError?: string;
}

export class WhatsAppInstance extends AggregateRoot<WhatsAppInstanceProps> {
  private constructor(props: WhatsAppInstanceProps) {
    super(props);
  }

  static create(props: {
    workspaceId: UniqueId;
    storeId?: UniqueId;
    name: string;
    phoneNumber: string;
    provider: ProviderType;
  }): WhatsAppInstance {
    return new WhatsAppInstance({
      id: generateId(),
      workspaceId: props.workspaceId,
      storeId: props.storeId,
      name: props.name,
      phoneNumber: props.phoneNumber,
      provider: props.provider,
      status: InstanceStatus.DISCONNECTED,
      errorCount: 0,
      maxErrors: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: WhatsAppInstanceProps): WhatsAppInstance {
    return new WhatsAppInstance(props);
  }

  get workspaceId(): UniqueId {
    return this.props.workspaceId;
  }

  get storeId(): UniqueId | undefined {
    return this.props.storeId;
  }

  get name(): string {
    return this.props.name;
  }

  get phoneNumber(): string {
    return this.props.phoneNumber;
  }

  get provider(): ProviderType {
    return this.props.provider;
  }

  get status(): InstanceStatus {
    return this.props.status;
  }

  get lastConnectedAt(): Date | undefined {
    return this.props.lastConnectedAt;
  }

  get lastDisconnectedAt(): Date | undefined {
    return this.props.lastDisconnectedAt;
  }

  get errorCount(): number {
    return this.props.errorCount;
  }

  get maxErrors(): number {
    return this.props.maxErrors;
  }

  get lastError(): string | undefined {
    return this.props.lastError;
  }

  get isConnected(): boolean {
    return this.props.status === InstanceStatus.CONNECTED;
  }

  get isDisabled(): boolean {
    return this.props.status === InstanceStatus.DISABLED;
  }

  connect(_sessionId: string): void {
    this.props.status = InstanceStatus.CONNECTED;
    this.props.lastConnectedAt = new Date();
    this.props.errorCount = 0;
    this.props.lastError = undefined;
    this.touch();
  }

  disconnect(): void {
    this.props.status = InstanceStatus.DISCONNECTED;
    this.props.lastDisconnectedAt = new Date();
    this.touch();
  }

  setError(error: string): void {
    this.props.errorCount++;
    this.props.lastError = error;
    this.props.status = InstanceStatus.ERROR;
    this.touch();

    if (this.props.errorCount >= this.props.maxErrors) {
      this.props.status = InstanceStatus.DISABLED;
    }
  }

  resetErrors(): void {
    this.props.errorCount = 0;
    this.props.lastError = undefined;
    this.touch();
  }

  disable(): void {
    this.props.status = InstanceStatus.DISABLED;
    this.touch();
  }

  enable(): void {
    this.props.status = InstanceStatus.DISCONNECTED;
    this.props.errorCount = 0;
    this.props.lastError = undefined;
    this.touch();
  }

  protected toProps(): WhatsAppInstanceProps {
    return {
      id: this.id,
      workspaceId: this.props.workspaceId,
      storeId: this.props.storeId,
      name: this.props.name,
      phoneNumber: this.props.phoneNumber,
      provider: this.props.provider,
      status: this.props.status,
      lastConnectedAt: this.props.lastConnectedAt,
      lastDisconnectedAt: this.props.lastDisconnectedAt,
      errorCount: this.props.errorCount,
      maxErrors: this.props.maxErrors,
      lastError: this.props.lastError,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
