# PrefixPulse

PrefixPulse is an HLD101 Search Typeahead / Autocomplete System built with Node.js, TypeScript, and Express. It uses PostgreSQL for durable query counts, Redis for suggestion caching and recent trending activity, and an in-memory Prefix Index for fast prefix lookup.

## Project Summary

The project demonstrates a local typeahead system with:

- prefix-based suggestion lookup
- batched search-write persistence
- Redis-backed caching
- recent trending aggregation
- a plain HTML/CSS/JavaScript demo frontend served from `public/`
- a consistent-hashing routing demo for HLD discussion

The consistent-hashing route is a simulation only. The local app itself uses one Redis instance.

## Features

- `GET /api/suggest` returns ranked suggestions for a prefix
- `POST /api/search` accepts a search and queues it for batched persistence
- `GET /api/trending` returns recent trending queries from Redis activity buckets
- `GET /api/metrics` exposes request, cache, and batching counters
- `GET /api/cache-routing` demonstrates how a cache key could be routed in a scaled design
- `GET /api/health` returns a simple health response
- keyboard-friendly frontend for suggestions, trending, metrics, and cache-routing demo

## Architecture Summary

Local flow:

`Browser -> Express server -> Redis cache / in-memory Prefix Index -> PostgreSQL`

Key points:

- PostgreSQL stores persistent query counts in `search_terms`
- Redis caches suggestion results and stores recent trending bucket activity
- the Prefix Index keeps top suggestions per prefix in memory
- submitted searches are queued and written in batches
- cache invalidation runs after each successful batch flush

More detail is available in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SCALING.md](docs/SCALING.md).

## Tech Stack

- Node.js
- TypeScript
- Express
- PostgreSQL
- Redis
- plain HTML, CSS, and JavaScript
- Docker Compose
- Vitest

## Folder Structure

```text
.
|-- data/
|   `-- search_queries.csv
|-- docs/
|   |-- API.md
|   |-- ARCHITECTURE.md
|   |-- BENCHMARK_RESULTS.md
|   |-- REPORT.md
|   |-- SCALING.md
|   `-- screenshots/
|-- public/
|-- scripts/
|   |-- benchmark.ts
|   `-- seed.ts
|-- src/
|-- tests/
|-- docker-compose.yml
`-- README.md
```

## Dataset

The dataset is stored at [data/search_queries.csv](data/search_queries.csv).

The dataset is a curated sample dataset created for this assignment. It contains common search-style queries with synthetic frequency counts and is used to demonstrate autocomplete ranking, caching, trending updates, and batch write behavior.

Dataset facts:

- path: `data/search_queries.csv`
- accepted size: `199` valid curated synthetic rows
- format: `query,count`
- seed script normalizes queries, skips empty rows, and skips invalid counts

## Setup

### Prerequisites

- Node.js
- npm
- Docker Desktop or compatible Docker Engine

### Install dependencies

```bash
npm install
```

### Create a local environment file

```bash
cp .env.example .env
```

### Start PostgreSQL and Redis with Docker

```bash
docker compose up -d postgres redis
```

### Seed the dataset

```bash
npm run seed
```

### Run the development server

```bash
npm run dev
```

Open the app at:

```text
http://localhost:3000
```

## Running the Full Docker App

If you want the Node.js app to run in Docker too:

```bash
docker compose up -d --build
```

Container ports:

