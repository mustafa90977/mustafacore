import { IHealthChecker, HealthCheckResult, ILogger } from '@wacore/shared';

export type HealthCheckFunction = () => Promise<HealthCheckResult>;

export class HealthCheckService implements IHealthChecker {
  private readonly _checks: Map<string, HealthCheckFunction> = new Map();
  private readonly _logger: ILogger;

  constructor(logger: ILogger) {
    this._logger = logger;
  }

  registerCheck(name: string, checkFn: HealthCheckFunction): void {
    this._checks.set(name, checkFn);
    this._logger.debug(`Registered health check: ${name}`);
  }

  async check(name: string): Promise<HealthCheckResult> {
    const checkFn = this._checks.get(name);
    if (!checkFn) {
      return {
        name,
        status: 'unhealthy',
        error: `Health check '${name}' not registered`,
        checkedAt: new Date(),
      };
    }

    const start = Date.now();
    try {
      const result = await checkFn();
      return {
        ...result,
        latency: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        error: (error as Error).message,
        latency: Date.now() - start,
        checkedAt: new Date(),
      };
    }
  }

  async checkAll(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    for (const [name] of this._checks) {
      results.push(await this.check(name));
    }
    return results;
  }

  async isHealthy(): Promise<boolean> {
    const results = await this.checkAll();
    return results.every((r) => r.status === 'healthy');
  }
}
