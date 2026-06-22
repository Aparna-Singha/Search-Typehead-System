# Project Report

## 1. Architecture Diagram and Explanation

The system uses a layered design:

- `PostgreSQL` stores durable search-term data
- `Redis` accelerates repeated reads and holds recent trending activity
- `Express` exposes the APIs and serves the frontend
- an in-memory `Prefix Index` provides fast prefix lookup without scanning the database on each request
- a `Batch Writer` reduces write amplification by merging repeated search events before persistence

Refer to [ARCHITECTURE.md](ARCHITECTURE.md) for the Mermaid diagram and detailed path explanations.

## 2. Dataset Source and Loading Instructions

The starter dataset is included locally in [data/search_queries.csv](../data/search_queries.csv). It is a hand-prepared development dataset meant to satisfy the assignment format and provide a clean baseline for testing.

CSV format:

```csv
query,count
iphone 15,45222
iphone charger,44300
python tutorial,43112
machine learning,38290
```

Loading steps:

1. Start PostgreSQL and Redis.
2. Run `npm run seed`.
3. The seed script creates the table if needed.
4. Queries are normalized before insertion.
5. Empty rows are ignored.
6. Seeded rows are inserted or refreshed in PostgreSQL.

## 3. API Documentation

Implemented endpoints:

- `GET /api/suggest`
- `POST /api/search`
- `GET /api/trending`
- `GET /api/metrics`

Full request and response details are documented in [API.md](API.md).

## 4. Design Choices and Tradeoffs

### Why PostgreSQL

- durable source of truth
- reliable UPSERT support
- easy to inspect during development

### Why Redis

- low-latency suggestion cache
- lightweight sorted-set support for recent activity
- good fit for short-lived derived data

### Why Prefix Index

- direct prefix lookup from memory
- simpler to explain and review than a Trie for this assignment
- bounded memory because each prefix keeps only the top `K` suggestions

### Why Batching

- reduces repeated database writes during bursts
- allows quick API responses on search submission
- makes duplicate searches cheaper when they occur in the same flush window

### Key Tradeoffs

- Freshness vs write efficiency:
  Counts are slightly delayed until the batch writer flushes.
- Memory usage vs lookup speed:
  The Prefix Index uses more RAM than a database-only solution, but it avoids scanning rows on every suggestion lookup.
- Cache TTL vs stale reads:
  Longer TTL improves hit rate, but stale suggestions can live a little longer.
- Recent activity vs total count:
  Trending uses recent activity so the list can react to new behavior, while total count is used only as a tie-breaker.

## 5. Performance Report

This repository intentionally does not include invented benchmark numbers.

Use:

```bash
npm run benchmark
```

Suggested table to fill with observed output:

| Metric | Observed Value | Notes |
| --- | --- | --- |
| Average suggestion latency | Fill after run | Measured by benchmark script |
| p50 latency | Fill after run | Measured by benchmark script |
| p95 latency | Fill after run | Measured by benchmark script |
| p99 latency | Fill after run | Measured by benchmark script |
| Cache hit rate | Fill after run | Based on runtime metrics delta |
| Search throughput | Fill after run | Requests per second |
| Batch flush count | Fill after run | From `/api/metrics` delta |
| Write reduction estimate | Fill after run | Derived from search events vs distinct rows written |

## 6. Limitations and Future Improvements

Current limitations:

- the Prefix Index lives in a single API process, so it is not shared across servers
- cache invalidation uses Redis key scans, which is acceptable for this assignment but not ideal at larger scale
- recent trending is approximate because it uses bucketed windows instead of a perfect sliding window
- batch updates can be lost if the API process crashes before the next flush

Future improvements:

- use Kafka or RabbitMQ for durable write buffering
- shard or externalize the prefix structure for multi-node consistency
- add richer analytics for hot prefixes and query conversion
- add automated tests for services and API routes
