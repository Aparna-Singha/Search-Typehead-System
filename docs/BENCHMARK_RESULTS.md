# Benchmark Results

## Environment / Target

- Command: `npm run benchmark`
- Benchmark target: `http://localhost:3000`
- App type: local Node.js + TypeScript + Express server
- Database: PostgreSQL
- Cache: Redis
- Unique prefixes sampled: `29`
- Measured suggest rounds after warm-up: `4`
- Measured suggestion requests: `116`

## Dataset

- Dataset file: `data/search_queries.csv`
- Accepted dataset size: `199` valid curated synthetic rows
- Dataset format: `query,count`

## Suggestion Latency

| Metric | Value |
|---|---:|
| Average | 1.09 ms |
| p50 | 1.01 ms |
| p95 | 1.85 ms |
| p99 | 2.64 ms |

## Cache Behavior

| Metric | Value |
|---|---:|
| Observed cache hit rate | 80.00% |
| Cache hits during run | 116 |
| Cache lookups during run | 145 |

## Search Submission Throughput

| Metric | Value |
|---|---:|
| Total search events submitted | 120 |
| Observed throughput | 1635.45 requests/second |
| Batch flush count delta | 2 |
| Distinct DB rows written delta | 120 |
| Estimated write reduction | 1.00x fewer row-level writes than direct updates |

## Metrics Endpoint Snapshot

```json
{
  "suggestRequests": 145,
  "searchRequests": 120,
  "cacheHits": 116,
  "cacheMisses": 29,
  "cacheHitRate": 0.8,
  "batchFlushes": 2,
  "queuedWrites": 0,
  "totalSearchEvents": 120,
  "distinctRowsWritten": 120,
  "writeReductionEstimate": "0 row updates avoided (1.00x fewer row-level writes than direct updates)"
}
```

## Interpretation

Average suggestion latency was `1.09 ms`, and p95 latency was `1.85 ms` in this run. The observed cache hit rate was `80.00%`, which is consistent with a workload that warms Redis first and then measures repeated suggestion requests.

Search submission throughput was `1635.45 requests/second`. The measured write reduction was `1.00x` because the submitted search events were mostly distinct queries, so batching had little opportunity to merge duplicate row updates in the same flush window.

The batching design is still useful because it decouples request handling from database writes and flushes updates asynchronously. Write reduction becomes more visible when repeated search terms appear within the same batch window.
