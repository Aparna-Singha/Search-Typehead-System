import express, { NextFunction, Request, Response } from "express";
import * as path from "path";

import { BatchWriter } from "./batchWriter";
import { config } from "./config";
import { ConsistentHashRing } from "./consistentHash";
import { closeDatabase, initSchema, loadAllSearchTerms } from "./db";
import { MetricsTracker } from "./metrics";
import { PrefixIndex } from "./prefixIndex";
import { closeRedis, connectRedis, getRedisClient } from "./redis";
import { SearchService } from "./searchService";
import { SuggestionService } from "./suggestionService";
import { TrendingService } from "./trendingService";

const app = express();
const metrics = new MetricsTracker();
const prefixIndex = new PrefixIndex();
const batchWriter = new BatchWriter(prefixIndex, metrics);
const cacheRoutingRing = new ConsistentHashRing(100);

for (const nodeId of ["cache-node-a", "cache-node-b", "cache-node-c"]) {
  cacheRoutingRing.addNode(nodeId);
}

let indexReloadPromise: Promise<void> | null = null;

const ensureIndexLoaded = async (): Promise<void> => {
  if (!prefixIndex.isEmpty()) {
    return;
  }

  if (!indexReloadPromise) {
    indexReloadPromise = (async () => {
      const searchTerms = await loadAllSearchTerms();
      prefixIndex.build(searchTerms);
    })().finally(() => {
      indexReloadPromise = null;
    });
  }

  await indexReloadPromise;
};

const asyncHandler =
  (
    handler: (request: Request, response: Response, next: NextFunction) => Promise<void> | void
  ) =>
  (request: Request, response: Response, next: NextFunction): void => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };

app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    indexedTerms: prefixIndex.size()
  });
});

app.get(
  "/api/suggest",
  asyncHandler(async (request, response) => {
    const redisClient = getRedisClient();
    const suggestionService = new SuggestionService(
      redisClient,
      prefixIndex,
      metrics,
      ensureIndexLoaded
    );

    const result = await suggestionService.getSuggestions(request.query.q, request.query.limit);
    response.json(result);
  })
);

app.post(
  "/api/search",
  asyncHandler(async (request, response) => {
    const redisClient = getRedisClient();
    const trendingService = new TrendingService(redisClient, prefixIndex);
    const searchService = new SearchService(batchWriter, trendingService, metrics);
    const result = await searchService.acceptSearch(request.body?.query);
    response.status(202).json(result);
  })
);

app.get(
  "/api/trending",
  asyncHandler(async (request, response) => {
    const redisClient = getRedisClient();
    const trendingService = new TrendingService(redisClient, prefixIndex);
    const rawLimit =
      typeof request.query.limit === "string"
        ? Number(request.query.limit)
        : config.defaultSuggestLimit;

    response.json(await trendingService.getTrending(rawLimit));
  })
);

app.get("/api/metrics", (_request, response) => {
  response.json(metrics.getSnapshot());
});

app.get("/api/cache-routing", (request, response) => {
  const key = typeof request.query.key === "string" ? request.query.key.trim() : "";

  if (!key) {
    response.status(400).json({
      error: "Query parameter 'key' is required."
    });
    return;
  }

  response.json({
    key,
    selectedNode: cacheRoutingRing.getNode(key),
    replicas: cacheRoutingRing.getReplicaCount(),
    strategy: "consistent_hashing_simulation",
    note:
      "The main app uses one Redis instance locally. This endpoint demonstrates how cache keys can be distributed across multiple cache nodes in a scaled design."
  });
});

const publicDirectory = path.join(process.cwd(), "public");
app.use(express.static(publicDirectory));

app.get("/", (_request, response) => {
  response.sendFile(path.join(publicDirectory, "index.html"));
});

app.use(
  (error: Error & { statusCode?: number }, _request: Request, response: Response, _next: NextFunction) => {
    const statusCode = error.statusCode ?? 500;

    response.status(statusCode).json({
      error: error.message || "Internal Server Error"
    });
  }
);

let server: ReturnType<typeof app.listen> | null = null;

const startServer = async (): Promise<void> => {
  await connectRedis();
  await initSchema();

  const initialSearchTerms = await loadAllSearchTerms();
  prefixIndex.build(initialSearchTerms);
  batchWriter.start();

  server = app.listen(config.port, () => {
    console.log(`Search Typeahead System is running on http://localhost:${config.port}`);
  });
};

const shutdown = async (): Promise<void> => {
  if (server) {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
  }

  await batchWriter.stop();
  await closeRedis();
  await closeDatabase();
};

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

startServer().catch((error) => {
  console.error("Server failed to start.", error);
  process.exit(1);
});
