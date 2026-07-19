export interface LivenessStatus {
  alive: boolean;
  uptime: number;
  checkedAt: Date;
  memoryUsage: NodeJS.MemoryUsage;
}

export class LivenessCheck {
  private readonly _startTime: Date;

  constructor() {
    this._startTime = new Date();
  }

  check(): LivenessStatus {
    return {
      alive: true,
      uptime: Math.floor((Date.now() - this._startTime.getTime()) / 1000),
      checkedAt: new Date(),
      memoryUsage: process.memoryUsage(),
    };
  }
}
