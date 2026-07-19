import { EventEmitter } from 'events';
import { UniqueId, ILogger } from '@wacore/shared';
import { createConnectionEvent } from './connection-events';

export interface OfflineQueueConfig {
  readonly maxSize: number;
  readonly maxAgeMs: number;
  readonly dropOnExpiry: boolean;
}

export interface QueuedMessage {
  readonly id: string;
  readonly instanceId: UniqueId;
  readonly payload: unknown;
  readonly enqueuedAt: Date;
  readonly priority: number;
  readonly metadata?: Record<string, unknown>;
}

const DEFAULT_QUEUE_CONFIG: OfflineQueueConfig = {
  maxSize: 1000,
  maxAgeMs: 300000,
  dropOnExpiry: true,
};

export class OfflineQueue extends EventEmitter {
  private readonly _instanceId: UniqueId;
  private readonly _logger: ILogger;
  private readonly _config: OfflineQueueConfig;
  private _queue: QueuedMessage[];
  private _counter: number;

  constructor(
    instanceId: UniqueId,
    logger: ILogger,
    config?: Partial<OfflineQueueConfig>,
  ) {
    super();
    this._instanceId = instanceId;
    this._logger = logger;
    this._config = { ...DEFAULT_QUEUE_CONFIG, ...config };
    this._queue = [];
    this._counter = 0;
  }

  get size(): number {
    return this._queue.length;
  }

  get isEmpty(): boolean {
    return this._queue.length === 0;
  }

  get isFull(): boolean {
    return this._queue.length >= this._config.maxSize;
  }

  enqueue(payload: unknown, priority: number = 0, metadata?: Record<string, unknown>): QueuedMessage | null {
    if (this.isFull) {
      this._logger.warn(
        `[OfflineQueue] Queue full, dropping message`,
        { instanceId: this._instanceId, size: this._queue.length, maxSize: this._config.maxSize },
      );

      this.emit('dropped', createConnectionEvent('connection.queue.dropped', this._instanceId, {
        reason: 'queue_full',
        size: this._queue.length,
      }));

      return null;
    }

    this._counter++;
    const message: QueuedMessage = {
      id: `oq_${this._counter}_${Date.now()}`,
      instanceId: this._instanceId,
      payload,
      enqueuedAt: new Date(),
      priority,
      metadata,
    };

    this._queue.push(message);
    this._sort();

    this._logger.debug(
      `[OfflineQueue] Enqueued message`,
      { instanceId: this._instanceId, id: message.id, queueSize: this._queue.length },
    );

    this.emit('enqueued', createConnectionEvent('connection.queue.enqueued', this._instanceId, {
      messageId: message.id,
      queueSize: this._queue.length,
      priority,
    }));

    return message;
  }

  dequeue(): QueuedMessage | undefined {
    this._evictExpired();
    return this._queue.shift();
  }

  peek(): QueuedMessage | undefined {
    this._evictExpired();
    return this._queue[0];
  }

  drain(maxItems?: number): QueuedMessage[] {
    this._evictExpired();
    const count = maxItems ?? this._queue.length;
    const items = this._queue.splice(0, count);

    if (items.length > 0) {
      this._logger.debug(
        `[OfflineQueue] Drained ${items.length} messages`,
        { instanceId: this._instanceId, remaining: this._queue.length },
      );

      this.emit('flushed', createConnectionEvent('connection.queue.flushed', this._instanceId, {
        count: items.length,
        remaining: this._queue.length,
      }));
    }

    return items;
  }

  peekAll(): ReadonlyArray<QueuedMessage> {
    this._evictExpired();
    return [...this._queue];
  }

  remove(messageId: string): boolean {
    const index = this._queue.findIndex((m) => m.id === messageId);
    if (index === -1) return false;
    this._queue.splice(index, 1);
    return true;
  }

  clear(): void {
    const count = this._queue.length;
    this._queue = [];

    if (count > 0) {
      this.emit('flushed', createConnectionEvent('connection.queue.flushed', this._instanceId, {
        count,
        remaining: 0,
      }));
    }
  }

  private _sort(): void {
    this._queue.sort((a, b) => b.priority - a.priority);
  }

  private _evictExpired(): void {
    if (!this._config.dropOnExpiry) return;

    const now = Date.now();
    const before = this._queue.length;
    this._queue = this._queue.filter(
      (m) => (now - m.enqueuedAt.getTime()) < this._config.maxAgeMs,
    );

    const dropped = before - this._queue.length;
    if (dropped > 0) {
      this._logger.debug(
        `[OfflineQueue] Evicted ${dropped} expired messages`,
        { instanceId: this._instanceId, remaining: this._queue.length },
      );
    }
  }
}
