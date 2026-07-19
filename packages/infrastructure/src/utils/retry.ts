export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export enum BackoffStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
}

export interface IRetryUtility {
  execute<T>(fn: () => Promise<T>, options?: Partial<RetryOptions>): Promise<T>;
}

export class RetryUtility implements IRetryUtility {
  private readonly _strategy: BackoffStrategy;
  private readonly _defaultOptions: RetryOptions;

  constructor(
    strategy: BackoffStrategy = BackoffStrategy.EXPONENTIAL,
    defaultOptions?: Partial<RetryOptions>,
  ) {
    this._strategy = strategy;
    this._defaultOptions = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      ...defaultOptions,
    };
  }

  async execute<T>(fn: () => Promise<T>, options?: Partial<RetryOptions>): Promise<T> {
    const opts = { ...this._defaultOptions, ...options };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (opts.retryableErrors && opts.retryableErrors.length > 0) {
          const errorMessage = lastError.message;
          const isRetryable = opts.retryableErrors.some((e) => errorMessage.includes(e));
          if (!isRetryable) throw lastError;
        }

        if (attempt === opts.maxAttempts) break;

        const delay = this.calculateDelay(attempt, opts);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private calculateDelay(attempt: number, opts: RetryOptions): number {
    let delay: number;

    switch (this._strategy) {
      case BackoffStrategy.FIXED:
        delay = opts.baseDelayMs;
        break;
      case BackoffStrategy.LINEAR:
        delay = opts.baseDelayMs * attempt;
        break;
      case BackoffStrategy.EXPONENTIAL:
      default:
        delay = opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1);
        break;
    }

    return Math.min(delay, opts.maxDelayMs);
  }
}
