import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { QRStatus, createQREvent } from './qr-events';

export interface QRStatusInfo {
  readonly status: QRStatus;
  readonly qrCode: string | null;
  readonly generatedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly refreshCount: number;
  readonly lastError: string | null;
  readonly instanceId: UniqueId;
}

const VALID_QR_TRANSITIONS: Record<QRStatus, QRStatus[]> = {
  idle: ['generating'],
  generating: ['active', 'failed'],
  active: ['scanned', 'expired', 'revoked', 'generating'],
  scanned: ['idle', 'generating', 'revoked'],
  expired: ['generating', 'idle', 'revoked'],
  failed: ['generating', 'idle'],
  revoked: [],
};

export class QRStatusTracker extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private _status: QRStatus;
  private _qrCode: string | null;
  private _generatedAt: Date | null;
  private _expiresAt: Date | null;
  private _refreshCount: number;
  private _lastError: string | null;

  constructor(instanceId: UniqueId, logger: ILogger) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._status = 'idle';
    this._qrCode = null;
    this._generatedAt = null;
    this._expiresAt = null;
    this._refreshCount = 0;
    this._lastError = null;
  }

  get status(): QRStatus {
    return this._status;
  }

  get qrCode(): string | null {
    return this._qrCode;
  }

  get generatedAt(): Date | null {
    return this._generatedAt;
  }

  get expiresAt(): Date | null {
    return this._expiresAt;
  }

  get refreshCount(): number {
    return this._refreshCount;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  get isExpired(): boolean {
    if (!this._expiresAt) return true;
    return new Date() > this._expiresAt;
  }

  get timeRemaining(): number {
    if (!this._expiresAt) return 0;
    return Math.max(0, this._expiresAt.getTime() - Date.now());
  }

  getInfo(): QRStatusInfo {
    return {
      status: this._status,
      qrCode: this._qrCode,
      generatedAt: this._generatedAt,
      expiresAt: this._expiresAt,
      refreshCount: this._refreshCount,
      lastError: this._lastError,
      instanceId: this._instanceId,
    };
  }

  canTransition(to: QRStatus): boolean {
    return VALID_QR_TRANSITIONS[this._status]?.includes(to) ?? false;
  }

  transition(to: QRStatus, reason?: string): boolean {
    if (!this.canTransition(to)) {
      this._logger.warn(
        `[QRStatusTracker] Invalid transition: ${this._status} → ${to}`,
        { instanceId: this._instanceId },
      );
      return false;
    }

    const from = this._status;
    this._status = to;

    this._logger.debug(
      `[QRStatusTracker] ${from} → ${to}`,
      { instanceId: this._instanceId, reason },
    );

    const event = createQREvent('qr.status_changed', this._instanceId, {
      from,
      to,
      reason,
    });

    this.emit('statusChanged', event);
    this.emit(to, event);

    return true;
  }

  setGenerated(qrCode: string, expiresAt: Date): void {
    this._qrCode = qrCode;
    this._generatedAt = new Date();
    this._expiresAt = expiresAt;
  }

  setScanned(): void {
    this._qrCode = null;
  }

  setError(error: string): void {
    this._lastError = error;
  }

  incrementRefresh(): number {
    this._refreshCount++;
    return this._refreshCount;
  }

  reset(): void {
    this._status = 'idle';
    this._qrCode = null;
    this._generatedAt = null;
    this._expiresAt = null;
    this._lastError = null;
  }

  clear(): void {
    this.reset();
    this._refreshCount = 0;
  }
}
