import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { UniqueId, ILogger } from '@wacore/shared';
import { createQREvent } from './qr-events';
import { QRStatusTracker, QRStatusInfo } from './qr-status';

export interface QRStorageConfig {
  readonly baseFolder: string;
  readonly persistToFile: boolean;
}

const DEFAULT_STORAGE_CONFIG: QRStorageConfig = {
  baseFolder: './qr_state',
  persistToFile: true,
};

interface StoredQRState {
  instanceId: string;
  status: string;
  qrCode: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  refreshCount: number;
  lastError: string | null;
  savedAt: string;
}

export class QRStorage extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _statusTracker: QRStatusTracker;
  private readonly _config: QRStorageConfig;
  private _state: StoredQRState | null;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    statusTracker: QRStatusTracker,
    config?: Partial<QRStorageConfig>,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._statusTracker = statusTracker;
    this._config = { ...DEFAULT_STORAGE_CONFIG, ...config };
    this._state = null;
  }

  get hasState(): boolean {
    return this._state !== null;
  }

  get state(): StoredQRState | null {
    return this._state;
  }

  save(): void {
    const info = this._statusTracker.getInfo();
    this._state = {
      instanceId: this._instanceId,
      status: info.status,
      qrCode: info.qrCode,
      generatedAt: info.generatedAt?.toISOString() ?? null,
      expiresAt: info.expiresAt?.toISOString() ?? null,
      refreshCount: info.refreshCount,
      lastError: info.lastError,
      savedAt: new Date().toISOString(),
    };

    this._logger.debug(
      `[QRStorage] State saved`,
      { instanceId: this._instanceId, status: info.status },
    );

    this.emit('saved', createQREvent('qr.storage.saved', this._instanceId, {
      status: info.status,
      hasQr: info.qrCode !== null,
    }));

    if (this._config.persistToFile) {
      this._persistToFile();
    }
  }

  load(): QRStatusInfo | null {
    if (!this._config.persistToFile) {
      return null;
    }

    try {
      const content = this._readFromFile();
      if (!content) return null;

      this._state = content;

      this._logger.debug(
        `[QRStorage] State loaded`,
        { instanceId: this._instanceId, status: content.status },
      );

      this.emit('loaded', createQREvent('qr.storage.loaded', this._instanceId, {
        status: content.status,
        hasQr: content.qrCode !== null,
      }));

      return {
        status: content.status as QRStatusInfo['status'],
        qrCode: content.qrCode,
        generatedAt: content.generatedAt ? new Date(content.generatedAt) : null,
        expiresAt: content.expiresAt ? new Date(content.expiresAt) : null,
        refreshCount: content.refreshCount,
        lastError: content.lastError,
        instanceId: this._instanceId,
      };
    } catch (error) {
      this._logger.error(
        `[QRStorage] Load failed`,
        error as Error,
        { instanceId: this._instanceId },
      );
      return null;
    }
  }

  clear(): void {
    this._state = null;

    if (this._config.persistToFile) {
      this._clearFile();
    }

    this._logger.debug(
      `[QRStorage] State cleared`,
      { instanceId: this._instanceId },
    );

    this.emit('cleared', createQREvent('qr.storage.cleared', this._instanceId, {}));
  }

  private _getFilePath(): string {
    return path.join(this._config.baseFolder, `${this._instanceId}_qr.json`);
  }

  private _persistToFile(): void {
    try {
      const filePath = this._getFilePath();
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(this._state, null, 2), 'utf-8');
    } catch (error) {
      this._logger.error(
        `[QRStorage] File persist failed`,
        error as Error,
        { instanceId: this._instanceId },
      );
    }
  }

  private _readFromFile(): StoredQRState | null {
    try {
      const filePath = this._getFilePath();

      if (!fs.existsSync(filePath)) return null;

      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as StoredQRState;
    } catch {
      return null;
    }
  }

  private _clearFile(): void {
    try {
      const filePath = this._getFilePath();

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this._logger.warn(
        `[QRStorage] File clear failed`,
        { instanceId: this._instanceId, error: (error as Error).message },
      );
    }
  }
}
