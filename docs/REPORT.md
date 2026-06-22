# PrefixPulse: HLD101 Search Typeahead / Autocomplete System

**Student Name:** Aparna Singha  
**Roll Number:** 24BCS10353  
**Course:** HLD101

## 1. Problem Statement

The assignment requires a search typeahead / autocomplete backend that can:

- return suggestions quickly for a typed prefix
- accept search submissions
- persist durable popularity counts
- demonstrate caching and scaling ideas

PrefixPulse implements this using Node.js, TypeScript, Express, PostgreSQL, Redis, and an in-memory Prefix Index.

## 2. System Goals

Primary goals:

- low-latency prefix lookup
- durable storage of search counts
- simple local deployment for demonstration
- recent trending behavior
- fewer direct database writes during bursts

Non-goals for this local assignment:

- multi-region deployment
- real distributed cache sharding in local runtime
- fully durable event streaming

## 3. Implemented Architecture

The system has these main parts:

- frontend in plain HTML/CSS/JavaScript served from `public/`
- Express API server written in TypeScript
- PostgreSQL for persistent query counts
- Redis for suggestion caching and recent trending buckets
- in-memory Prefix Index for fast lookup
- in-memory batch queue for grouped writes

Detailed read/write flow is documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## 4. Prefix Index Design

The Prefix Index is implemented as:

```text
Map<string, Suggestion[]>
```

For each normalized query:

- all prefixes are generated
- each prefix stores only the top suggestions
- sorting is based on descending count and then alphabetical query order

Why this design was chosen:

- simpler to implement and explain than a Trie
- fast direct lookup
- good fit for a small curated assignment dataset

## 5. Redis Caching Flow

Redis supports two features:

- suggestion caching
- trending activity aggregation

Suggestion flow:

1. `GET /api/suggest` checks Redis first.
2. On a cache hit, the cached suggestions are returned.
3. On a miss, the Prefix Index is used.
4. The result is written back to Redis with TTL.

This keeps hot prefixes fast without making Redis the source of truth.

## 6. PostgreSQL Persistence

PostgreSQL stores normalized terms in the `search_terms` table.

Stored fields include:

- query text
- total count
- recent score
- update timestamp

The seed process loads the initial dataset, and later search submissions are applied through batched UPSERT updates.

## 7. Batch Write Strategy

Search submissions are not written to PostgreSQL one by one.

Instead:

- accepted searches are placed into an in-memory queue
- duplicate queries are aggregated
- flush happens on timer or queue threshold
- the batch writer updates PostgreSQL and refreshes the Prefix Index
- affected Redis suggestion keys are invalidated

Benefits:

- fewer repeated row updates
- faster `POST /api/search` responses

Tradeoff:

- writes are not durable until flush completes

## 8. Trending Strategy

Recent trending is based on Redis sorted-set buckets.

- each search increments the current bucket
- older buckets expire automatically
- `GET /api/trending` aggregates recent buckets
- lifetime count from the Prefix Index is used only as a tie-breaker

This makes the trending view react to current search activity instead of historical popularity alone.

## 9. API Behavior

Implemented routes:

- `GET /api/health`
- `GET /api/suggest?q=<prefix>&limit=5`
- `POST /api/search`
- `GET /api/trending?limit=5`
- `GET /api/metrics`
- `GET /api/cache-routing?key=suggest:iph:10`

The cache-routing endpoint is not part of the live data path. It exists only for HLD explanation.

Full examples are in [API.md](API.md).

## 10. Dataset Details

Dataset path:

- `data/search_queries.csv`

Dataset facts:

- `199` valid curated synthetic rows
- format: `query,count`
- queries are normalized during seeding
- invalid rows are skipped

Dataset description:

The dataset is a curated sample dataset created for this assignment. It contains common search-style queries with synthetic frequency counts and is used to demonstrate autocomplete ranking, caching, trending updates, and batch write behavior.

## 11. Consistent Hashing Simulation

The project includes a consistent-hashing demo endpoint:

- `GET /api/cache-routing?key=suggest:iph:10`

Purpose:

- explain how cache keys could be distributed across logical cache nodes
- support scaling discussion in HLD terms

Important limitation:

- the local app still uses one Redis instance
- live suggestion requests do not use the consistent-hash ring

## 12. Performance and Benchmarking

The benchmark was run with:

```powershell
npm run benchmark
```

Measured benchmark summary:

| Metric | Value |
|---|---:|
| Benchmark target | `http://localhost:3000` |
| Unique prefixes sampled | 29 |
| Measured suggestion requests | 116 |
| Average suggestion latency | 1.09 ms |
| p50 latency | 1.01 ms |
| p95 latency | 1.85 ms |
| p99 latency | 2.64 ms |
| Observed cache hit rate | 80.00% |
| Search events submitted | 120 |
| Search submission throughput | 1635.45 requests/second |
| Batch flush count delta | 2 |
| Distinct DB rows written delta | 120 |
| Estimated write reduction | 1.00x |

In this benchmark run, the batch writer flushed search events asynchronously, but the measured write reduction was 1.00x because the submitted queries were mostly distinct. The batching design is still useful because it decouples request handling from database writes and can reduce row-level updates when repeated queries arrive within the same flush window.

The full benchmark snapshot is documented in [BENCHMARK_RESULTS.md](BENCHMARK_RESULTS.md).

## 13. Build and Test Verification

Verification status:

- `npm run build` passed
- `npm test` passed
- Vitest test files passed: `4`
- Vitest tests passed: `8`

Passed test files:

- `tests/batchWriter.test.ts`
- `tests/consistentHash.test.ts`
- `tests/prefixIndex.test.ts`
- `tests/types.test.ts`

## 14. Failure Handling

Current behavior:

- Redis suggestion lookup failure falls back to the Prefix Index
- Redis cache write failure does not block a response
- Redis trending update failure does not reject a search
- batch flush failure restores the in-memory queue for retry

This is good enough for a local assignment demo, but not a substitute for a durable event pipeline.

## 15. Screenshots and Proof

Required screenshot references:

- `home.png`
- `suggestions-iph.png`
- `suggestions-py.png`
- `trending.png`
- `metrics-dashboard.png`
- `cache-routing.png`
- `benchmark.png`

Optional proof screenshots such as `cache-hit.png`, `docker-healthy.png`, and `seed-success.png` should only be referenced if those files actually exist.

## 16. Limitations

- Prefix Index is process-local
- local deployment uses one Redis instance
- queued writes are in memory until flush
- cache invalidation is prefix-pattern based
- trending is approximate by recent bucket aggregation

## 17. Future Improvements

- durable event queue with Kafka or RabbitMQ
- multi-instance Prefix Index synchronization
- broader route-level integration testing
- more benchmark runs across larger datasets and repeated rounds

## 18. Conclusion

PrefixPulse meets the HLD101 assignment goals with a clean local design that is easy to explain and verify. It combines fast in-memory lookup, Redis caching, Redis-based recent trending, PostgreSQL persistence, and batched updates, while clearly separating implemented behavior from higher-level scaling demonstrations.
