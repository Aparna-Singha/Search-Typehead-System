# Scaling Notes

This file explains how PrefixPulse works locally today and how the design could scale in a higher-level architecture discussion.

## What the Local Demo Actually Does

Current local setup:

- one Express application process
- one PostgreSQL database
- one Redis container
- one process-local Prefix Index
- one in-memory batch queue

Important boundary:

- the live local deployment uses one Redis instance
- `GET /api/cache-routing` is a simulation endpoint only
- the consistent-hash demo is not part of the actual local request path

## Scaling the App Tier

A load balancer could distribute traffic across multiple app replicas.

Benefits:

- more read throughput for suggestion requests
- better availability during restarts
- easier horizontal scaling for API traffic

Required follow-up:

- each replica would need a consistent Prefix Index refresh strategy
- cache invalidation and index refresh would need cross-instance coordination

## Prefix Index at Scale

Today the Prefix Index is process-local.

With multiple app replicas, possible approaches include:

- rebuild the index at startup from PostgreSQL
- publish prefix update events after each batch flush
- refresh affected prefixes on each node
- move prefix-serving logic into a shared service if memory pressure becomes large

Tradeoff:

- local in-memory lookup is fast
- keeping multiple copies synchronized adds operational complexity

## Redis Caching Strategy

Current local behavior:

- Redis caches suggestion responses
- Redis stores recent trending bucket activity
- cache keys use a predictable format such as `suggest:iph:10`

If traffic grows, Redis could scale in several ways:

- vertical scaling on a larger Redis node
- Redis Cluster or sharded Redis deployments
- separating suggestion-cache traffic from trending traffic

The current code already uses stable cache keys, which is useful if the cache layer is split later.

## Consistent Hashing Simulation

The repository includes a consistent-hashing ring and the endpoint:

- `GET /api/cache-routing?key=suggest:iph:10`

Purpose:

- explain how cache keys could map to logical cache nodes in a scaled architecture
- support HLD discussion without changing the local one-Redis deployment

What it does not mean:

- it does not prove the local app is using multiple Redis instances
- it does not route live suggestion traffic
- it does not replace Redis Cluster or other real sharding infrastructure

## Cache Invalidation

After a successful batch flush, the app invalidates Redis suggestion keys for affected prefixes.

This is reasonable for the local assignment, but at larger scale it can become more expensive.

Possible future approaches:

- publish invalidation events to all app replicas
- use shorter TTLs with selective invalidation
- partition cache namespaces by prefix ranges or versioning

Tradeoff:

- stronger freshness often means more invalidation work
- fewer invalidations can improve performance but tolerate more staleness

## Database Scaling

PostgreSQL is the durable source of truth for query counts.

Possible scale-out steps:

- read replicas for reporting and analytics
- partitioning or sharding for much larger datasets
- moving write-heavy event ingestion behind a durable queue

In this project, the suggestion read path mostly avoids the database already, so primary write pressure is the bigger concern.

## Batch Write Strategy

Current behavior:

- search submissions are accepted quickly
- writes are aggregated in memory
- PostgreSQL is updated later in batches

Benefits:

- lower request latency for `POST /api/search`
- fewer repeated row-level updates
- better behavior under bursts of repeated queries

Tradeoffs:

- queued writes are not durable before flush
- counts are slightly stale between acceptance and persistence
- crash recovery is weaker than a durable event stream design

## Failure Handling

Current behavior:

- Redis cache failure falls back to the Prefix Index for suggestions
- Redis trending update failure does not reject the search
- batch flush failure restores the in-memory queue for retry

Future improvements:

- durable queueing with Kafka or RabbitMQ
- retry workers separated from the API server
- health and alerting around flush lag, cache miss rate, and Redis availability

