// lib/cms/cache.ts
// Centralized caching layer for CMS data

import { unstable_cache } from 'next/cache'

// Cache configuration
export const CACHE_CONFIG = {
  // Revalidation times in seconds
  HOSPITALS: 10 * 60, // 10 minutes
  TREATMENTS: 10 * 60,
  DOCTORS: 10 * 60,
  CITIES: 30 * 60, // 30 minutes (rarely changes)
  ACCREDITATIONS: 30 * 60,
  
  // Stale-while-revalidate
  SWR_TIME: 60 * 60, // 1 hour
} as const

// In-memory cache for serverless environments
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private pendingRequests = new Map<string, Promise<unknown>>()

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null
    
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  set<T>(key: string, data: T, ttlMs: number = 10 * 60 * 1000): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs })
  }

  /**
   * Deduplicated request - prevents multiple concurrent requests for same data
   */
  async dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.pendingRequests.get(key)
    if (existing) return existing as Promise<T>
    
    const promise = factory().finally(() => {
      this.pendingRequests.delete(key)
    })
    this.pendingRequests.set(key, promise)
    return promise
  }

  clear(): void {
    this.cache.clear()
    this.pendingRequests.clear()
  }
}

// Global cache instance
export const memoryCache = new MemoryCache()

// Cache tags for revalidation
export const CACHE_TAGS = {
  ALL_DATA: 'cms-all-data',
  HOSPITALS: 'cms-hospitals',
  TREATMENTS: 'cms-treatments',
  DOCTORS: 'cms-doctors',
  BRANCHES: 'cms-branches',
} as const

/**
 * Create a cached function with Next.js unstable_cache
 */
export function createCachedFetcher<T>(
  fetcher: () => Promise<T>,
  keyParts: string[],
  options: {
    revalidate?: number
    tags?: string[]
  } = {}
): () => Promise<T> {
  return unstable_cache(
    fetcher,
    keyParts,
    {
      revalidate: options.revalidate ?? CACHE_CONFIG.HOSPITALS,
      tags: options.tags ?? [CACHE_TAGS.ALL_DATA],
    }
  )
}
