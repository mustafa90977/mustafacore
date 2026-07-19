export interface IClock {
  now(): Date;
  timestamp(): number;
  sleep(ms: number): Promise<void>;
}

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }

  timestamp(): number {
    return Date.now();
  }

  async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class FixedClock implements IClock {
  private _now: Date;

  constructor(initialTime?: Date) {
    this._now = initialTime || new Date();
  }

  now(): Date {
    return new Date(this._now);
  }

  timestamp(): number {
    return this._now.getTime();
  }

  async sleep(ms: number): Promise<void> {
    this._now = new Date(this._now.getTime() + ms);
  }

  advance(ms: number): void {
    this._now = new Date(this._now.getTime() + ms);
  }

  set(date: Date): void {
    this._now = new Date(date);
  }
}
