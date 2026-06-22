# API Documentation

## `GET /api/suggest`

- Endpoint: `/api/suggest?q=<prefix>&limit=10`
- Method: `GET`
- Purpose: returns the top matching suggestions for a normalized prefix

### Request

- Query parameter `q`: prefix text
- Query parameter `limit`: optional result size, capped by configuration

### Example cURL

```bash
curl "http://localhost:3000/api/suggest?q=iph&limit=10"
```

### Response

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

### Status Codes

- `200`: suggestions returned successfully
- `500`: unexpected server error

## `POST /api/search`

- Endpoint: `/api/search`
- Method: `POST`
- Purpose: accepts a searched term, queues it for batched persistence, and updates recent trending activity

### Request

```json
{
  "query": "iphone 15"
}
```

### Example cURL

```bash
curl -X POST "http://localhost:3000/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"iphone 15"}'
```

### Response

```json
{
  "message": "Search accepted",
  "query": "iphone 15",
  "queued": true
}
```

### Status Codes

- `202`: search accepted and queued
- `400`: missing or empty query
- `500`: unexpected server error

## `GET /api/trending`

- Endpoint: `/api/trending?limit=10`
- Method: `GET`
- Purpose: returns recent trending searches derived from Redis activity buckets

### Request

- Query parameter `limit`: optional result size

### Example cURL

```bash
curl "http://localhost:3000/api/trending?limit=10"
```

### Response

```json
{
  "trending": [
    { "query": "chatgpt prompts", "score": 12 },
    { "query": "iphone 15", "score": 9 }
  ]
}
```

### Status Codes

- `200`: trending results returned successfully
- `500`: unexpected server error

## `GET /api/metrics`

- Endpoint: `/api/metrics`
- Method: `GET`
- Purpose: exposes lightweight runtime counters for requests, cache behavior, and batching

### Example cURL

```bash
curl "http://localhost:3000/api/metrics"
```

### Response

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

### Status Codes

- `200`: metrics returned successfully
- `500`: unexpected server error

## `GET /api/cache-routing`

- Endpoint: `/api/cache-routing?key=<cacheKey>`
- Method: `GET`
- Purpose: demonstrates consistent-hashing key routing for HLD scaling explanation

### Request

- Query parameter `key`: cache key to route, such as `suggest:iph:10`

### Example cURL

```bash
curl "http://localhost:3000/api/cache-routing?key=suggest:iph:10"
```

### Response

```json
{
  "key": "suggest:iph:10",
  "selectedNode": "cache-node-b",
  "replicas": 100,
  "strategy": "consistent_hashing_simulation",
  "note": "The main app uses one Redis instance locally. This endpoint demonstrates how cache keys can be distributed across multiple cache nodes in a scaled design."
}
```

### Status Codes

- `200`: route result returned successfully
- `400`: missing cache key
- `500`: unexpected server error
