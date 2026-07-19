import { ILogger } from '@wacore/shared';

export class ErrorLogger {
  private readonly _logger: ILogger;

  constructor(logger: ILogger) {
    this._logger = logger;
  }

  logError(error: Error, context?: Record<string, unknown>): void {
    this._logger.error(error.message, error, {
      ...context,
      severity: 'error',
      timestamp: new Date().toISOString(),
    });
  }

  logUnhandledRejection(reason: unknown, promise: Promise<any>): void {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    this._logger.error('Unhandled Promise Rejection', error, {
      promise: promise.toString(),
      severity: 'critical',
    });
  }

  logUncaughtException(error: Error): void {
    this._logger.error('Uncaught Exception', error, {
      severity: 'critical',
      fatal: true,
    });
  }

  registerGlobalHandlers(): void {
    process.on('unhandledRejection', (reason, promise) => {
      this.logUnhandledRejection(reason, promise);
    });

    process.on('uncaughtException', (error) => {
      this.logUncaughtException(error);
      process.exit(1);
    });
  }
}
