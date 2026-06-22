import { describe, expect, it } from "vitest";

import { PrefixIndex } from "../src/prefixIndex";
import { SearchTermRecord } from "../src/types";

const records: SearchTermRecord[] = [
  { query: "iphone 15", count: 120, recentScore: 0 },
  { query: "iphone charger", count: 110, recentScore: 0 },
  { query: "iphone case", count: 90, recentScore: 0 },
  { query: "python tutorial", count: 140, recentScore: 0 }
];

describe("PrefixIndex", () => {
  it("builds prefixes and returns matches for partial prefixes", () => {
    const prefixIndex = new PrefixIndex(10, 10);
    prefixIndex.build(records);

    const suggestions = prefixIndex.getSuggestions("iph", 10);
    expect(suggestions.map((item) => item.query)).toEqual([
      "iphone 15",
      "iphone charger",
      "iphone case"
    ]);
  });

  it("returns suggestions sorted by count descending", () => {
    const prefixIndex = new PrefixIndex(10, 10);
    prefixIndex.build(records);

    const suggestions = prefixIndex.getSuggestions("iphone", 10);
    expect(suggestions.map((item) => item.count)).toEqual([120, 110, 90]);
  });

  it("respects the requested limit", () => {
    const prefixIndex = new PrefixIndex(10, 10);
    prefixIndex.build(records);

    const suggestions = prefixIndex.getSuggestions("iphone", 2);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((item) => item.query)).toEqual(["iphone 15", "iphone charger"]);
  });
});
