// app/api/treatments/route.ts
// Treatments API with filter-first pagination

import { NextResponse } from "next/server"
import { fetchAllTreatments, fetchBranchesWithFilters, fetchTreatmentsByIds, fetchSpecialistsByIds, fetchCitiesByIds } from '@/lib/cms/wix-fetcher'
import { CACHE_CONFIG, normalizePagination } from '@/lib/cms/cache'

// Cache headers
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
}

/**
 * GET /api/treatments
 * 
 * Query parameters:
 * - page: page number (default: 0)
 * - pageSize: items per page (default: 20, max: 100)
 * - branchId: filter by branch ID
 * - cityId: filter by city ID
 * - specialtyId: filter by specialty ID
 * - specialistId: filter by specialist ID
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
    const specialistIds = url.searchParams.getAll('specialistId')

    // Check if filters are applied
    const hasFilters = branchIds.length > 0 || cityIds.length > 0 || specialtyIds.length > 0 || specialistIds.length > 0

    let treatments
    let total = 0

    if (hasFilters) {
      // Filter branches first, then get treatments from those branches
      const branchResult = await fetchBranchesWithFilters(
        { branchIds, cityIds, specialistIds },
        { page: 0, pageSize: 1000 } // Get all matching branches
      )
      
      // Extract unique treatment IDs from filtered branches
      const treatmentIds = new Set<string>()
      branchResult.branches.forEach(branch => {
        branch.treatments?.forEach((t: any) => {
          if (t._id) treatmentIds.add(t._id)
        })
        // Also get treatments from specialists
        branch.specialists?.forEach((spec: any) => {
          spec.treatments?.forEach((t: any) => {
            if (t._id) treatmentIds.add(t._id)
          })
        })
      })
      
      // Fetch treatment details
      const allTreatments = await fetchAllTreatments()
      
      // Filter treatments based on branch results
      if (treatmentIds.size > 0) {
        treatments = allTreatments.filter(t => treatmentIds.has(t._id))
      } else {
        treatments = allTreatments
      }
      total = treatments.length
      
      // Apply pagination
      const { page: p, pageSize: ps } = normalizePagination(page, pageSize)
      const startIndex = p * ps
      treatments = treatments.slice(startIndex, startIndex + ps)
    } else {
      // No filters - return all treatments
      treatments = await fetchAllTreatments()
      total = treatments.length
      
      // Apply pagination
      const { page: p, pageSize: ps } = normalizePagination(page, pageSize)
      const startIndex = p * ps
      treatments = treatments.slice(startIndex, startIndex + ps)
    }

    const hasMore = (page * pageSize) + pageSize < total

    return NextResponse.json(
      {
        items: treatments,
        total,
        page,
        pageSize,
        hasMore,
      },
      {
        headers: {
          ...CACHE_HEADERS,
          'X-Request-Id': requestId,
          'X-Total-Count': String(total),
        },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error(`[${requestId}] Treatments API Error:`, error)

    return NextResponse.json(
      {
        error: 'Failed to fetch treatments',
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
