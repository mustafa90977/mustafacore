import { ILogger } from '@wacore/shared';

export interface PerformanceMetric {
  operation: string;
  duration: number;
  startTime: Date;
  endTime: Date;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export class PerformanceLogger {
  private readonly _logger: ILogger;

  constructor(logger: ILogger) {
    this._logger = logger;
  }

  startTimer(operation: string): (success?: boolean, metadata?: Record<string, unknown>) => PerformanceMetric {
    const startTime = new Date();
    const startHrTime = process.hrtime();

    return (success: boolean = true, metadata?: Record<string, unknown>): PerformanceMetric => {
      const endTime = new Date();
      const diff = process.hrtime(startHrTime);
      const duration = Math.round(diff[0] * 1000 + diff[1] / 1e6);

      const metric: PerformanceMetric = {
        operation,
        duration,
        startTime,
        endTime,
        success,
        metadata,
      };

      this._logger.info(`Performance: ${operation}`, {
        operation,
        duration: `${duration}ms`,
        success,
        ...metadata,
      });

      return metric;
    };
  }

  async measure<T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
    const end = this.startTimer(operation);
    try {
      const result = await fn();
      end(true, metadata);
      return result;
    } catch (error) {
      end(false, { ...metadata, error: (error as Error).message });
      throw error;
    }
  }
}
