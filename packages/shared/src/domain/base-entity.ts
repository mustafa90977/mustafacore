import { UniqueId, generateId } from '../types/identifier';
import { DomainEvent } from '../events/domain-event';

export interface BaseEntityProps {
  id: UniqueId;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class BaseEntity<TProps extends BaseEntityProps> {
  protected _props: TProps;
  protected _domainEvents: DomainEvent[] = [];

  protected constructor(props: TProps) {
    this._props = {
      ...props,
      id: props.id || generateId(),
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
    };
  }

  protected get props(): TProps {
    return this._props;
  }

  get id(): UniqueId {
    return this._props.id;
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  protected touch(): void {
    this._props.updatedAt = new Date();
  }

  public equals(other: BaseEntity<TProps>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return this.id === other.id;
  }
}
