import * as dotenv from "dotenv";

dotenv.config();

const numberFromEnv = (name: string, fallback: number): number => {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const trendingWindowMinutes = numberFromEnv("TRENDING_WINDOW_MINUTES", 60);
const trendingBucketMinutes = Math.max(1, numberFromEnv("TRENDING_BUCKET_MINUTES", 5));

export const config = Object.freeze({
  port: numberFromEnv("PORT", 3000),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/search_typeahead",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  suggestCacheTtlSeconds: numberFromEnv("SUGGEST_CACHE_TTL_SECONDS", 60),
  defaultSuggestLimit: numberFromEnv("DEFAULT_SUGGEST_LIMIT", 10),
  maxSuggestLimit: numberFromEnv("MAX_SUGGEST_LIMIT", 10),
  prefixTopK: numberFromEnv("PREFIX_TOP_K", 15),
  popularTopK: numberFromEnv("POPULAR_TOP_K", 25),
  batchSize: numberFromEnv("BATCH_SIZE", 25),
  flushIntervalMs: numberFromEnv("FLUSH_INTERVAL_MS", 3000),
  trendingWindowMinutes,
  trendingBucketMinutes,
  trendingCandidateLimit: numberFromEnv("TRENDING_CANDIDATE_LIMIT", 100)
});
