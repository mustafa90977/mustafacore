import { DomainEvent, UniqueId, createDomainEvent } from '@wacore/shared';

export interface QRGeneratedPayload {
  instanceId: UniqueId;
  sessionId: UniqueId;
  qrCode: string;
  expiresAt: Date;
}

export interface QRScannedPayload {
  instanceId: UniqueId;
  sessionId: UniqueId;
}

export interface QRExpiredPayload {
  instanceId: UniqueId;
  sessionId: UniqueId;
}

export function createQRGeneratedEvent(
  aggregateId: UniqueId,
  payload: QRGeneratedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'QR_GENERATED',
    aggregateType: 'WhatsAppInstance',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createQRScannedEvent(
  aggregateId: UniqueId,
  payload: QRScannedPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'QR_SCANNED',
    aggregateType: 'WhatsAppInstance',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export function createQRExpiredEvent(
  aggregateId: UniqueId,
  payload: QRExpiredPayload,
): DomainEvent {
  return createDomainEvent({
    eventType: 'QR_EXPIRED',
    aggregateType: 'WhatsAppInstance',
    aggregateId,
    payload: payload as unknown as Record<string, unknown>,
  });
}
