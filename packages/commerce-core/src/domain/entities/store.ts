import { AggregateRoot, BaseEntityProps, UniqueId, generateId } from '@wacore/shared';

export interface StoreProps extends BaseEntityProps {
  workspaceId: UniqueId;
  name: string;
  description?: string;
  phoneNumber: string;
  catalogUrl?: string;
  currency: string;
  isActive: boolean;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class Store extends AggregateRoot<StoreProps> {
  private constructor(props: StoreProps) {
    super(props);
  }

  static create(props: {
    workspaceId: UniqueId;
    name: string;
    description?: string;
    phoneNumber: string;
    catalogUrl?: string;
    currency: string;
  }): Store {
    return new Store({
      id: generateId(),
      workspaceId: props.workspaceId,
      name: props.name,
      description: props.description,
      phoneNumber: props.phoneNumber,
      catalogUrl: props.catalogUrl,
      currency: props.currency,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: StoreProps): Store {
    return new Store(props);
  }

  get workspaceId(): UniqueId {
    return this.props.workspaceId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get phoneNumber(): string {
    return this.props.phoneNumber;
  }

  get catalogUrl(): string | undefined {
    return this.props.catalogUrl;
  }

  get currency(): string {
    return this.props.currency;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get settings(): Record<string, unknown> | undefined {
    return this.props.settings;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  activate(): void {
    this.props.isActive = true;
    this.touch();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.touch();
  }

  updateSettings(settings: Record<string, unknown>): void {
    this.props.settings = { ...this.props.settings, ...settings };
    this.touch();
  }

  protected toProps(): StoreProps {
    return {
      id: this.id,
      workspaceId: this.props.workspaceId,
      name: this.props.name,
      description: this.props.description,
      phoneNumber: this.props.phoneNumber,
      catalogUrl: this.props.catalogUrl,
      currency: this.props.currency,
      isActive: this.props.isActive,
      settings: this.props.settings,
      metadata: this.props.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
