import { ValueObject } from '@wacore/shared';

export interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  static create(amount: number, currency: string): Money {
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    return new Money({ amount, currency });
  }

  static zero(currency: string): Money {
    return new Money({ amount: 0, currency });
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  add(other: Money): Money {
    if (this.props.currency !== other.props.currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money({
      amount: this.props.amount + other.props.amount,
      currency: this.props.currency,
    });
  }

  subtract(other: Money): Money {
    if (this.props.currency !== other.props.currency) {
      throw new Error('Cannot subtract money with different currencies');
    }
    return new Money({
      amount: this.props.amount - other.props.amount,
      currency: this.props.currency,
    });
  }

  multiply(factor: number): Money {
    return new Money({
      amount: this.props.amount * factor,
      currency: this.props.currency,
    });
  }

  isGreaterThan(other: Money): boolean {
    if (this.props.currency !== other.props.currency) {
      throw new Error('Cannot compare money with different currencies');
    }
    return this.props.amount > other.props.amount;
  }

  isZero(): boolean {
    return this.props.amount === 0;
  }

  toString(): string {
    return `${this.props.currency} ${this.props.amount.toFixed(2)}`;
  }
}
