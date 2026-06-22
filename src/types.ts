export interface Suggestion {
  query: string;
  count: number;
}

export interface SearchTermRecord {
  id?: number;
  query: string;
  count: number;
  recentScore: number;
  updatedAt?: Date;
}

export interface TrendingSuggestion {
  query: string;
  score: number;
}

export interface MetricsSnapshot {
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
}

export const normalizeQuery = (value: string): string =>
  value.toLowerCase().trim().replace(/\s+/g, " ");

export const buildPrefixes = (query: string): string[] => {
  const prefixes: string[] = [];

  for (let index = 1; index <= query.length; index += 1) {
    prefixes.push(query.slice(0, index));
  }

  return prefixes;
};

export const compareSuggestions = (left: Suggestion, right: Suggestion): number =>
  right.count - left.count || left.query.localeCompare(right.query);

export const clampLimit = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
};

