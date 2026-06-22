import { describe, expect, it } from "vitest";

import { ConsistentHashRing } from "../src/consistentHash";

describe("ConsistentHashRing", () => {
  it("maps the same key to the same node", () => {
    const ring = new ConsistentHashRing(100);
    ring.addNode("cache-node-a");
    ring.addNode("cache-node-b");
    ring.addNode("cache-node-c");

    expect(ring.getNode("suggest:iph:10")).toBe(ring.getNode("suggest:iph:10"));
  });

  it("distributes keys across simulated nodes", () => {
    const ring = new ConsistentHashRing(100);
    ring.addNode("cache-node-a");
    ring.addNode("cache-node-b");
    ring.addNode("cache-node-c");

    const assignments = new Set<string>();

    for (let index = 0; index < 200; index += 1) {
      const node = ring.getNode(`suggest:key:${index}`);

      if (node) {
        assignments.add(node);
      }
    }

    expect(assignments.size).toBeGreaterThan(1);
    expect(assignments.size).toBeLessThanOrEqual(3);
  });

  it("remaps keys to remaining nodes when one node is removed", () => {
    const ring = new ConsistentHashRing(100);
    ring.addNode("cache-node-a");
    ring.addNode("cache-node-b");
    ring.addNode("cache-node-c");

    const beforeRemoval = ring.getNode("suggest:python:10");
    ring.removeNode("cache-node-b");
    const afterRemoval = ring.getNode("suggest:python:10");

    expect(ring.getNodes()).toEqual(["cache-node-a", "cache-node-c"]);
    expect(afterRemoval).not.toBeNull();
    expect(ring.getNodes()).toContain(afterRemoval as string);

    if (beforeRemoval === "cache-node-b") {
      expect(afterRemoval).not.toBe("cache-node-b");
    }
  });
});
