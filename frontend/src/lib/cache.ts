/**
 * Dual-layer High Performance Cache & Persistence Engine
 * Supports L1 (Memory) + L2 (LocalStorage) with TTL, hashing, and change detection.
 * Prevents full reload lag, layout shifts, and redundant computation on F5 reloads.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds (0 = forever)
  hash: string;
}

// Simple fast string hashing for change detection
export function computeHash(obj: unknown): string {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private prefix = 'beautylink_v2_';

  constructor() {
    // Warm up memory cache from persistent storage on startup
    if (typeof window !== 'undefined') {
      this.warmup();
    }
  }

  private warmup(): void {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const entry: CacheEntry<any> = JSON.parse(raw);
            const now = Date.now();
            if (entry.ttl === 0 || now - entry.timestamp < entry.ttl) {
              const cleanKey = key.slice(this.prefix.length);
              this.memoryCache.set(cleanKey, entry);
            } else {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch {
      // Ignore storage access errors in restricted iframe/incognito
    }
  }

  /**
   * Get an item from L1 (Memory) or L2 (LocalStorage).
   * Returns null if missing or expired.
   */
  get<T>(key: string): T | null {
    // 1. Check L1 Memory
    const mem = this.memoryCache.get(key);
    const now = Date.now();

    if (mem) {
      if (mem.ttl === 0 || now - mem.timestamp < mem.ttl) {
        return mem.data as T;
      }
      this.delete(key);
      return null;
    }

    // 2. Check L2 Storage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.prefix + key);
        if (raw) {
          const entry: CacheEntry<T> = JSON.parse(raw);
          if (entry.ttl === 0 || now - entry.timestamp < entry.ttl) {
            this.memoryCache.set(key, entry);
            return entry.data;
          }
          localStorage.removeItem(this.prefix + key);
        }
      } catch {
        // Fallback
      }
    }

    return null;
  }

  /**
   * Set an item in both L1 & L2 cache.
   * Checks if data actually changed via hash to avoid unnecessary writes.
   * @param ttlMs Time to live in ms (0 = permanent until deleted)
   * @returns boolean true if data changed or was newly inserted
   */
  set<T>(key: string, data: T, ttlMs = 0): boolean {
    const hash = computeHash(data);
    const existing = this.memoryCache.get(key);

    if (existing && existing.hash === hash) {
      // Data is identical! No change needed, skip write to save CPU/I/O
      return false;
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
      hash,
    };

    // Update Memory
    this.memoryCache.set(key, entry);

    // Update Persistent Storage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.prefix + key, JSON.stringify(entry));
      } catch {
        // Storage quota exceeded or disabled - memory cache still works
      }
    }

    return true;
  }

  /**
   * Stale-While-Revalidate pattern:
   * Returns cached data immediately if available.
   * If missing or expired, executes the fetcher and caches the result.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T> | T,
    ttlMs = 10 * 60 * 1000 // 10 minutes default
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const freshData = await fetcher();
    this.set(key, freshData, ttlMs);
    return freshData;
  }

  /**
   * Delete an item from cache
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.prefix + key);
      } catch {
        // Safe ignore
      }
    }
  }

  /**
   * Clear all app-specific caches
   */
  clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(this.prefix)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        // Safe ignore
      }
    }
  }
}

export const cache = new CacheManager();
