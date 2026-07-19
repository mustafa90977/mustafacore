import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { IProvider } from '@wacore/wa-core';
import { createQREvent } from './qr-events';

export interface QRGeneratorConfig {
  readonly timeoutMs: number;
}

const DEFAULT_GENERATOR_CONFIG: QRGeneratorConfig = {
  timeoutMs: 15000,
};

export class QRGenerator extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _config: QRGeneratorConfig;
  private _provider: IProvider | null;
  private _isGenerating: boolean;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    config?: Partial<QRGeneratorConfig>,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._config = { ...DEFAULT_GENERATOR_CONFIG, ...config };
    this._provider = null;
    this._isGenerating = false;
  }

  get isGenerating(): boolean {
    return this._isGenerating;
  }

  bindProvider(provider: IProvider): void {
    this._provider = provider;
  }

  unbindProvider(): void {
    this._provider = null;
  }

  async generate(): Promise<{ qr: string; expiresAt: Date } | null> {
    if (this._isGenerating) {
      this._logger.debug(
        `[QRGenerator] Already generating`,
        { instanceId: this._instanceId },
      );
      return null;
    }

    if (!this._provider) {
      this._logger.warn(
        `[QRGenerator] No provider bound`,
        { instanceId: this._instanceId },
      );
      return null;
    }

    this._isGenerating = true;

    this.emit('requested', createQREvent('qr.requested', this._instanceId, {}));

    try {
      const result = await Promise.race([
        this._provider.getQRCode(),
        this._createTimeout(),
      ]);

      if (result === null) {
        this._isGenerating = false;
        this.emit('failed', createQREvent('qr.refresh_failed', this._instanceId, {
          error: 'Provider returned null',
        }));
        return null;
      }

      const qrResult = result as { qr: string | null; expiryRemaining?: number; error?: string };

      if (qrResult.error || !qrResult.qr) {
        this._isGenerating = false;
        this.emit('failed', createQREvent('qr.refresh_failed', this._instanceId, {
          error: qrResult.error ?? 'No QR code available',
        }));
        return null;
      }

      const expiryMs = qrResult.expiryRemaining ?? 20000;
      const expiresAt = new Date(Date.now() + expiryMs);

      this._isGenerating = false;

      this.emit('generated', createQREvent('qr.generated', this._instanceId, {
        qr: qrResult.qr,
        expiresAt: expiresAt.toISOString(),
        expiryRemaining: expiryMs,
      }));

      return { qr: qrResult.qr, expiresAt };
    } catch (error) {
      this._isGenerating = false;

      this._logger.error(
        `[QRGenerator] Generation failed`,
        error as Error,
        { instanceId: this._instanceId },
      );

      this.emit('failed', createQREvent('qr.refresh_failed', this._instanceId, {
        error: (error as Error).message,
      }));

      return null;
    }
  }

  private _createTimeout(): Promise<null> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(null), this._config.timeoutMs);
    });
  }
}
