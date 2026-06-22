import { RedisClientType } from "redis";

import { config } from "./config";
import { PrefixIndex } from "./prefixIndex";
import { TrendingSuggestion, clampLimit } from "./types";

export class TrendingService {
  private readonly windowMinutes = config.trendingWindowMinutes;
  private readonly bucketMinutes = config.trendingBucketMinutes;
  private readonly bucketDurationMs = this.bucketMinutes * 60 * 1000;
  private readonly bucketCount = Math.max(1, Math.ceil(this.windowMinutes / this.bucketMinutes));
  private readonly bucketExpirySeconds = (this.windowMinutes + this.bucketMinutes) * 60;

  constructor(
    private readonly redis: RedisClientType,
    private readonly prefixIndex: PrefixIndex
  ) {}

  async recordSearch(query: string): Promise<void> {
    const bucketKey = this.getBucketKey(Date.now());

    await this.redis.zIncrBy(bucketKey, 1, query);
    await this.redis.expire(bucketKey, this.bucketExpirySeconds);
  }

  async getTrending(limit: number): Promise<{ trending: TrendingSuggestion[] }> {
    const safeLimit = clampLimit(limit, 1, config.maxSuggestLimit);
    const candidateLimit = Math.max(safeLimit * 5, config.trendingCandidateLimit);
    const aggregateScores = new Map<string, number>();

    try {
      for (const bucketKey of this.getRecentBucketKeys()) {
        const bucketEntries = await this.redis.zRangeWithScores(bucketKey, 0, candidateLimit - 1, {
          REV: true
        });

        for (const entry of bucketEntries) {
          const nextScore = (aggregateScores.get(entry.value) ?? 0) + entry.score;
          aggregateScores.set(entry.value, nextScore);
        }
      }
    } catch (error) {
      console.warn("Trending lookup failed, returning an empty list.", error);
      return { trending: [] };
    }

    const ranked = Array.from(aggregateScores.entries())
      .map(([query, score]) => ({
        query,
        score,
        count: this.prefixIndex.getTermCount(query)
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.query.localeCompare(right.query);
      })
      .slice(0, safeLimit)
      .map<TrendingSuggestion>(({ query, score }) => ({
        query,
        score: Math.round(score)
      }));

    return { trending: ranked };
  }

  private getRecentBucketKeys(): string[] {
    const keys: string[] = [];
    const currentBucketStart = this.getBucketStart(Date.now());

    for (let offset = 0; offset < this.bucketCount; offset += 1) {
      keys.push(`trending:bucket:${currentBucketStart - offset * this.bucketDurationMs}`);
    }

    return keys;
  }

  private getBucketKey(timestampMs: number): string {
    return `trending:bucket:${this.getBucketStart(timestampMs)}`;
  }

  private getBucketStart(timestampMs: number): number {
    return Math.floor(timestampMs / this.bucketDurationMs) * this.bucketDurationMs;
  }
}

