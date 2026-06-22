# API Documentation

PrefixPulse exposes a small HTTP API for health checks, suggestions, search submission, trending, metrics, and the HLD cache-routing demo.

Notes:

- examples use `http://localhost:3000`
- `limit` values are clamped by server configuration
- the examples below use `limit=5` for readability
- the live local deployment uses one Redis instance
- `GET /api/cache-routing` is a simulation endpoint only

## `GET /api/health`

- Endpoint: `/api/health`
- Method: `GET`
- Purpose: returns a simple health status and current in-memory index size

Example cURL:

```bash
curl "http://localhost:3000/api/health"
```

Example response:

```json
{
  "status": "ok",
  "indexedTerms": 199
}
```

Status codes:

- `200`: health returned successfully

Implementation note:

- the app also keeps `/health` for internal checks such as Docker health probes and benchmark discovery

## `GET /api/suggest`

- Endpoint: `/api/suggest?q=<prefix>&limit=5`
- Method: `GET`
- Purpose: returns ranked suggestions for a normalized prefix

Query parameters:

- `q`: prefix text
- `limit`: optional result size

Example cURL:

```bash
curl "http://localhost:3000/api/suggest?q=iph&limit=5"
```

Example response:

```json
{
  "prefix": "iph",
  "source": "cache",
  "suggestions": [
    { "query": "iphone 15", "count": 45222 },
    { "query": "iphone charger", "count": 44300 }
  ]
}
```

Behavior notes:

- prefix input is lowercased, trimmed, and whitespace-normalized
- Redis is checked first
- on a cache miss, the Prefix Index is used and the response is cached
- if `q` is empty, the service returns popular searches

Status codes:

- `200`: suggestions returned successfully
- `500`: unexpected server error

## `POST /api/search`

- Endpoint: `/api/search`
- Method: `POST`
- Purpose: accepts a query, records recent trending activity in Redis, and queues the write for batched PostgreSQL persistence

Request body:

```json
{
  "query": "iphone 15"
}
```

Example cURL:

```bash
curl -X POST "http://localhost:3000/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"iphone 15"}'
```

PowerShell example:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/search" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"query":"iphone 15"}'
```

Example response:

```json
{
  "message": "Search accepted",
  "query": "iphone 15",
  "queued": true
}
```

Behavior notes:

- the input query is normalized before it is queued
- trending updates happen immediately in Redis
- PostgreSQL writes happen later through the batch writer

Status codes:

- `202`: search accepted and queued
- `400`: missing or empty query
- `500`: unexpected server error

## `GET /api/trending`

- Endpoint: `/api/trending?limit=5`
- Method: `GET`
- Purpose: returns recent trending queries from Redis sorted-set buckets

Query parameters:

- `limit`: optional result size

Example cURL:

```bash
curl "http://localhost:3000/api/trending?limit=5"
```

Example response:

```json
{
  "trending": [
    { "query": "chatgpt prompts", "score": 12 },
    { "query": "iphone 15", "score": 9 }
  ]
}
```

Behavior notes:

- trending is based on recent activity, not lifetime count alone
- total count from the Prefix Index is used as a tie-breaker when recent scores match

Status codes:

- `200`: trending returned successfully
- `500`: unexpected server error

## `GET /api/metrics`

- Endpoint: `/api/metrics`
- Method: `GET`
- Purpose: returns runtime counters for requests, caching, queue depth, and batch flushing

Example cURL:

```bash
curl "http://localhost:3000/api/metrics"
```

Example response:

```json
{
  "suggestRequests": 1000,
  "searchRequests": 300,
  "cacheHits": 800,
  "cacheMisses": 200,
  "cacheHitRate": 0.8,
  "batchFlushes": 12,
  "queuedWrites": 4,
  "totalSearchEvents": 300,
  "distinctRowsWritten": 120,
  "writeReductionEstimate": "180 row updates avoided (2.50x fewer row-level writes than direct updates)"
}
```

Status codes:

- `200`: metrics returned successfully
- `500`: unexpected server error

## `GET /api/cache-routing`

- Endpoint: `/api/cache-routing?key=suggest:iph:10`
- Method: `GET`
- Purpose: demonstrates consistent-hashing routing for a cache key in a scaled design discussion

Query parameters:

- `key`: cache key to route, such as `suggest:iph:10`

Example cURL:

```bash
curl "http://localhost:3000/api/cache-routing?key=suggest:iph:10"
```

Example response:

```json
{
  "key": "suggest:iph:10",
  "selectedNode": "cache-node-b",
  "replicas": 100,
  "strategy": "consistent_hashing_simulation",
  "note": "The main app uses one Redis instance locally. This endpoint demonstrates how cache keys can be distributed across multiple cache nodes in a scaled design."
}
```

Important note:

- this endpoint does not represent the actual local Redis topology
- the local deployment uses one Redis instance
- the returned node is a logical demo node for HLD explanation

Status codes:

- `200`: routing result returned successfully
- `400`: missing cache key
- `500`: unexpected server error
