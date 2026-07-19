import { AggregateRoot, BaseEntityProps, UniqueId, generateId } from '@wacore/shared';
import { OrderStatus } from '../enums/order-status';
import { PaymentStatus } from '../enums/payment-status';
import { FulfillmentStatus } from '../enums/fulfillment-status';
import { Money } from '../value-objects/money';
import { Address } from '../value-objects/address';
import { OrderNumber } from '../value-objects/order-number';
import { OrderItem } from './order-item';

export interface OrderProps extends BaseEntityProps {
  storeId: UniqueId;
  customerId: UniqueId;
  conversationId?: UniqueId;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotal: Money;
  tax: Money;
  shipping: Money;
  discount: Money;
  total: Money;
  currency: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  metadata?: Record<string, unknown>;
  items: OrderItem[];
}

export class Order extends AggregateRoot<OrderProps> {
  private constructor(props: OrderProps) {
    super(props);
  }

  static create(props: {
    storeId: UniqueId;
    customerId: UniqueId;
    conversationId?: UniqueId;
    storeCode: string;
    currency: string;
  }): Order {
    const orderNumber = OrderNumber.create(props.storeCode, Math.floor(Math.random() * 10000));
    return new Order({
      id: generateId(),
      storeId: props.storeId,
      customerId: props.customerId,
      conversationId: props.conversationId,
      orderNumber: orderNumber.value,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
      subtotal: Money.zero(props.currency),
      tax: Money.zero(props.currency),
      shipping: Money.zero(props.currency),
      discount: Money.zero(props.currency),
      total: Money.zero(props.currency),
      currency: props.currency,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }

  get storeId(): UniqueId {
    return this.props.storeId;
  }

  get customerId(): UniqueId {
    return this.props.customerId;
  }

  get conversationId(): UniqueId | undefined {
    return this.props.conversationId;
  }

  get orderNumber(): string {
    return this.props.orderNumber;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get paymentStatus(): PaymentStatus {
    return this.props.paymentStatus;
  }

  get fulfillmentStatus(): FulfillmentStatus {
    return this.props.fulfillmentStatus;
  }

  get subtotal(): Money {
    return this.props.subtotal;
  }

  get tax(): Money {
    return this.props.tax;
  }

  get shipping(): Money {
    return this.props.shipping;
  }

  get discount(): Money {
    return this.props.discount;
  }

  get total(): Money {
    return this.props.total;
  }

  get currency(): string {
    return this.props.currency;
  }

  get shippingAddress(): Address | undefined {
    return this.props.shippingAddress;
  }

  get billingAddress(): Address | undefined {
    return this.props.billingAddress;
  }

  get notes(): string | undefined {
    return this.props.notes;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get items(): OrderItem[] {
    return this.props.items;
  }

  get itemCount(): number {
    return this.props.items.length;
  }

  addItem(item: OrderItem): void {
    this.props.items.push(item);
    this.recalculateTotals();
    this.touch();
  }

  removeItem(itemId: UniqueId): void {
    this.props.items = this.props.items.filter((i) => i.id !== itemId);
    this.recalculateTotals();
    this.touch();
  }

  updateItemQuantity(itemId: UniqueId, quantity: number): void {
    const item = this.props.items.find((i) => i.id === itemId);
    if (item) {
      item.updateQuantity(quantity);
      this.recalculateTotals();
      this.touch();
    }
  }

  setShippingAddress(address: Address): void {
    this.props.shippingAddress = address;
    this.touch();
  }

  setBillingAddress(address: Address): void {
    this.props.billingAddress = address;
    this.touch();
  }

  setTax(tax: Money): void {
    this.props.tax = tax;
    this.recalculateTotal();
    this.touch();
  }

  setShipping(shipping: Money): void {
    this.props.shipping = shipping;
    this.recalculateTotal();
    this.touch();
  }

  setDiscount(discount: Money): void {
    this.props.discount = discount;
    this.recalculateTotal();
    this.touch();
  }

  confirm(): void {
    this.props.status = OrderStatus.CONFIRMED;
    this.touch();
  }

  process(): void {
    this.props.status = OrderStatus.PROCESSING;
    this.touch();
  }

  ship(): void {
    this.props.status = OrderStatus.SHIPPED;
    this.props.fulfillmentStatus = FulfillmentStatus.FULFILLED;
    this.touch();
  }

  deliver(): void {
    this.props.status = OrderStatus.DELIVERED;
    this.props.fulfillmentStatus = FulfillmentStatus.DELIVERED;
    this.touch();
  }

  complete(): void {
    this.props.status = OrderStatus.COMPLETED;
    this.touch();
  }

  cancel(): void {
    this.props.status = OrderStatus.CANCELLED;
    this.touch();
  }

  updatePaymentStatus(status: PaymentStatus): void {
    this.props.paymentStatus = status;
    this.touch();
  }

  updateNotes(notes: string): void {
    this.props.notes = notes;
    this.touch();
  }

  private recalculateTotals(): void {
    this.props.subtotal = this.calculateSubtotal();
    this.recalculateTotal();
  }

  private recalculateTotal(): void {
    this.props.total = this.props.subtotal
      .add(this.props.tax)
      .add(this.props.shipping)
      .subtract(this.props.discount);
  }

  private calculateSubtotal(): Money {
    if (this.props.items.length === 0) {
      return Money.zero(this.props.currency);
    }
    return this.props.items.reduce(
      (sum, item) => sum.add(item.total),
      Money.zero(this.props.currency),
    );
  }

  protected toProps(): OrderProps {
    return {
      id: this.id,
      storeId: this.props.storeId,
      customerId: this.props.customerId,
      conversationId: this.props.conversationId,
      orderNumber: this.props.orderNumber,
      status: this.props.status,
      paymentStatus: this.props.paymentStatus,
      fulfillmentStatus: this.props.fulfillmentStatus,
      subtotal: this.props.subtotal,
      tax: this.props.tax,
      shipping: this.props.shipping,
      discount: this.props.discount,
      total: this.props.total,
      currency: this.props.currency,
      shippingAddress: this.props.shippingAddress,
      billingAddress: this.props.billingAddress,
      notes: this.props.notes,
      metadata: this.props.metadata,
      items: this.props.items.map((item) => item),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
