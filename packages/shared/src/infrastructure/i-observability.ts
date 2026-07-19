export interface IMetrics {
  counter(name: string, value: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  timing(name: string, durationMs: number, tags?: Record<string, string>): void;
  increment(name: string, tags?: Record<string, string>): void;
  decrement(name: string, tags?: Record<string, string>): void;
}

export interface ITracing {
  startSpan(name: string, parentSpanId?: string): Span;
  injectContext<T>(fn: () => T): T;
  getCorrelationId(): string | undefined;
}

export interface Span {
  spanId: string;
  traceId: string;
  name: string;
  startTime: Date;
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: SpanStatus): void;
  end(): void;
}

export type SpanStatus = 'OK' | 'ERROR' | 'TIMEOUT';

export interface IHealthChecker {
  check(name: string): Promise<HealthCheckResult>;
  checkAll(): Promise<HealthCheckResult[]>;
  isHealthy(): Promise<boolean>;
}

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  checkedAt: Date;
}
