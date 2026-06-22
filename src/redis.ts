import { RedisClientType, createClient } from "redis";

import { config } from "./config";

let redisClient: RedisClientType | null = null;

export const connectRedis = async (): Promise<RedisClientType> => {
  if (redisClient) {
    return redisClient;
  }

  redisClient = createClient({
    url: config.redisUrl
  });

  redisClient.on("error", (error) => {
    console.error("Redis error:", error);
  });

  await redisClient.connect();
  return redisClient;
};

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error("Redis client has not been connected yet.");
  }

  return redisClient;
};

export const buildSuggestionCacheKey = (prefix: string, limit: number): string =>
  `suggest:${prefix}:${limit}`;

export const deleteKeysByPatterns = async (patterns: string[]): Promise<number> => {
  const client = getRedisClient();
  const keysToDelete = new Set<string>();

  for (const pattern of patterns) {
    let cursor = 0;

    do {
      const reply = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });

      cursor = Number(reply.cursor);

      for (const key of reply.keys) {
        keysToDelete.add(key);
      }
    } while (cursor !== 0);
  }

  if (keysToDelete.size === 0) {
    return 0;
  }

  return client.del(Array.from(keysToDelete));
};

export const closeRedis = async (): Promise<void> => {
  if (!redisClient) {
    return;
  }

  await redisClient.quit();
  redisClient = null;
};

