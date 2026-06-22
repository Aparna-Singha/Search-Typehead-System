import { RedisClientType } from "redis";

import { config } from "./config";
import { MetricsTracker } from "./metrics";
import { PrefixIndex } from "./prefixIndex";
import { buildSuggestionCacheKey } from "./redis";
import { Suggestion, clampLimit, normalizeQuery } from "./types";

interface SuggestionResponse {
  prefix: string;
  source: "cache" | "index";
  suggestions: Suggestion[];
}

export class SuggestionService {
  constructor(
    private readonly redis: RedisClientType,
    private readonly prefixIndex: PrefixIndex,
    private readonly metrics: MetricsTracker,
    private readonly ensureIndexLoaded: () => Promise<void>
  ) {}

  async getSuggestions(rawPrefix: unknown, rawLimit: unknown): Promise<SuggestionResponse> {
    this.metrics.recordSuggestRequest();

    const prefix = normalizeQuery(typeof rawPrefix === "string" ? rawPrefix : "");
    const requestedLimit =
      typeof rawLimit === "string" ? Number(rawLimit) : config.defaultSuggestLimit;
    const limit = clampLimit(
      requestedLimit,
      1,
      Math.max(config.defaultSuggestLimit, config.maxSuggestLimit)
    );

    await this.ensureIndexLoaded();

    const cacheKey = buildSuggestionCacheKey(prefix, limit);

    try {
      const cachedPayload = await this.redis.get(cacheKey);

      if (cachedPayload) {
        this.metrics.recordCacheHit();

        return {
          prefix,
          source: "cache",
          suggestions: JSON.parse(cachedPayload) as Suggestion[]
        };
      }
    } catch (error) {
      console.warn("Suggestion cache lookup failed. Falling back to the in-memory index.", error);
    }

    this.metrics.recordCacheMiss();

    const suggestions =
      prefix.length === 0
        ? this.prefixIndex.getPopular(limit)
        : this.prefixIndex.getSuggestions(prefix, limit);

    try {
      await this.redis.set(cacheKey, JSON.stringify(suggestions), {
        EX: config.suggestCacheTtlSeconds
      });
    } catch (error) {
      console.warn("Suggestion cache write failed.", error);
    }

    return {
      prefix,
      source: "index",
      suggestions
    };
  }
}

