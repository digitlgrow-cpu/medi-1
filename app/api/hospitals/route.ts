// app/api/hospitals/route.ts
// Hospitals API with filter-first pagination

import { NextResponse } from "next/server"
import { fetchBranchesWithFilters, fetchAllBranches } from '@/lib/cms/wix-fetcher'
import { CACHE_CONFIG, normalizePagination } from '@/lib/cms/cache'

// Cache headers
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
}

/**
 * GET /api/hospitals
 * 
 * Query parameters:
 * - page: page number (default: 0)
 * - pageSize: items per page (default: 20, max: 100)
 * - branchId: filter by branch ID
 * - cityId: filter by city ID  
 * - specialtyId: filter by specialty ID
 * - treatmentId: filter by treatment ID
 * - specialistId: filter by specialist ID
 * - hospitalId: filter by hospital ID
 * - doctorId: filter by doctor ID
 */
export async function GET(req: Request) {
  const requestId = crypto.randomUUID?.() || Date.now().toString()

  try {
    const url = new URL(req.url)
    
    // Pagination params
    const page = Math.max(0, Number(url.searchParams.get('page') || 0))
    const pageSize = Math.min(
      CACHE_CONFIG.MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get('pageSize') || CACHE_CONFIG.DEFAULT_PAGE_SIZE))
    )

    // Filter params
    const branchIds = url.searchParams.getAll('branchId')
    const cityIds = url.searchParams.getAll('cityId')
    const specialtyIds = url.searchParams.getAll('specialtyId')
    const treatmentIds = url.searchParams.getAll('treatmentId')
    const specialistIds = url.searchParams.getAll('specialistId')
    const hospitalIds = url.searchParams.getAll('hospitalId')
    const doctorIds = url.searchParams.getAll('doctorId')
    const accreditationIds = url.searchParams.getAll('accreditationId')

    // Check if this is an initial load (no filters)
    const hasFilters = branchIds.length > 0 || cityIds.length > 0 || specialtyIds.length > 0 || 
                       treatmentIds.length > 0 || specialistIds.length > 0 || hospitalIds.length > 0 ||
                       doctorIds.length > 0 || accreditationIds.length > 0

    let result

    if (hasFilters) {
      // Filter first, then paginate
      result = await fetchBranchesWithFilters(
        { branchIds, cityIds, specialtyIds, treatmentIds, specialistIds, hospitalIds, doctorIds, accreditationIds },
        { page, pageSize }
      )
    } else {
      // Initial load - fetch all and paginate
      const branches = await fetchAllBranches()
      const { page: normalizedPage, pageSize: normalizedPageSize } = normalizePagination(page, pageSize)
      
      const startIndex = normalizedPage * normalizedPageSize
      const paginatedBranches = branches.slice(startIndex, startIndex + normalizedPageSize)
      
      result = {
        branches: paginatedBranches,
        total: branches.length,
        hasMore: startIndex + normalizedPageSize < branches.length,
      }
    }

    return NextResponse.json(
      {
        items: result.branches,
        total: result.total,
        page,
        pageSize,
        hasMore: result.hasMore,
      },
      {
        headers: {
          ...CACHE_HEADERS,
          'X-Request-Id': requestId,
          'X-Total-Count': String(result.total),
        },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error(`[${requestId}] Hospitals API Error:`, error)

    return NextResponse.json(
      {
        error: 'Failed to fetch hospitals',
        details: errorMessage,
      },
      {
        status: 500,
        headers: {
          'X-Request-Id': requestId,
        },
      }
    )
  }
}
