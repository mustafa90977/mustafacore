import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { createQREvent } from './qr-events';

export interface QRExpirationConfig {
  readonly timeoutMs: number;
  readonly checkIntervalMs: number;
}

const DEFAULT_EXPIRATION_CONFIG: QRExpirationConfig = {
  timeoutMs: 20000,
  checkIntervalMs: 1000,
};

export class QRExpiration extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _config: QRExpirationConfig;
  private _timer: ReturnType<typeof setTimeout> | null;
  private _checkTimer: ReturnType<typeof setInterval> | null;
  private _expiresAt: Date | null;
  private _isActive: boolean;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    config?: Partial<QRExpirationConfig>,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._config = { ...DEFAULT_EXPIRATION_CONFIG, ...config };
    this._timer = null;
    this._checkTimer = null;
    this._expiresAt = null;
    this._isActive = false;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get expiresAt(): Date | null {
    return this._expiresAt;
  }

  get timeRemaining(): number {
    if (!this._expiresAt) return 0;
    return Math.max(0, this._expiresAt.getTime() - Date.now());
  }

  start(expiresAt: Date): void {
    this.stop();

    this._expiresAt = expiresAt;
    this._isActive = true;

    const remaining = expiresAt.getTime() - Date.now();
    if (remaining <= 0) {
      this._handleExpired();
      return;
    }

    this._timer = setTimeout(() => {
      this._handleExpired();
    }, remaining);

    this._checkTimer = setInterval(() => {
      if (this._expiresAt && new Date() >= this._expiresAt) {
        this._handleExpired();
      }
    }, this._config.checkIntervalMs);

    this._logger.debug(
      `[QRExpiration] Started`,
      { instanceId: this._instanceId, expiresAt: expiresAt.toISOString(), remainingMs: remaining },
    );
  }

  stop(): void {
    this._isActive = false;
    this._expiresAt = null;

    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this._checkTimer) {
      clearInterval(this._checkTimer);
      this._checkTimer = null;
    }
  }

  reset(newExpiresAt: Date): void {
    this.start(newExpiresAt);
  }

  isExpired(): boolean {
    if (!this._expiresAt) return true;
    return new Date() >= this._expiresAt;
  }

  private _handleExpired(): void {
    if (!this._isActive) return;

    this._isActive = false;

    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this._checkTimer) {
      clearInterval(this._checkTimer);
      this._checkTimer = null;
    }

    this._logger.info(
      `[QRExpiration] QR expired`,
      { instanceId: this._instanceId },
    );

    this.emit('expired', createQREvent('qr.expired', this._instanceId, {
      expiredAt: new Date().toISOString(),
    }));
  }
}
