import { ILogger, LogLevel, LogContext } from '@wacore/shared';


export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  name?: string;
  [key: string]: unknown;
}

export class StructuredLogger implements ILogger {
  private _level: LogLevel;
  private _context: LogContext;
  private _correlationId?: string;
  private _name?: string;

  constructor(options: { level?: LogLevel; context?: LogContext; correlationId?: string; name?: string } = {}) {
    this._level = options.level || 'info';
    this._context = options.context || {};
    this._correlationId = options.correlationId;
    this._name = options.name;
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error
      ? {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: (error as any).code,
          },
        }
      : context;
    this.log('error', message, errorContext);
  }

  setLevel(level: LogLevel): void {
    this._level = level;
  }

  child(context: LogContext): ILogger {
    return new StructuredLogger({
      level: this._level,
      context: { ...this._context, ...context },
      correlationId: this._correlationId,
      name: this._name,
    });
  }

  setCorrelationId(correlationId: string): void {
    this._correlationId = correlationId;
  }

  getCorrelationId(): string | undefined {
    return this._correlationId;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    if (LOG_LEVELS[level] < LOG_LEVELS[this._level]) {
      return;
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this._correlationId,
      name: this._name,
      ...this._context,
      ...context,
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }
}
