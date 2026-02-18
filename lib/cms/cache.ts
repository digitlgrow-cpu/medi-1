// lib/cms/cache.ts
// Centralized caching layer for CMS data with large dataset support

import { unstable_cache } from 'next/cache'

// =============================================================================
// CACHE CONFIGURATION - Optimized for 100+ records
// =============================================================================

export const CACHE_CONFIG = {
  // Revalidation times in seconds
  HOSPITALS: 15 * 60, // 15 minutes (was 10)
  TREATMENTS: 15 * 60, // 15 minutes
  DOCTORS: 15 * 60, // 15 minutes
  CITIES: 30 * 60, // 30 minutes (rarely changes)
  ACCREDITATIONS: 30 * 60,
  
  // Pagination limits
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Stale-while-revalidate
  SWR_TIME: 60 * 60, // 1 hour
  
  // Large dataset support
  LARGE_DATASET_THRESHOLD: 100,
} as const

// =============================================================================
// IN-MEMORY CACHE FOR SERVERLESS
// =============================================================================

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

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  clear(): void {
    this.cache.clear()
    this.pendingRequests.clear()
  }
}

// Global cache instance
export const memoryCache = new MemoryCache()

// =============================================================================
// CACHE TAGS FOR REVALIDATION
// =============================================================================

export const CACHE_TAGS = {
  ALL_DATA: 'cms-all-data',
  HOSPITALS: 'cms-hospitals',
  TREATMENTS: 'cms-treatments',
  DOCTORS: 'cms-doctors',
  BRANCHES: 'cms-branches',
  CITIES: 'cms-cities',
  SPECIALISTS: 'cms-specialists',
} as const

// =============================================================================
// PAGINATION HELPERS
// =============================================================================

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasMore: boolean
}

/**
 * Apply pagination to array
 */
export function paginateArray<T>(
  items: T[],
  { page, pageSize }: PaginationParams
): PaginatedResult<T> {
  const startIndex = page * pageSize
  const endIndex = startIndex + pageSize
  
  return {
    items: items.slice(startIndex, endIndex),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
    hasMore: endIndex < items.length,
  }
}

/**
 * Normalize pagination params - ensure valid page and pageSize
 */
export function normalizePagination(
  page?: number | string,
  pageSize?: number | string
): PaginationParams {
  const normalizedPage = Math.max(0, Number(page) || 0)
  const normalizedPageSize = Math.min(
    CACHE_CONFIG.MAX_PAGE_SIZE,
    Math.max(1, Number(pageSize) || CACHE_CONFIG.DEFAULT_PAGE_SIZE)
  )
  
  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
  }
}

// =============================================================================
// CACHED FETCHER FACTORY
// =============================================================================

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
