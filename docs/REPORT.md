# PrefixPulse: Search Typeahead System

**Student Name:** Aparna Singha  
**Roll Number:** 24BCS10353  
**Course:** HLD101

## 1. Architecture Diagram and Explanation

PrefixPulse follows the required layered design:

- frontend UI for user interaction
- Express + TypeScript backend for APIs and static asset serving
- Redis for low-latency cache reads and trending activity buckets
- in-memory Prefix Index as the main prefix lookup structure
- PostgreSQL as the durable source of truth
- batch writer for grouped search-count updates

The detailed diagram and read/write path explanation are documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## 2. Dataset Source and Loading Instructions

The starter dataset is stored in [data/search_queries.csv](../data/search_queries.csv). It is included in the repository as a clean local dataset for assignment demonstration and testing.

Loading flow:

1. Start PostgreSQL and Redis.
2. Run `npm run seed`.
3. The seed script creates the `search_terms` table if it is missing.
4. Queries are normalized before insert or update.
5. Empty queries are ignored.
6. Seeded rows become available for startup index loading.

## 3. API Documentation Summary

Main endpoints:

- `GET /api/suggest`
- `POST /api/search`
- `GET /api/trending`
- `GET /api/metrics`
- `GET /api/cache-routing`

The `cache-routing` endpoint is only an HLD simulation endpoint. It does not replace the live Redis cache used by `/api/suggest`.

Full endpoint details are available in [API.md](API.md).

## 4. Design Choices and Tradeoffs

### Why PostgreSQL

- provides durable storage for normalized search terms
- supports simple and reliable UPSERT behavior
- fits the source-of-truth role well for a backend assignment

### Why Redis

- reduces repeated work for hot suggestion prefixes
- supports sorted-set operations for recent trending activity
- keeps fast-changing derived data outside the database hot path

### Why Prefix Index

- provides direct lookup for normalized prefixes
- is simpler to explain than a Trie-based implementation for this submission
- limits memory usage by keeping only the top `K` suggestions per prefix

### Why Batching

- reduces repeated database writes during traffic bursts
- keeps search submission latency low
- combines duplicate queries inside the same flush window

### Tradeoffs

- freshness vs efficiency:
  counts are slightly delayed until the next flush completes
- memory vs lookup speed:
  the Prefix Index uses memory to avoid repeated database scans
- cache TTL vs staleness:
  longer TTL can improve hit rate but may serve slightly older suggestions
- recent activity vs lifetime popularity:
  trending uses recent activity so the list can react to what users are searching now

## 5. Performance Report

This report intentionally avoids invented benchmark numbers.

Use:

```bash
npm run benchmark
```

Record the actual results in [BENCHMARK_RESULTS.md](BENCHMARK_RESULTS.md) after running the benchmark on a live setup.

Suggested measurements to capture:

- average suggestion latency
- p50 latency
- p95 latency
- p99 latency
- cache hit rate
- total search events submitted
- batch flush count
- estimated write reduction

## 6. Consistent Hashing HLD Extension

The repository includes an optional `ConsistentHashRing` simulation in `src/consistentHash.ts`.

Purpose:

- demonstrate how cache keys could be distributed across multiple cache nodes in a scaled design
- support HLD discussion without changing the actual local architecture

Important boundaries:

- the main app still uses a single Redis instance locally
- `/api/suggest` does not depend on the consistent-hashing module
- `GET /api/cache-routing` is an explanatory endpoint only

## 7. Limitations

- the Prefix Index is process-local and not shared across multiple API servers
- cache invalidation currently scans matching suggestion keys
- recent trending is approximate because it is bucket-based
- queued writes are in memory until the next successful flush

## 8. Future Improvements

- move batched writes to Kafka or RabbitMQ for stronger durability
- synchronize prefix updates across multiple API servers
- add broader integration testing around API routes
- extend benchmark runs with repeated multi-round datasets

## 9. Conclusion

PrefixPulse meets the assignment goals while keeping the implementation readable, modular, and easy to explain. The system balances low-latency reads, durable persistence, recent trending behavior, and write-efficiency through batching, while also including testing and an optional HLD scalability demonstration.