- app: `http://localhost:3001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Quick verification:

```bash
curl "http://localhost:3001/api/health"
curl "http://localhost:3001/api/suggest?q=iph&limit=5"
curl "http://localhost:3001/api/trending?limit=5"
```

Note:

- the benchmark script probes `/health` internally
- the app now also exposes `/api/health` for API-style documentation and manual checks

## Common Commands

Build:

```bash
npm run build
```

Test:

```bash
npm test
```

Benchmark:

```bash
npm run benchmark
```

Benchmark against the Docker app:

```bash
BENCHMARK_BASE_URL=http://localhost:3001 npm run benchmark
```

## Verification Commands

```bash
npm run build
npm test
npm run benchmark
```

## Benchmark Summary

Benchmark command used:

```powershell
npm run benchmark
```

Measured results:

| Metric | Result |
|---|---:|
| Average suggestion latency | 1.09 ms |
| p50 latency | 1.01 ms |
| p95 latency | 1.85 ms |
| p99 latency | 2.64 ms |
| Cache hit rate | 80.00% |
| Search submission throughput | 1635.45 requests/sec |
| Search events submitted | 120 |
| Batch flush count delta | 2 |
| Tests | 8 passed |

This benchmark targeted `http://localhost:3000`, sampled `29` unique prefixes, and measured `116` suggestion requests after cache warm-up. In this run, write reduction was `1.00x` because the submitted search events were mostly distinct queries. Batching still helps by decoupling request handling from database writes and becomes more beneficial when repeated queries arrive within the same flush window.

## API Endpoint Summary

- `GET /api/health`
  Returns `{ "status": "ok", "indexedTerms": number }`.
- `GET /api/suggest?q=<prefix>&limit=5`
  Returns ranked suggestions from Redis cache or the Prefix Index.
- `POST /api/search`
  Accepts a query, updates Redis trending activity, and queues the write for batch persistence.
- `GET /api/trending?limit=5`
  Returns recent trending searches.
- `GET /api/metrics`
  Returns runtime counters for cache and batch behavior.
- `GET /api/cache-routing?key=suggest:iph:10`
  Returns the simulated consistent-hash routing target for a cache key.

Full request and response examples are in [docs/API.md](docs/API.md).

## Frontend

The frontend is served from `public/` by the Express app. It includes:

- a search input with keyboard navigation
- a suggestion list
- a recent trending panel
- metrics cards
- a consistent-hashing demo card that works with raw cache keys such as `suggest:iph:10`

## Screenshots

Project screenshots are stored in `docs/screenshots/`.

| Screenshot | Description |
|---|---|
| `home.png` | Main PrefixPulse dashboard with the hero section, system badges, and search console. |
| `suggestions-iph.png` | Autocomplete suggestions for the prefix `iph`, showing ranked iPhone-related queries. |
| `suggestions-py.png` | Autocomplete suggestions for the prefix `py`, showing ranked Python-related queries. |
| `trending.png` | Trending searches section populated from recent Redis activity. |
| `metrics-dashboard.png` | Request insights, cache statistics, batch write metrics, and system architecture summary. |
| `cache-routing.png` | Consistent hashing demo showing how a cache key is mapped to a logical cache node. |
| `benchmark.png` | Real benchmark output showing suggestion latency, cache hit rate, throughput, and metrics snapshot. |

## HLD / Scaling Note

PrefixPulse is a local assignment demo, not a distributed production deployment.

- the live local app uses one Redis instance
- the `cache-routing` endpoint is an HLD simulation only
- the Prefix Index is process-local
- the batch queue is in memory until flush time

See [docs/SCALING.md](docs/SCALING.md) for scale-out options and tradeoffs.

## Limitations and Tradeoffs

- queued writes are not durable until a batch flush succeeds
- the Prefix Index must be rebuilt or synchronized across multiple app replicas
- suggestion freshness is slightly delayed by batching and cache TTL
- trending is based on recent Redis buckets, so it is intentionally approximate
- cache invalidation uses prefix-based key deletion patterns after batch updates

## Documentation Index

- [docs/API.md](docs/API.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/REPORT.md](docs/REPORT.md)
- [docs/SCALING.md](docs/SCALING.md)
- [docs/BENCHMARK_RESULTS.md](docs/BENCHMARK_RESULTS.md)
- [docs/screenshots/README.md](docs/screenshots/README.md)

## Verification Status

- `npm run build` passed
- `npm test` passed
- Vitest: `4` test files passed and `8` tests passed
