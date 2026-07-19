export interface IQueueProvider {
  enqueue<T>(queue: string, job: QueueJob<T>): Promise<string>;
  dequeue<T>(queue: string): Promise<QueueJob<T> | null>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, error: Error): Promise<void>;
  retry(jobId: string): Promise<void>;
  getJob(jobId: string): Promise<QueueJob | null>;
  getQueueSize(queue: string): Promise<number>;
  purge(queue: string): Promise<void>;
}

export interface QueueJob<T = unknown> {
  id: string;
  queue: string;
  data: T;
  priority: number;
  delay?: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}
