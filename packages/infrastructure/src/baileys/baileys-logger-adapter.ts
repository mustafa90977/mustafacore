import type { ILogger as BaileysILogger } from '@whiskeysockets/baileys/lib/Utils/logger';
import { ILogger, LogLevel } from '@wacore/shared';

export class BaileysLoggerAdapter implements BaileysILogger {
  level: string;
  private readonly _logger: ILogger;

  constructor(logger: ILogger, level: LogLevel = 'info') {
    this._logger = logger;
    this.level = level;
  }

  child(bindings: Record<string, unknown>): BaileysILogger {
    return new BaileysLoggerAdapter(
      this._logger.child(bindings),
      this.level as LogLevel,
    );
  }

  trace(obj: unknown, msg?: string): void {
    this._logger.debug(msg || (typeof obj === 'string' ? obj : JSON.stringify(obj)), this.toContext(obj));
  }

  debug(obj: unknown, msg?: string): void {
    this._logger.debug(msg || (typeof obj === 'string' ? obj : JSON.stringify(obj)), this.toContext(obj));
  }

  info(obj: unknown, msg?: string): void {
    this._logger.info(msg || (typeof obj === 'string' ? obj : JSON.stringify(obj)), this.toContext(obj));
  }

  warn(obj: unknown, msg?: string): void {
    this._logger.warn(msg || (typeof obj === 'string' ? obj : JSON.stringify(obj)), this.toContext(obj));
  }

  error(obj: unknown, msg?: string): void {
    const error = obj instanceof Error ? obj : new Error(msg || String(obj));
    this._logger.error(msg || error.message, error, this.toContext(obj));
  }

  private toContext(obj: unknown): Record<string, unknown> {
    if (obj && typeof obj === 'object' && !(obj instanceof Error)) {
      return obj as Record<string, unknown>;
    }
    return { raw: obj };
  }
}
