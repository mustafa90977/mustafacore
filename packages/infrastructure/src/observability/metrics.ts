import { IMetrics, ILogger } from '@wacore/shared';

interface MetricEntry {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timing';
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

export class MetricsCollector implements IMetrics {
  private readonly _metrics: MetricEntry[] = [];
  private readonly _counters: Map<string, number> = new Map();
  private readonly _gauges: Map<string, number> = new Map();
  private readonly _logger?: ILogger;

  constructor(logger?: ILogger) {
    this._logger = logger;
  }

  counter(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKey(name, tags);
    const current = this._counters.get(key) || 0;
    this._counters.set(key, current + value);
    this.record({ name, type: 'counter', value: current + value, tags, timestamp: new Date() });
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKey(name, tags);
    this._gauges.set(key, value);
    this.record({ name, type: 'gauge', value, tags, timestamp: new Date() });
  }

  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.record({ name, type: 'histogram', value, tags, timestamp: new Date() });
  }

  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.record({ name, type: 'timing', value: durationMs, tags, timestamp: new Date() });
    this._logger?.info(`Timing: ${name}`, { duration: `${durationMs}ms`, ...tags });
  }

  increment(name: string, tags?: Record<string, string>): void {
    this.counter(name, 1, tags);
  }

  decrement(name: string, tags?: Record<string, string>): void {
    this.counter(name, -1, tags);
  }

  getCounter(name: string, tags?: Record<string, string>): number {
    return this._counters.get(this.getKey(name, tags)) || 0;
  }

  getGauge(name: string, tags?: Record<string, string>): number | undefined {
    return this._gauges.get(this.getKey(name, tags));
  }

  getMetrics(): MetricEntry[] {
    return [...this._metrics];
  }

  private record(entry: MetricEntry): void {
    this._metrics.push(entry);
    if (this._metrics.length > 10000) {
      this._metrics.splice(0, 5000);
    }
  }

  private getKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    const tagStr = Object.entries(tags).sort().map(([k, v]) => `${k}=${v}`).join(',');
    return `${name}|${tagStr}`;
  }
}
