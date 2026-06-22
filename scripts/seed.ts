import * as fs from "fs/promises";
import * as path from "path";

import { closeDatabase, initSchema, seedSearchTerms } from "../src/db";
import { closeRedis, connectRedis, deleteKeysByPatterns } from "../src/redis";
import { normalizeQuery } from "../src/types";

const csvPath = path.resolve(process.cwd(), "data/search_queries.csv");

const parseLine = (line: string): { query: string; count: number } | null => {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  const separatorIndex = trimmed.lastIndexOf(",");

  if (separatorIndex <= 0) {
    return null;
  }

  const rawQuery = trimmed.slice(0, separatorIndex);
  const rawCount = trimmed.slice(separatorIndex + 1);
  const query = normalizeQuery(rawQuery);
  const count = Number(rawCount);

  if (!query || !Number.isFinite(count) || count < 0) {
    return null;
  }

  return {
    query,
    count: Math.trunc(count)
  };
};

const main = async (): Promise<void> => {
  const csvContent = await fs.readFile(csvPath, "utf8");
  const lines = csvContent.split(/\r?\n/);
  const dataLines = lines.slice(1);
  const parsedRecords: Array<{ query: string; count: number }> = [];

  for (const line of dataLines) {
    const parsed = parseLine(line);

    if (parsed) {
      parsedRecords.push(parsed);
    }
  }

  await initSchema();
  const upserted = await seedSearchTerms(parsedRecords);

  try {
    await connectRedis();
    await deleteKeysByPatterns(["suggest:*", "trending:bucket:*"]);
    await closeRedis();
  } catch (error) {
    console.warn("Seed completed, but Redis cache reset was skipped.", error);
  }

  console.log(`Seed completed.`);
  console.log(`CSV rows processed: ${parsedRecords.length}`);
  console.log(`Rows inserted or refreshed: ${upserted.length}`);
  console.log(`Dataset path: ${csvPath}`);
  await closeDatabase();
};

main().catch((error) => {
  console.error("Seed failed.", error);
  process.exit(1);
});
