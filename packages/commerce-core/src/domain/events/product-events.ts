import { DomainEvent, UniqueId, createDomainEvent } from '@wacore/shared';

export interface ProductCreatedPayload {
  productId: UniqueId;
  storeId: UniqueId;
  name: string;
  sku?: string;
  price: number;
}

export interface ProductUpdatedPayload {
  productId: UniqueId;
  name?: string;
  price?: number;
}

export interface ProductStockChangedPayload {
  productId: UniqueId;
  previousQuantity: number;
  newQuantity: number;
}

export interface ProductDeletedPayload {
  productId: UniqueId;
  deletedAt: Date;
}

export function createProductCreatedEvent(
  aggregateId: UniqueId,
  payload: ProductCreatedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'PRODUCT_CREATED',
    aggregateType: 'Product',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createProductUpdatedEvent(
  aggregateId: UniqueId,
  payload: ProductUpdatedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'PRODUCT_UPDATED',
    aggregateType: 'Product',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createProductStockChangedEvent(
  aggregateId: UniqueId,
  payload: ProductStockChangedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'PRODUCT_STOCK_CHANGED',
    aggregateType: 'Product',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createProductDeletedEvent(
  aggregateId: UniqueId,
  payload: ProductDeletedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'PRODUCT_DELETED',
    aggregateType: 'Product',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}
