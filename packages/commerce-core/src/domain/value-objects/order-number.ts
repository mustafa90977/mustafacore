import { ValueObject } from '@wacore/shared';

export interface OrderNumberProps {
  value: string;
}

export class OrderNumber extends ValueObject<OrderNumberProps> {
  private static readonly PATTERN = /^[A-Z0-9]{2,10}-\d{8}-\d{4}$/;

  private constructor(props: OrderNumberProps) {
    super(props);
  }

  static create(storeCode: string, sequence: number): OrderNumber {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const seqStr = sequence.toString().padStart(4, '0');
    const value = `${storeCode.toUpperCase()}-${dateStr}-${seqStr}`;
    return new OrderNumber({ value });
  }

  static reconstitute(value: string): OrderNumber {
    if (!OrderNumber.PATTERN.test(value)) {
      throw new Error(`Invalid order number format: ${value}`);
    }
    return new OrderNumber({ value });
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
