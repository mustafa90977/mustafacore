import { DomainEvent, UniqueId, createDomainEvent } from '@wacore/shared';
import { OrderStatus } from '../enums/order-status';
import { PaymentStatus } from '../enums/payment-status';

export interface OrderCreatedPayload {
  orderId: UniqueId;
  orderNumber: string;
  storeId: UniqueId;
  customerId: UniqueId;
  items: Array<{ productId: UniqueId; quantity: number }>;
  total: number;
  currency: string;
}

export interface OrderStatusChangedPayload {
  orderId: UniqueId;
  orderNumber: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
}

export interface OrderPaymentUpdatedPayload {
  orderId: UniqueId;
  orderNumber: string;
  previousStatus: PaymentStatus;
  newStatus: PaymentStatus;
}

export interface OrderCancelledPayload {
  orderId: UniqueId;
  orderNumber: string;
  reason?: string;
}

export function createOrderCreatedEvent(
  aggregateId: UniqueId,
  payload: OrderCreatedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'ORDER_CREATED',
    aggregateType: 'Order',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createOrderStatusChangedEvent(
  aggregateId: UniqueId,
  payload: OrderStatusChangedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'ORDER_STATUS_CHANGED',
    aggregateType: 'Order',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createOrderPaymentUpdatedEvent(
  aggregateId: UniqueId,
  payload: OrderPaymentUpdatedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'ORDER_PAYMENT_UPDATED',
    aggregateType: 'Order',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createOrderCancelledEvent(
  aggregateId: UniqueId,
  payload: OrderCancelledPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'ORDER_CANCELLED',
    aggregateType: 'Order',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}
