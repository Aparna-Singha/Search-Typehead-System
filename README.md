# PrefixPulse: Search Typeahead System

PrefixPulse is a student-friendly HLD101 backend project for search typeahead and autocomplete. It keeps the original architecture intentionally simple: PostgreSQL stores durable counts, Redis speeds up hot reads, an in-memory Prefix Index handles fast prefix lookup, and a batch writer reduces repeated database updates when users submit searches.

## Overview

The system suggests popular queries as the user types, records submitted searches, tracks recent trending activity, and exposes a small frontend for demonstration. It also includes a benchmark script, lightweight automated tests, and an optional consistent-hashing simulation endpoint for HLD scalability discussion.

## Features

- Prefix-based typeahead lookup using an in-memory `Map<string, Suggestion[]>`
- Suggestions sorted by total search count
- Search submission API with batched PostgreSQL UPSERT writes
- Redis suggestion caching with TTL-based reuse
- Recent trending queries powered by Redis sorted-set buckets
- Plain HTML, CSS, and JavaScript frontend with keyboard-friendly suggestions
- Seed script for loading `data/search_queries.csv`
- Benchmark script for real latency and batching measurements
- Lightweight unit tests for core logic
- Optional consistent-hashing cache-routing demo for scalability explanation

## Architecture Summary

Current architecture:

`Frontend UI -> Express TypeScript backend -> Redis cache -> in-memory Prefix Index fallback -> PostgreSQL source of truth -> batch writer for search count updates`

Supporting pieces:

- `Redis sorted sets`: trending search activity
- `Metrics endpoint`: request, cache, and batching counters
- `Optional cache-routing simulation`: HLD extension only, not part of the live suggest path

More detail is available in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech Stack

- Node.js
- TypeScript
- Express.js
- PostgreSQL
- Redis
- Docker Compose
- Vitest
- Plain HTML, CSS, JavaScript

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Create a local environment file

```bash
cp .env.example .env
```

### 3. Start local infrastructure

```bash
docker compose up --build
```

Compose services:

- `app` on `http://localhost:3001`
- `postgres` on `localhost:5432`
- `redis` on `localhost:6379`

The Compose app uses port `3001`, so you can still run `npm run dev` locally on `3000`.

### 4. Load the dataset

```bash
npm run seed
```

### 5. Run the local development server

```bash
npm run dev
```

Local dev app:

- backend + frontend on `http://localhost:3000`

## Docker Instructions

Use Docker when you want the full three-service setup defined in `docker-compose.yml`.

Typical flow:

```bash
docker compose up --build
npm run seed
```

Quick verification after startup:

```bash
curl "http://localhost:3001/health"
curl "http://localhost:3001/api/suggest?q=iph&limit=5"
curl "http://localhost:3001/api/trending?limit=5"
```

## Dataset Loading Instructions

The dataset lives in [data/search_queries.csv](data/search_queries.csv).

This dataset is a curated sample dataset created for this assignment. It contains common search-style queries with synthetic frequency counts and is used to demonstrate autocomplete ranking, caching, trending updates, and batch write behavior.

Seed behavior:

- dataset path: `data/search_queries.csv`
- dataset size: about 200 rows
- format: `query,count`
- frequency counts are synthetic positive integers
- creates the required table if needed
- reads CSV rows from `data/search_queries.csv`
- normalizes queries by lowercasing, trimming, and collapsing whitespace
- ignores empty queries
- ignores invalid counts
- inserts or refreshes counts in PostgreSQL

To reload the dataset after editing the CSV:

```bash
npm run seed
```

## API Summary

- `GET /api/suggest?q=<prefix>&limit=10`
  Returns prefix suggestions from Redis cache or the Prefix Index.
- `POST /api/search`
  Accepts a search query, queues it for batched persistence, and updates trending activity.
- `GET /api/trending?limit=10`
  Returns recent trending queries.
- `GET /api/metrics`
  Returns runtime counters for cache and batching behavior.
- `GET /api/cache-routing?key=<cacheKey>`
  Demonstrates consistent-hashing key routing for HLD scaling discussion only.

Full endpoint documentation is in [docs/API.md](docs/API.md).

## Frontend Usage

The frontend is served by Express from `public/`.

Available interactions:

- type into the search box to fetch suggestions
- use the clear button to reset the input
- use arrow keys to move through suggestions
- press Enter to submit the highlighted suggestion or current input
- click any suggestion to submit it directly
- refresh the Trending tab from the UI
- inspect the Metrics tab for request, cache, and batch-write signals
- inspect the Routing tab for consistent-hashing cache-routing simulation

## Screenshots

Capture these screenshots after running the app locally. The paths below are placeholders for submission packaging and should only be populated after you save real screenshots from the dark tabbed dashboard.

- `docs/screenshots/01-search-home.png`
- `docs/screenshots/02-suggestions-iph.png`
- `docs/screenshots/03-suggestions-py.png`
- `docs/screenshots/04-cache-hit.png`
- `docs/screenshots/05-trending-tab.png`
- `docs/screenshots/06-metrics-tab.png`
- `docs/screenshots/07-routing-tab.png`

Suggested capture flow:

1. Open `http://localhost:3000`
2. Capture the Search tab with an empty input
3. Type `iph`, `py`, and another repeated prefix to show cache behavior
4. Submit a search like `iphone 15` and capture the Trending tab
5. Capture the Metrics tab and Routing tab

## Benchmark Instructions

Run:

```bash
npm run benchmark
```

If you want to benchmark the Docker app instead of local dev:

```bash
BENCHMARK_BASE_URL=http://localhost:3001 npm run benchmark
```

Results should be copied into [docs/BENCHMARK_RESULTS.md](docs/BENCHMARK_RESULTS.md) after an actual run. The repository intentionally keeps placeholders instead of invented numbers.

## Testing Instructions

Run:

```bash
npm test
```

Current tests focus on:

- Prefix Index prefix lookup and ordering
- query normalization
- duplicate aggregation in the batch writer
- deterministic consistent-hash routing behavior

## Report / PDF Instructions

Submission-friendly documents:

- [docs/API.md](docs/API.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/REPORT.md](docs/REPORT.md)
- [docs/BENCHMARK_RESULTS.md](docs/BENCHMARK_RESULTS.md)
- screenshot placeholders under `docs/screenshots/`

You can convert `docs/REPORT.md` into PDF after filling in the real benchmark observations.

## Final Submission Checklist

- `npm install` completes successfully
- `docker compose up --build` starts only `app`, `postgres`, and `redis`
- `npm run seed` loads the dataset
- `npm run dev` starts the local development server
- `npm test` passes
- `npm run benchmark` runs against a live server and produces real measurements
- README and report docs are ready for submission
- benchmark placeholders are replaced only after a real run

## Final Commit Hash

To get the final commit hash for submission:

```bash
git rev-parse HEAD
```
