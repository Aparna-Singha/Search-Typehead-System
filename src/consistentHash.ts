const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

const fnv1aHash = (value: string): number => {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
};

export class ConsistentHashRing {
  private readonly ring = new Map<number, string>();
  private readonly sortedHashes: number[] = [];
  private readonly nodes = new Set<string>();

  constructor(private readonly replicas: number = 100) {}

  addNode(nodeId: string): void {
    if (this.nodes.has(nodeId)) {
      return;
    }

    this.nodes.add(nodeId);

    for (let replica = 0; replica < this.replicas; replica += 1) {
      const hash = fnv1aHash(`${nodeId}#${replica}`);
      this.ring.set(hash, nodeId);
      this.sortedHashes.push(hash);
    }

    this.sortedHashes.sort((left, right) => left - right);
  }

  removeNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) {
      return;
    }

    this.nodes.delete(nodeId);

    for (let replica = 0; replica < this.replicas; replica += 1) {
      const hash = fnv1aHash(`${nodeId}#${replica}`);
      this.ring.delete(hash);
    }

    const remainingHashes = this.sortedHashes.filter((hash) => this.ring.has(hash));
    this.sortedHashes.length = 0;
    this.sortedHashes.push(...remainingHashes);
  }

  getNode(key: string): string | null {
    if (this.sortedHashes.length === 0) {
      return null;
    }

    const keyHash = fnv1aHash(key);
    let low = 0;
    let high = this.sortedHashes.length - 1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const middleHash = this.sortedHashes[middle];

      if (middleHash === keyHash) {
        return this.ring.get(middleHash) ?? null;
      }

      if (middleHash < keyHash) {
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    const selectedHash = this.sortedHashes[low] ?? this.sortedHashes[0];
    return this.ring.get(selectedHash) ?? null;
  }

  getNodes(): string[] {
    return Array.from(this.nodes).sort();
  }

  getReplicaCount(): number {
    return this.replicas;
  }
}
