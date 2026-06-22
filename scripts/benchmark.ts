import * as fs from "fs/promises";
import * as path from "path";
import { performance } from "perf_hooks";

import { config } from "../src/config";
import { normalizeQuery } from "../src/types";

type MetricsResponse = {
  suggestRequests: number;
  searchRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  batchFlushes: number;
  queuedWrites: number;
  totalSearchEvents: number;
  distinctRowsWritten: number;
  writeReductionEstimate: string;
};

const benchmarkBaseUrlCandidates = process.env.BENCHMARK_BASE_URL
  ? [process.env.BENCHMARK_BASE_URL]
  : ["http://localhost:3000", "http://localhost:3001"];

const datasetPath = path.resolve(process.cwd(), "data/search_queries.csv");

const parseLine = (line: string): string | null => {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  const separatorIndex = trimmed.lastIndexOf(",");

  if (separatorIndex <= 0) {
    return null;
  }

  return normalizeQuery(trimmed.slice(0, separatorIndex));
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const percentile = (values: number[], ratio: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
};

const timedFetch = async (
  input: string,
  init?: RequestInit
): Promise<{ durationMs: number; response: Response }> => {
  const start = performance.now();
  const response = await fetch(input, init);
  const end = performance.now();

  return {
    durationMs: end - start,
    response
  };
};

const resolveBaseUrl = async (): Promise<string> => {
  for (const candidate of benchmarkBaseUrlCandidates) {
    try {
      const response = await fetch(`${candidate}/health`);

      if (response.ok) {
        return candidate;
      }
    } catch (error) {
      void error;
    }
  }

  throw new Error(
    "Unable to reach the application. Start the server first or set BENCHMARK_BASE_URL."
  );
};

const loadDatasetQueries = async (): Promise<string[]> => {
  const csvContent = await fs.readFile(datasetPath, "utf8");
  return csvContent
    .split(/\r?\n/)
    .slice(1)
    .map(parseLine)
    .filter((value): value is string => Boolean(value));
};

const readMetrics = async (baseUrl: string): Promise<MetricsResponse> => {
  const response = await fetch(`${baseUrl}/api/metrics`);

  if (!response.ok) {
    throw new Error(`Metrics request failed with status ${response.status}`);
  }

  return (await response.json()) as MetricsResponse;
};

const warmSuggestionCache = async (baseUrl: string, prefixes: string[]): Promise<void> => {
  for (const prefix of prefixes) {
    const response = await fetch(
      `${baseUrl}/api/suggest?q=${encodeURIComponent(prefix)}&limit=${config.defaultSuggestLimit}`
    );

    if (!response.ok) {
      throw new Error(`Cache warm-up failed for prefix "${prefix}"`);
    }
  }
};

const main = async (): Promise<void> => {
  const baseUrl = await resolveBaseUrl();
  const queries = await loadDatasetQueries();
  const uniquePrefixes = Array.from(
    new Set(
      queries
        .slice(0, 30)
        .map((query, index) => query.slice(0, Math.min(query.length, 2 + (index % 5))))
        .filter((prefix) => prefix.length > 0)
    )
  );

  const metricsBefore = await readMetrics(baseUrl);
  const suggestionLatencies: number[] = [];
  const measuredRounds = 4;

  console.log(`Benchmark target: ${baseUrl}`);
  console.log(`Dataset file: ${datasetPath}`);
  console.log(`Unique prefixes sampled: ${uniquePrefixes.length}`);
  console.log(`Measured suggest rounds after warm-up: ${measuredRounds}`);
  console.log("");
  console.log("Warming suggestion cache...");

  await warmSuggestionCache(baseUrl, uniquePrefixes);

  console.log("Cache warm-up complete.");
  console.log("Running measured suggestion requests...");

  for (let round = 0; round < measuredRounds; round += 1) {
    for (const prefix of uniquePrefixes) {
      const request = await timedFetch(
        `${baseUrl}/api/suggest?q=${encodeURIComponent(prefix)}&limit=${config.defaultSuggestLimit}`
      );

      if (!request.response.ok) {
        throw new Error(`Suggest request failed for prefix "${prefix}" during round ${round + 1}`);
      }

      suggestionLatencies.push(request.durationMs);
    }
  }

  const searchEventCount = 120;
  const searchQueries = Array.from(
    { length: searchEventCount },
    (_, index) => queries[index % queries.length]
  );
  const searchStart = performance.now();

  console.log("");
  console.log("Submitting search events...");

  await Promise.all(
    searchQueries.map(async (query) => {
      const response = await fetch(`${baseUrl}/api/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`Search submission failed with status ${response.status}`);
      }
    })
  );

  const searchDurationMs = performance.now() - searchStart;
  await sleep(config.flushIntervalMs + 1000);

  const metricsAfter = await readMetrics(baseUrl);
  const cacheLookupsDelta =
    metricsAfter.cacheHits +
    metricsAfter.cacheMisses -
    (metricsBefore.cacheHits + metricsBefore.cacheMisses);
  const cacheHitsDelta = metricsAfter.cacheHits - metricsBefore.cacheHits;
  const batchFlushDelta = metricsAfter.batchFlushes - metricsBefore.batchFlushes;
  const distinctRowsWrittenDelta =
    metricsAfter.distinctRowsWritten - metricsBefore.distinctRowsWritten;
  const totalSearchEventsDelta =
    metricsAfter.totalSearchEvents - metricsBefore.totalSearchEvents;
  const cacheHitRate =
    cacheLookupsDelta === 0 ? 0 : cacheHitsDelta / cacheLookupsDelta;
  const writeReductionRatio =
    distinctRowsWrittenDelta === 0 ? 0 : totalSearchEventsDelta / distinctRowsWrittenDelta;
  const throughputPerSecond = searchEventCount / (searchDurationMs / 1000);

  console.log("");
  console.log("Suggestion latency");
  console.log(`Average: ${average(suggestionLatencies).toFixed(2)} ms`);
  console.log(`p50: ${percentile(suggestionLatencies, 0.5).toFixed(2)} ms`);
  console.log(`p95: ${percentile(suggestionLatencies, 0.95).toFixed(2)} ms`);
  console.log(`p99: ${percentile(suggestionLatencies, 0.99).toFixed(2)} ms`);
  console.log(`Measured requests: ${suggestionLatencies.length}`);
  console.log("");
  console.log("Cache behavior");
  console.log(`Observed cache hit rate: ${(cacheHitRate * 100).toFixed(2)}%`);
  console.log(`Cache hits during run: ${cacheHitsDelta}`);
  console.log(`Cache lookups during run: ${cacheLookupsDelta}`);
  console.log("");
  console.log("Search submission");
  console.log(`Total search events submitted: ${searchEventCount}`);
  console.log(`Observed throughput: ${throughputPerSecond.toFixed(2)} requests/second`);
  console.log(`Batch flush count delta: ${batchFlushDelta}`);
  console.log(`Distinct DB rows written delta: ${distinctRowsWrittenDelta}`);
  console.log(
    `Estimated write reduction: ${
      writeReductionRatio === 0
        ? "No flush captured during the benchmark window."
        : `${writeReductionRatio.toFixed(2)}x fewer row-level writes than direct updates`
    }`
  );
  console.log("");
  console.log("Metrics endpoint snapshot");
  console.log(JSON.stringify(metricsAfter, null, 2));
};

main().catch((error) => {
  console.error("Benchmark failed.", error);
  process.exit(1);
});
