import { MetricsSnapshot } from "./types";

export class MetricsTracker {
  private suggestRequests = 0;
  private searchRequests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private batchFlushes = 0;
  private queuedWrites = 0;
  private totalSearchEvents = 0;
  private distinctRowsWritten = 0;

  recordSuggestRequest(): void {
    this.suggestRequests += 1;
  }

  recordSearchRequest(): void {
    this.searchRequests += 1;
    this.totalSearchEvents += 1;
  }

  recordCacheHit(): void {
    this.cacheHits += 1;
  }

  recordCacheMiss(): void {
    this.cacheMisses += 1;
  }

  recordBatchFlush(distinctRowsWritten: number): void {
    this.batchFlushes += 1;
    this.distinctRowsWritten += distinctRowsWritten;
  }

  setQueuedWrites(queuedWrites: number): void {
    this.queuedWrites = queuedWrites;
  }

  getSnapshot(): MetricsSnapshot {
    const totalCacheLookups = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheLookups === 0 ? 0 : this.cacheHits / totalCacheLookups;
    const avoidedWrites = Math.max(this.totalSearchEvents - this.distinctRowsWritten, 0);

    let writeReductionEstimate = "No queued search writes have been flushed yet.";

    if (this.distinctRowsWritten > 0) {
      const reductionRatio = this.totalSearchEvents / this.distinctRowsWritten;
      writeReductionEstimate = `${avoidedWrites} row updates avoided (${reductionRatio.toFixed(
        2
      )}x fewer row-level writes than direct updates)`;
    }

    return {
      suggestRequests: this.suggestRequests,
      searchRequests: this.searchRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate,
      batchFlushes: this.batchFlushes,
      queuedWrites: this.queuedWrites,
      totalSearchEvents: this.totalSearchEvents,
      distinctRowsWritten: this.distinctRowsWritten,
      writeReductionEstimate
    };
  }
}

