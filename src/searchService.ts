import { BatchWriter } from "./batchWriter";
import { MetricsTracker } from "./metrics";
import { TrendingService } from "./trendingService";
import { normalizeQuery } from "./types";

export class SearchService {
  constructor(
    private readonly batchWriter: BatchWriter,
    private readonly trendingService: TrendingService,
    private readonly metrics: MetricsTracker
  ) {}

  async acceptSearch(rawQuery: unknown): Promise<{
    message: string;
    query: string;
    queued: boolean;
  }> {
    const query = normalizeQuery(typeof rawQuery === "string" ? rawQuery : "");

    if (!query) {
      const error = new Error("Query is required.");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    this.metrics.recordSearchRequest();
    this.batchWriter.enqueue(query);

    try {
      await this.trendingService.recordSearch(query);
    } catch (error) {
      console.warn("Trending update failed, but the search was still queued.", error);
    }

    return {
      message: "Search accepted",
      query,
      queued: true
    };
  }
}

