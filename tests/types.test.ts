import { describe, expect, it } from "vitest";

import { normalizeQuery } from "../src/types";

describe("normalizeQuery", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normalizeQuery("   PyThOn   Tutorial   ")).toBe("python tutorial");
  });
});
