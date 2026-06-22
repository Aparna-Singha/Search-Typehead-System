import { config } from "./config";
import { MetricsTracker } from "./metrics";
import { PrefixIndex } from "./prefixIndex";
import { buildPrefixes } from "./types";

type QueueSnapshot = Array<{ query: string; increment: number }>;
type ApplyBatchUpdatesFn = (
  updates: Array<{ query: string; increment: number }>
) => Promise<Array<{ query: string; count: number; recentScore: number }>>;
type DeleteKeysByPatternsFn = (patterns: string[]) => Promise<number>;

interface BatchWriterDependencies {
  applyUpdates?: ApplyBatchUpdatesFn;
  deleteKeys?: DeleteKeysByPatternsFn;
}

const defaultApplyUpdates: ApplyBatchUpdatesFn = async (updates) => {
  const { applyBatchUpdates } = await import("./db");
  return applyBatchUpdates(updates);
};

const defaultDeleteKeys: DeleteKeysByPatternsFn = async (patterns) => {
  const { deleteKeysByPatterns } = await import("./redis");
  return deleteKeysByPatterns(patterns);
};

export class BatchWriter {
  private readonly queue = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private flushRequestedWhileBusy = false;
  private readonly applyUpdates: ApplyBatchUpdatesFn;
  private readonly deleteKeys: DeleteKeysByPatternsFn;

  constructor(
    private readonly prefixIndex: PrefixIndex,
    private readonly metrics: MetricsTracker,
    dependencies: BatchWriterDependencies = {}
  ) {
    this.applyUpdates = dependencies.applyUpdates ?? defaultApplyUpdates;
    this.deleteKeys = dependencies.deleteKeys ?? defaultDeleteKeys;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.flush();
    }, config.flushIntervalMs);

    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this.flush();
  }

  enqueue(query: string): void {
    const nextValue = (this.queue.get(query) ?? 0) + 1;
    this.queue.set(query, nextValue);
    this.metrics.setQueuedWrites(this.queue.size);

    if (this.isFlushing) {
      if (this.queue.size >= config.batchSize) {
        this.flushRequestedWhileBusy = true;
      }

      return;
    }

    if (this.queue.size >= config.batchSize) {
      void this.flush();
    }
  }

  getQueueSize(): number {
    return this.queue.size;
  }

  async flush(): Promise<void> {
    if (this.isFlushing) {
      this.flushRequestedWhileBusy = true;
      return;
    }

    this.isFlushing = true;

    try {
      do {
        this.flushRequestedWhileBusy = false;
        const snapshot = this.drainQueue();

        if (snapshot.length === 0) {
          break;
        }

        try {
          const updatedTerms = await this.applyUpdates(snapshot);
          this.metrics.recordBatchFlush(snapshot.length);

          for (const term of updatedTerms) {
            this.prefixIndex.upsertTerm(term);
          }

          await this.invalidateSuggestionCache(updatedTerms.map((term) => term.query));
        } catch (error) {
          console.error("Batch flush failed. Restoring queued updates for a later retry.", error);
          this.restoreSnapshot(snapshot);
          break;
        }
      } while (this.flushRequestedWhileBusy || this.queue.size >= config.batchSize);
    } finally {
      this.isFlushing = false;
    }
  }

  private drainQueue(): QueueSnapshot {
    const snapshot = Array.from(this.queue.entries()).map(([query, increment]) => ({
      query,
      increment
    }));

    this.queue.clear();
    this.metrics.setQueuedWrites(0);
    return snapshot;
  }

  private restoreSnapshot(snapshot: QueueSnapshot): void {
    for (const item of snapshot) {
      const nextValue = (this.queue.get(item.query) ?? 0) + item.increment;
      this.queue.set(item.query, nextValue);
    }

    this.metrics.setQueuedWrites(this.queue.size);
  }

  private async invalidateSuggestionCache(queries: string[]): Promise<void> {
    const patterns = new Set<string>(["suggest::*"]);

    for (const query of queries) {
      for (const prefix of buildPrefixes(query)) {
        patterns.add(`suggest:${prefix}:*`);
      }
    }

    try {
      await this.deleteKeys(Array.from(patterns));
    } catch (error) {
      console.warn("Prefix cache invalidation failed.", error);
    }
  }
}
