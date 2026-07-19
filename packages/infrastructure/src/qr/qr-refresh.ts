import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { QRGenerator } from './qr-generator';
import { QRExpiration } from './qr-expiration';
import { QRStatusTracker } from './qr-status';
import { createQREvent } from './qr-events';

export interface QRRefreshConfig {
  readonly maxRefreshAttempts: number;
  readonly refreshDelayMs: number;
}

const DEFAULT_REFRESH_CONFIG: QRRefreshConfig = {
  maxRefreshAttempts: 5,
  refreshDelayMs: 2000,
};

export class QRRefresh extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _generator: QRGenerator;
  private readonly _expiration: QRExpiration;
  private readonly _statusTracker: QRStatusTracker;
  private readonly _config: QRRefreshConfig;
  private _refreshAttempts: number;
  private _isRefreshing: boolean;
  private _delayTimer: ReturnType<typeof setTimeout> | null;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    generator: QRGenerator,
    expiration: QRExpiration,
    statusTracker: QRStatusTracker,
    config?: Partial<QRRefreshConfig>,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._generator = generator;
    this._expiration = expiration;
    this._statusTracker = statusTracker;
    this._config = { ...DEFAULT_REFRESH_CONFIG, ...config };
    this._refreshAttempts = 0;
    this._isRefreshing = false;
    this._delayTimer = null;

    this._wireExpirationEvent();
  }

  get refreshAttempts(): number {
    return this._refreshAttempts;
  }

  get isRefreshing(): boolean {
    return this._isRefreshing;
  }

  get hasExhausted(): boolean {
    return this._refreshAttempts >= this._config.maxRefreshAttempts;
  }

  async refresh(): Promise<{ qr: string; expiresAt: Date } | null> {
    if (this._isRefreshing) {
      this._logger.debug(
        `[QRRefresh] Already refreshing`,
        { instanceId: this._instanceId },
      );
      return null;
    }

    if (this.hasExhausted) {
      this._logger.warn(
        `[QRRefresh] Max refresh attempts exhausted`,
        { instanceId: this._instanceId, attempts: this._refreshAttempts },
      );
      this.emit('failed', createQREvent('qr.refresh_failed', this._instanceId, {
        attempts: this._refreshAttempts,
        reason: 'max_attempts_exhausted',
      }));
      return null;
    }

    this._isRefreshing = true;
    this._refreshAttempts++;

    this._statusTracker.transition('generating', 'refresh.started');
    this._statusTracker.incrementRefresh();

    this.emit('refreshStarted', createQREvent('qr.refresh_started', this._instanceId, {
      attempt: this._refreshAttempts,
      maxAttempts: this._config.maxRefreshAttempts,
    }));

    this._logger.info(
      `[QRRefresh] Starting refresh`,
      { instanceId: this._instanceId, attempt: this._refreshAttempts },
    );

    try {
      const result = await this._generator.generate();

      if (!result) {
        this._isRefreshing = false;
        this._statusTracker.setError('Generation failed');
        this._statusTracker.transition('failed', 'refresh.generation_failed');

        this.emit('failed', createQREvent('qr.refresh_failed', this._instanceId, {
          attempt: this._refreshAttempts,
          reason: 'generation_failed',
        }));

        return null;
      }

      this._statusTracker.setGenerated(result.qr, result.expiresAt);
      this._statusTracker.transition('active', 'refresh.success');
      this._expiration.start(result.expiresAt);
      this._isRefreshing = false;

      this.emit('refreshCompleted', createQREvent('qr.refresh_completed', this._instanceId, {
        attempt: this._refreshAttempts,
        expiresAt: result.expiresAt.toISOString(),
      }));

      this._logger.info(
        `[QRRefresh] Refresh completed`,
        { instanceId: this._instanceId, attempt: this._refreshAttempts },
      );

      return result;
    } catch (error) {
      this._isRefreshing = false;
      this._statusTracker.setError((error as Error).message);
      this._statusTracker.transition('failed', 'refresh.error');

      this._logger.error(
        `[QRRefresh] Refresh error`,
        error as Error,
        { instanceId: this._instanceId },
      );

      this.emit('failed', createQREvent('qr.refresh_failed', this._instanceId, {
        attempt: this._refreshAttempts,
        error: (error as Error).message,
      }));

      return null;
    }
  }

  reset(): void {
    this._refreshAttempts = 0;
    this._isRefreshing = false;
    if (this._delayTimer) {
      clearTimeout(this._delayTimer);
      this._delayTimer = null;
    }
  }

  private _wireExpirationEvent(): void {
    this._expiration.on('expired', () => {
      if (this._isRefreshing) return;

      this._logger.info(
        `[QRRefresh] QR expired, triggering auto-refresh`,
        { instanceId: this._instanceId },
      );

      this._delayTimer = setTimeout(() => {
        this.refresh().catch(() => {});
      }, this._config.refreshDelayMs);
    });
  }
}
