import { ILogger } from '@wacore/shared';
import { getOrCreateCorrelationId, runWithCorrelationId } from './correlation-id';

export interface RequestLogContext {
  method: string;
  url: string;
  statusCode?: number;
  duration?: number;
  correlationId?: string;
  userAgent?: string;
  ip?: string;
}

export class RequestLogger {
  private readonly _logger: ILogger;

  constructor(logger: ILogger) {
    this._logger = logger;
  }

  logRequest(context: RequestLogContext): void {
    this._logger.info('HTTP Request', {
      method: context.method,
      url: context.url,
      statusCode: context.statusCode,
      duration: context.duration ? `${context.duration}ms` : undefined,
      correlationId: context.correlationId || getOrCreateCorrelationId(),
      userAgent: context.userAgent,
      ip: context.ip,
    });
  }

  logResponse(method: string, url: string, statusCode: number, duration: number): void {
    const context = {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      correlationId: getOrCreateCorrelationId(),
    };
    if (statusCode >= 500) {
      this._logger.error(`${method} ${url} ${statusCode}`, undefined, context);
    } else if (statusCode >= 400) {
      this._logger.warn(`${method} ${url} ${statusCode}`, context);
    } else {
      this._logger.info(`${method} ${url} ${statusCode}`, context);
    }
  }

  createMiddleware() {
    return (_req: unknown, res: any, next: () => void) => {
      const correlationId = getOrCreateCorrelationId() || getOrCreateCorrelationId();
      const start = Date.now();

      const originalEnd = res.end.bind(res);
      res.end = function (this: any, ...args: any[]) {
        const duration = Date.now() - start;
        res.end = originalEnd;
        res.end(...args);
        void duration;
      };

      runWithCorrelationId(correlationId, () => {
        next();
      });
    };
  }
}
