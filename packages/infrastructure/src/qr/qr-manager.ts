import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { IProvider } from '@wacore/wa-core';
import { QRStatusTracker, QRStatusInfo } from './qr-status';
import { QRGenerator, QRGeneratorConfig } from './qr-generator';
import { QRExpiration, QRExpirationConfig } from './qr-expiration';
import { QRRefresh, QRRefreshConfig } from './qr-refresh';
import { QRStorage, QRStorageConfig } from './qr-storage';
import { createQREvent, QRStatus } from './qr-events';

export interface QRManagerConfig {
  readonly generator?: Partial<QRGeneratorConfig>;
  readonly expiration?: Partial<QRExpirationConfig>;
  readonly refresh?: Partial<QRRefreshConfig>;
  readonly storage?: Partial<QRStorageConfig>;
  readonly autoPersist?: boolean;
}

export class QRManager extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _statusTracker: QRStatusTracker;
  private readonly _generator: QRGenerator;
  private readonly _expiration: QRExpiration;
  private readonly _refresh: QRRefresh;
  private readonly _storage: QRStorage;
  private readonly _autoPersist: boolean;
  private _onQRDelivered?: (qr: string, expiresAt: Date) => void;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    config?: QRManagerConfig,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._autoPersist = config?.autoPersist ?? true;

    this._statusTracker = new QRStatusTracker(instanceId, logger);
    this._generator = new QRGenerator(instanceId, logger, config?.generator);
    this._expiration = new QRExpiration(instanceId, logger, config?.expiration);
    this._refresh = new QRRefresh(instanceId, logger, this._generator, this._expiration, this._statusTracker, config?.refresh);
    this._storage = new QRStorage(instanceId, logger, this._statusTracker, config?.storage);

    this._wireEvents();
  }

  get instanceId(): UniqueId {
    return this._instanceId;
  }

  get status(): QRStatus {
    return this._statusTracker.status;
  }

  get qrCode(): string | null {
    return this._statusTracker.qrCode;
  }

  get statusTracker(): QRStatusTracker {
    return this._statusTracker;
  }

  get generator(): QRGenerator {
    return this._generator;
  }

  get expiration(): QRExpiration {
    return this._expiration;
  }

  get refresh(): QRRefresh {
    return this._refresh;
  }

  get storage(): QRStorage {
    return this._storage;
  }

  bindProvider(provider: IProvider): void {
    this._generator.bindProvider(provider);
  }

  unbindProvider(): void {
    this._generator.unbindProvider();
  }

  onQRDelivered(callback: (qr: string, expiresAt: Date) => void): void {
    this._onQRDelivered = callback;
  }

  async requestQR(): Promise<string | null> {
    if (this._statusTracker.status === 'generating') {
      this._logger.debug(
        `[QRManager] QR generation already in progress`,
        { instanceId: this._instanceId },
      );
      return null;
    }

    if (this._statusTracker.status === 'active' && !this._statusTracker.isExpired) {
      this._logger.debug(
        `[QRManager] Active QR still valid, returning existing`,
        { instanceId: this._instanceId },
      );
      return this._statusTracker.qrCode;
    }

    this._statusTracker.transition('generating', 'request');

    this._logger.info(
      `[QRManager] Requesting QR code`,
      { instanceId: this._instanceId },
    );

    const result = await this._refresh.refresh();

    if (result) {
      if (this._autoPersist) {
        this._storage.save();
      }

      this._deliverQR(result.qr, result.expiresAt);
      return result.qr;
    }

    return null;
  }

  markScanned(): void {
    if (this._statusTracker.status !== 'active') {
      this._logger.warn(
        `[QRManager] Cannot mark scanned: not active`,
        { instanceId: this._instanceId, status: this._statusTracker.status },
      );
      return;
    }

    this._expiration.stop();
    this._statusTracker.setScanned();
    this._statusTracker.transition('scanned', 'user.scanned');

    this._storage.save();

    this._logger.info(
      `[QRManager] QR scanned`,
      { instanceId: this._instanceId },
    );

    this.emit('scanned', createQREvent('qr.scanned', this._instanceId, {}));
  }

  revoke(): void {
    this._expiration.stop();
    this._refresh.reset();
    this._statusTracker.transition('revoked', 'manual.revoke');
    this._storage.save();

    this._logger.info(
      `[QRManager] QR revoked`,
      { instanceId: this._instanceId },
    );

    this.emit('revoked', createQREvent('qr.revoked', this._instanceId, {}));
  }

  reset(): void {
    this._expiration.stop();
    this._refresh.reset();
    this._statusTracker.clear();
    this._storage.clear();
  }

  getInfo(): QRStatusInfo {
    return this._statusTracker.getInfo();
  }

  private _deliverQR(qr: string, expiresAt: Date): void {
    this.emit('delivered', createQREvent('qr.delivered', this._instanceId, {
      expiresAt: expiresAt.toISOString(),
      refreshCount: this._statusTracker.refreshCount,
    }));

    if (this._onQRDelivered) {
      this._onQRDelivered(qr, expiresAt);
    }
  }

  private _wireEvents(): void {
    this._statusTracker.on('statusChanged', (event: any) => {
      this.emit('qrEvent', event);
    });

    this._generator.on('requested', (event: any) => this.emit('qrEvent', event));
    this._generator.on('generated', (event: any) => this.emit('qrEvent', event));
    this._generator.on('failed', (event: any) => this.emit('qrEvent', event));

    this._expiration.on('expired', (event: any) => {
      this._statusTracker.transition('expired', 'timer.expired');
      if (this._autoPersist) {
        this._storage.save();
      }
      this.emit('qrEvent', event);
    });

    this._refresh.on('refreshStarted', (event: any) => this.emit('qrEvent', event));
    this._refresh.on('refreshCompleted', (event: any) => this.emit('qrEvent', event));
    this._refresh.on('failed', (event: any) => this.emit('qrEvent', event));

    this._storage.on('saved', (event: any) => this.emit('qrEvent', event));
    this._storage.on('loaded', (event: any) => this.emit('qrEvent', event));
    this._storage.on('cleared', (event: any) => this.emit('qrEvent', event));
  }
}
