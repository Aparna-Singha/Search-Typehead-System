# Scaling Notes

This file explains how the current design could be extended. These ideas are not implemented in this repository.

## Load Balancer

A load balancer can sit in front of multiple API servers and distribute `GET /api/suggest`, `POST /api/search`, and other requests across instances.

Benefits:

- higher availability
- more read capacity
- easier rolling deployments

Important follow-up:

- every instance would need a consistent way to refresh or rebuild its Prefix Index after writes

## Multiple API Servers

The current Prefix Index is process-local. With multiple API servers, each instance would keep its own copy.

Possible approaches:

- rebuild the index at startup and refresh on change notifications
- publish invalidation events so each instance can update affected prefixes
- move part of the prefix-serving logic into a shared service if the dataset becomes very large

## Redis Cluster

If Redis traffic grows, Redis Cluster can distribute cache keys and trending buckets across shards.

Why it helps:

- higher throughput
- more memory capacity
- better fault tolerance than a single Redis node

Operational note:

- cache-key design should remain simple and predictable so cluster usage stays manageable

## Database Read Replicas

PostgreSQL read replicas can reduce pressure on the primary database.

Possible usage:

- analytics queries
- admin dashboards
- offline reporting

In this project, the suggestion read path already avoids the database most of the time, so read replicas would mainly help with reporting or maintenance queries rather than the main hot path.

## Kafka or RabbitMQ for Durable Batch Writes

The current batch queue is in memory. That keeps the code simple, but it means queued writes are not durable until they reach PostgreSQL.

Kafka or RabbitMQ could improve this:

- API servers publish search events to a durable message stream
- a worker service consumes events and performs batched UPSERT operations
- crashes between event acceptance and database flush become less risky

Benefits:

- stronger durability
- clearer separation between the read API and write-processing pipeline
- easier horizontal scaling for write-heavy workloads

Tradeoff:

- more infrastructure
- more operational complexity
- slightly harder local setup for a student project

