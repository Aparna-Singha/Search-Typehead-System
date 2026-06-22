# Search Typeahead System

This project is an original backend implementation for an HLD101 assignment. It provides prefix-based search suggestions, batched search-count updates, recent trending queries, Redis caching, a simple browser UI, and benchmark tooling.

## Project Overview

The system suggests popular search queries as a user types. PostgreSQL is the durable source of truth, Redis is the fast cache layer, and the application keeps a memory-bounded Prefix Index in the API process for low-latency lookups.

## Features

- Prefix-based suggestion lookup using an in-memory `Map<string, Suggestion[]>`
- Top suggestions sorted by total search count
- Search submission API with batched PostgreSQL writes
- Redis-backed prefix cache for repeated suggestion lookups
- Recent trending queries tracked with Redis sorted sets
- Student-friendly frontend built with plain HTML, CSS, and JavaScript
- Seed script for loading CSV data into PostgreSQL
- Benchmark script for latency, cache behavior, and batching analysis
- Documentation for API, architecture, report content, and future scaling

## Architecture Summary

- `PostgreSQL`: persistent store for normalized search terms and counts
- `Redis`: suggestion cache and recent-activity buckets for trending
- `Express + TypeScript`: API layer and static frontend host
- `Prefix Index`: in-memory prefix map containing only the top `K` suggestions per prefix
- `Batch Writer`: aggregates repeated searches before writing to PostgreSQL

More detail is available in [docs/ARCHITECTURE.md](/Users/aparnasingha/Documents/Search Typehead System /docs/ARCHITECTURE.md).

## Project Structure

```text
search-typeahead-system/
├── README.md
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
├── data/
│   └── search_queries.csv
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── REPORT.md
│   └── SCALING.md
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── scripts/
│   ├── seed.ts
│   └── benchmark.ts
└── src/
    ├── server.ts
    ├── config.ts
    ├── db.ts
    ├── redis.ts
    ├── prefixIndex.ts
    ├── suggestionService.ts
    ├── searchService.ts
    ├── trendingService.ts
    ├── batchWriter.ts
    ├── metrics.ts
    └── types.ts
```

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Create a local environment file

```bash
cp .env.example .env
```

### 3. Start infrastructure with Docker Compose

```bash
docker compose up --build
```

Notes:

- The Compose app runs on `http://localhost:3001`.
- PostgreSQL runs on `localhost:5432`.
- Redis runs on `localhost:6379`.
- The Compose app uses port `3001` so you can still run `npm run dev` locally on `3000` without a port conflict.

### 4. Load the dataset

```bash
npm run seed
```

The seed script:

- creates the required table if it does not exist
- reads `data/search_queries.csv`
- normalizes queries with lowercase + trim + collapsed spaces
- ignores empty rows
- inserts or refreshes initial counts in PostgreSQL

### 5. Run the local development server

```bash
npm run dev
```

Local dev server:

- app URL: `http://localhost:3000`
- frontend UI: `http://localhost:3000`

If you prefer container-only execution, you can use the Compose app on `http://localhost:3001` instead of running `npm run dev`.

## Dataset Loading Instructions

The starter dataset lives in [data/search_queries.csv](/Users/aparnasingha/Documents/Search Typehead System /data/search_queries.csv). It uses the required format:

```csv
query,count
iphone 15,45222
iphone charger,44300
python tutorial,43112
machine learning,38290
```

You can replace this file with a larger CSV as long as it keeps the same header and column order.

## API Summary

- `GET /api/suggest?q=<prefix>&limit=10`
  Returns top suggestions for a prefix.
- `POST /api/search`
  Queues a searched term for batched persistence and updates recent trending activity.
- `GET /api/trending?limit=10`
  Returns recent trending searches from Redis activity buckets.
- `GET /api/metrics`
  Returns request counts, cache statistics, and batching metrics.

Full endpoint documentation is in [docs/API.md](/Users/aparnasingha/Documents/Search Typehead System /docs/API.md).

## Frontend

The frontend is served by the same Express app and uses the backend APIs directly.

Features:

- debounced suggestion lookups
- clickable suggestions
- Enter-to-search behavior
- trending search panel
- simple loading and error states

## Benchmark

Run:

```bash
npm run benchmark
```

The benchmark script reports:

- average suggestion latency
- p50 latency
- p95 latency
- p99 latency
- observed cache hit rate
- search submission throughput
- batch flush count delta
- estimated write reduction

If you are benchmarking the Compose app instead of local dev, use:

```bash
BENCHMARK_BASE_URL=http://localhost:3001 npm run benchmark
```

## Useful Commands

```bash
npm run build
npm start
npm run seed
npm run benchmark
```

## Final Submission Checklist

- `npm install` completes successfully
- `docker compose up --build` starts `app`, `postgres`, and `redis`
- `npm run seed` loads the dataset into PostgreSQL
- `npm run dev` starts the local server
- frontend loads in the browser
- all APIs respond as documented
- `npm run benchmark` produces real measurements
- documentation files are ready for conversion to PDF if needed

## Final Commit Hash

To get the final commit hash for submission:

```bash
git rev-parse HEAD
```

