import { BaseEntity, BaseEntityProps } from './base-entity';
import { DomainEvent } from '../events/domain-event';

export abstract class AggregateRoot<TProps extends BaseEntityProps> extends BaseEntity<TProps> {
  private _version: number = 0;

  protected constructor(props: TProps) {
    super(props);
  }

  get version(): number {
    return this._version;
  }

  protected override addDomainEvent(event: DomainEvent): void {
    super.addDomainEvent(event);
    this._version++;
    this.touch();
  }

  public override clearDomainEvents(): DomainEvent[] {
    const events = super.clearDomainEvents();
    return events;
  }

  public toSnapshot(): TProps & { version: number } {
    return {
      ...this.toProps(),
      version: this._version,
    };
  }

  protected abstract toProps(): TProps;
}
