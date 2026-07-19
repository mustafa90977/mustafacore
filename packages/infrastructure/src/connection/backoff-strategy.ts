export interface ConnectionBackoffConfig {
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly multiplier: number;
  readonly jitterFraction: number;
  readonly maxAttempts: number;
}

export interface ConnectionBackoffState {
  readonly attempt: number;
  readonly delayMs: number;
  readonly nextAllowedAt: Date;
}

const DEFAULT_BACKOFF_CONFIG: ConnectionBackoffConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
  jitterFraction: 0.1,
  maxAttempts: 10,
};

export class ConnectionBackoffStrategy {
  private readonly _config: ConnectionBackoffConfig;
  private _attempt: number;
  private _lastDelayMs: number;

  constructor(config?: Partial<ConnectionBackoffConfig>) {
    this._config = { ...DEFAULT_BACKOFF_CONFIG, ...config };
    this._attempt = 0;
    this._lastDelayMs = 0;
  }

  get attempt(): number {
    return this._attempt;
  }

  get maxAttempts(): number {
    return this._config.maxAttempts;
  }

  get hasExhausted(): boolean {
    return this._attempt >= this._config.maxAttempts;
  }

  nextDelay(): number {
    if (this.hasExhausted) {
      return -1;
    }

    const base = this._config.baseDelayMs * Math.pow(this._config.multiplier, this._attempt);
    const capped = Math.min(base, this._config.maxDelayMs);
    const jitter = capped * this._config.jitterFraction * (Math.random() * 2 - 1);
    const delay = Math.max(0, Math.round(capped + jitter));

    this._lastDelayMs = delay;
    this._attempt++;

    return delay;
  }

  getState(): ConnectionBackoffState {
    const delay = this._lastDelayMs;
    return {
      attempt: this._attempt,
      delayMs: delay,
      nextAllowedAt: new Date(Date.now() + delay),
    };
  }

  reset(): void {
    this._attempt = 0;
    this._lastDelayMs = 0;
  }
}
