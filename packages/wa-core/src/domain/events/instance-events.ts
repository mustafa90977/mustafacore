import { DomainEvent, UniqueId, createDomainEvent } from '@wacore/shared';
import { ProviderType } from '../enums/provider-type';

export interface InstanceCreatedPayload {
  instanceId: UniqueId;
  workspaceId: UniqueId;
  storeId?: UniqueId;
  name: string;
  phoneNumber: string;
  provider: ProviderType;
}

export interface InstanceConnectedPayload {
  instanceId: UniqueId;
  connectedAt: Date;
  sessionId: string;
}

export interface InstanceDisconnectedPayload {
  instanceId: UniqueId;
  reason: string;
  willReconnect: boolean;
}

export function createInstanceCreatedEvent(
  aggregateId: UniqueId,
  payload: InstanceCreatedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'INSTANCE_CREATED',
    aggregateType: 'WhatsAppInstance',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createInstanceConnectedEvent(
  aggregateId: UniqueId,
  payload: InstanceConnectedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'INSTANCE_CONNECTED',
    aggregateType: 'WhatsAppInstance',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createInstanceDisconnectedEvent(
  aggregateId: UniqueId,
  payload: InstanceDisconnectedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'INSTANCE_DISCONNECTED',
    aggregateType: 'WhatsAppInstance',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}
