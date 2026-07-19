import { UniqueId } from '@wacore/shared';

export type QRStatus = 'idle' | 'generating' | 'active' | 'scanned' | 'expired' | 'failed' | 'revoked';

export type QREventType =
  | 'qr.requested'
  | 'qr.generated'
  | 'qr.delivered'
  | 'qr.scanned'
  | 'qr.expired'
  | 'qr.refresh_started'
  | 'qr.refresh_completed'
  | 'qr.refresh_failed'
  | 'qr.revoked'
  | 'qr.storage.saved'
  | 'qr.storage.loaded'
  | 'qr.storage.cleared'
  | 'qr.status_changed';

export interface QREvent {
  readonly type: QREventType;
  readonly instanceId: UniqueId;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

export type AnyQREvent = QREvent;

export type QREventHandler = (event: AnyQREvent) => void | Promise<void>;

export function createQREvent(
  type: QREventType,
  instanceId: UniqueId,
  metadata?: Record<string, unknown>,
): QREvent {
  return {
    type,
    instanceId,
    timestamp: new Date(),
    metadata,
  };
}
