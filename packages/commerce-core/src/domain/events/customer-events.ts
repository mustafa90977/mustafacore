import { DomainEvent, UniqueId, createDomainEvent } from '@wacore/shared';

export interface CustomerCreatedPayload {
  customerId: UniqueId;
  workspaceId: UniqueId;
  phoneNumber: string;
  name?: string;
}

export interface CustomerUpdatedPayload {
  customerId: UniqueId;
  name?: string;
  tags?: string[];
}

export interface CustomerDeletedPayload {
  customerId: UniqueId;
  deletedAt: Date;
}

export function createCustomerCreatedEvent(
  aggregateId: UniqueId,
  payload: CustomerCreatedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'CUSTOMER_CREATED',
    aggregateType: 'Customer',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createCustomerUpdatedEvent(
  aggregateId: UniqueId,
  payload: CustomerUpdatedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'CUSTOMER_UPDATED',
    aggregateType: 'Customer',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createCustomerDeletedEvent(
  aggregateId: UniqueId,
  payload: CustomerDeletedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'CUSTOMER_DELETED',
    aggregateType: 'Customer',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}
