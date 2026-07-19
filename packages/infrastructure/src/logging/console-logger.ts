import { ILogger, LogLevel, LogContext } from '@wacore/shared';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class ConsoleLogger implements ILogger {
  private _level: LogLevel;
  private _context: LogContext;
  private _name?: string;

  constructor(options: { level?: LogLevel; context?: LogContext; name?: string } = {}) {
    this._level = options.level || 'info';
    this._context = options.context || {};
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
          errorName: error.name,
          errorMessage: error.message,
          stack: error.stack,
        }
      : context;
    this.log('error', message, errorContext);
  }

  setLevel(level: LogLevel): void {
    this._level = level;
  }

  child(context: LogContext): ILogger {
    return new ConsoleLogger({
      level: this._level,
      context: { ...this._context, ...context },
      name: this._name,
    });
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this._level]) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      name: this._name,
      message,
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
