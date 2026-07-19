import { AggregateRoot, BaseEntityProps, UniqueId, generateId } from '@wacore/shared';
import { Money } from '../value-objects/money';

export interface OrderItemProps extends BaseEntityProps {
  orderId: UniqueId;
  productId: UniqueId;
  quantity: number;
  unitPrice: Money;
  total: Money;
  productName: string;
  productSku?: string;
  metadata?: Record<string, unknown>;
}

export class OrderItem extends AggregateRoot<OrderItemProps> {
  private constructor(props: OrderItemProps) {
    super(props);
  }

  static create(props: {
    orderId: UniqueId;
    productId: UniqueId;
    quantity: number;
    unitPrice: Money;
    productName: string;
    productSku?: string;
  }): OrderItem {
    const total = props.unitPrice.multiply(props.quantity);
    return new OrderItem({
      id: generateId(),
      orderId: props.orderId,
      productId: props.productId,
      quantity: props.quantity,
      unitPrice: props.unitPrice,
      total,
      productName: props.productName,
      productSku: props.productSku,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: OrderItemProps): OrderItem {
    return new OrderItem(props);
  }

  get orderId(): UniqueId {
    return this.props.orderId;
  }

  get productId(): UniqueId {
    return this.props.productId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get unitPrice(): Money {
    return this.props.unitPrice;
  }

  get total(): Money {
    return this.props.total;
  }

  get productName(): string {
    return this.props.productName;
  }

  get productSku(): string | undefined {
    return this.props.productSku;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  updateQuantity(quantity: number): void {
    this.props.quantity = quantity;
    this.props.total = this.props.unitPrice.multiply(quantity);
    this.touch();
  }

  protected toProps(): OrderItemProps {
    return {
      id: this.id,
      orderId: this.props.orderId,
      productId: this.props.productId,
      quantity: this.props.quantity,
      unitPrice: this.props.unitPrice,
      total: this.props.total,
      productName: this.props.productName,
      productSku: this.props.productSku,
      metadata: this.props.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
