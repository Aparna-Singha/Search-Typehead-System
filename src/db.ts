import { Pool, types as pgTypes } from "pg";

import { config } from "./config";
import { SearchTermRecord, Suggestion, compareSuggestions } from "./types";

pgTypes.setTypeParser(20, (value: string) => Number.parseInt(value, 10));

const pool = new Pool({
  connectionString: config.databaseUrl
});

export const initSchema = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS search_terms (
      id SERIAL PRIMARY KEY,
      query TEXT UNIQUE NOT NULL,
      count BIGINT NOT NULL DEFAULT 0,
      recent_score BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_search_terms_count
    ON search_terms (count DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_search_terms_updated_at
    ON search_terms (updated_at DESC);
  `);
};

export const loadAllSearchTerms = async (): Promise<SearchTermRecord[]> => {
  const result = await pool.query<SearchTermRecord>(`
    SELECT
      id,
      query,
      count,
      recent_score AS "recentScore",
      updated_at AS "updatedAt"
    FROM search_terms
    ORDER BY count DESC, query ASC;
  `);

  return result.rows;
};

export const seedSearchTerms = async (
  terms: Array<{ query: string; count: number }>
): Promise<SearchTermRecord[]> => {
  if (terms.length === 0) {
    return [];
  }

  const queries = terms.map((term) => term.query);
  const counts = terms.map((term) => term.count);

  const result = await pool.query<SearchTermRecord>(
    `
      INSERT INTO search_terms (query, count, recent_score, updated_at)
      SELECT input.query, input.count, 0, NOW()
      FROM UNNEST($1::text[], $2::bigint[]) AS input(query, count)
      ON CONFLICT (query)
      DO UPDATE SET
        count = GREATEST(search_terms.count, EXCLUDED.count),
        updated_at = NOW()
      RETURNING
        id,
        query,
        count,
        recent_score AS "recentScore",
        updated_at AS "updatedAt";
    `,
    [queries, counts]
  );

  return result.rows.sort((left: SearchTermRecord, right: SearchTermRecord) =>
    compareSuggestions(
      { query: left.query, count: left.count },
      { query: right.query, count: right.count }
    )
  );
};

export const applyBatchUpdates = async (
  updates: Array<{ query: string; increment: number }>
): Promise<SearchTermRecord[]> => {
  if (updates.length === 0) {
    return [];
  }

  const queries = updates.map((update) => update.query);
  const increments = updates.map((update) => update.increment);

  const result = await pool.query<SearchTermRecord>(
    `
      INSERT INTO search_terms (query, count, recent_score, updated_at)
      SELECT input.query, input.increment, input.increment, NOW()
      FROM UNNEST($1::text[], $2::bigint[]) AS input(query, increment)
      ON CONFLICT (query)
      DO UPDATE SET
        count = search_terms.count + EXCLUDED.count,
        recent_score = search_terms.recent_score + EXCLUDED.recent_score,
        updated_at = NOW()
      RETURNING
        id,
        query,
        count,
        recent_score AS "recentScore",
        updated_at AS "updatedAt";
    `,
    [queries, increments]
  );

  return result.rows;
};

export const loadPopularSearches = async (limit: number): Promise<Suggestion[]> => {
  const result = await pool.query<SearchTermRecord>(
    `
      SELECT
        query,
        count,
        recent_score AS "recentScore"
      FROM search_terms
      ORDER BY count DESC, query ASC
      LIMIT $1;
    `,
    [limit]
  );

  return result.rows.map((row: SearchTermRecord) => ({
    query: row.query,
    count: row.count
  }));
};

export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};
