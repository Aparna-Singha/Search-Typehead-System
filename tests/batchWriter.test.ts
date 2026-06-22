import { describe, expect, it, vi } from "vitest";

import { BatchWriter } from "../src/batchWriter";
import { MetricsTracker } from "../src/metrics";
import { PrefixIndex } from "../src/prefixIndex";
import { SearchTermRecord } from "../src/types";

describe("BatchWriter", () => {
  it("aggregates duplicate queries before flushing", async () => {
    const prefixIndex = new PrefixIndex(10, 10);
    const metrics = new MetricsTracker();
    const applyUpdates = vi.fn(
      async (
        updates: Array<{ query: string; increment: number }>
      ): Promise<SearchTermRecord[]> =>
        updates.map((item) => ({
          query: item.query,
          count: item.increment,
          recentScore: item.increment
        }))
    );
    const deleteKeys = vi.fn(async () => 0);
    const batchWriter = new BatchWriter(prefixIndex, metrics, {
      applyUpdates,
      deleteKeys
    });

    batchWriter.enqueue("iphone 15");
    batchWriter.enqueue("iphone 15");
    batchWriter.enqueue("iphone charger");

    await batchWriter.flush();

    expect(applyUpdates).toHaveBeenCalledTimes(1);
    expect(applyUpdates).toHaveBeenCalledWith([
      { query: "iphone 15", increment: 2 },
      { query: "iphone charger", increment: 1 }
    ]);
    expect(metrics.getSnapshot().batchFlushes).toBe(1);
  });
});
