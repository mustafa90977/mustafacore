export interface IScheduler {
  schedule<T>(job: ScheduledJob<T>): Promise<string>;
  cancel(jobId: string): Promise<void>;
  getJob(jobId: string): Promise<ScheduledJob | null>;
  getPendingJobs(): Promise<ScheduledJob[]>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

export interface ScheduledJob<T = unknown> {
  id?: string;
  name: string;
  data: T;
  scheduledAt: Date;
  recurring?: RecurrenceRule;
  payload: T;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: Date;
}
