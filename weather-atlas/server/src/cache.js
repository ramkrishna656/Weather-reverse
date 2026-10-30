// Small in-memory TTL cache with a size cap (oldest entry evicted first).
export class TtlCache {
  constructor({ ttlMs, max = 500 }) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value) {
    if (this.map.size >= this.max) {
      this.map.delete(this.map.keys().next().value);
    }
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}
