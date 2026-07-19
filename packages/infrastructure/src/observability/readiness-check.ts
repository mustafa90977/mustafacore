import { HealthCheckResult } from '@wacore/shared';
import { HealthCheckService, HealthCheckFunction } from './health-check';

export interface ReadinessStatus {
  ready: boolean;
  checks: HealthCheckResult[];
  checkedAt: Date;
}

export class ReadinessCheck {
  private readonly _healthCheck: HealthCheckService;
  private readonly _requiredChecks: Set<string> = new Set();

  constructor(healthCheck: HealthCheckService) {
    this._healthCheck = healthCheck;
  }

  registerRequiredCheck(name: string, checkFn: HealthCheckFunction): void {
    this._requiredChecks.add(name);
    this._healthCheck.registerCheck(name, checkFn);
  }

  async isReady(): Promise<ReadinessStatus> {
    const checks = await this._healthCheck.checkAll();
    const requiredResults = checks.filter((c) => this._requiredChecks.has(c.name));
    const ready = requiredResults.every((c) => c.status === 'healthy');

    return {
      ready,
      checks,
      checkedAt: new Date(),
    };
  }
}
