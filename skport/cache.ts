export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function get<T>(key: string): T | null {
    const entry = cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() - entry.timestamp >= entry.ttl) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

export function getWithMetadata<T>(key: string): CacheEntry<T> | null {
    const entry = cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() - entry.timestamp >= entry.ttl) {
        cache.delete(key);
        return null;
    }

    return entry;
}

export function set<T>(key: string, data: T, ttl: number = 60 * 60 * 1000): void {
    cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
    });
}

export function remove(key: string): void {
    cache.delete(key);
}

export function cleanup(): void {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp >= entry.ttl) {
            cache.delete(key);
            count++;
        }
    }

    if (count > 0) {
        ak.Logger.debug(`Cache cleanup: removed ${count} expired entries`);
    }
}

export function clear(): void {
    cache.clear();
}

/**
 * Predicts a value that regenerates over time.
 * Prioritizes recoveryTime (sync with server) over manual elapsed time calculation.
 */
export function predictValue(options: {
    current: number;
    max: number;
    recoveryTime?: number;
    lastUpdated: number;
    regenRate: number;
}): number {
    const now = Math.floor(Date.now() / 1000);

    if (options.recoveryTime) {
        if (options.recoveryTime > now) {
            const missing = Math.ceil((options.recoveryTime - now) / options.regenRate);
            return Math.max(0, options.max - missing);
        }
        return options.max;
    }

    const elapsed = (Date.now() - options.lastUpdated) / 1000;
    const gained = Math.floor(elapsed / options.regenRate);
    return Math.min(options.max, options.current + gained);
}
