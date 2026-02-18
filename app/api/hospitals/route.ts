// app/api/hospitals/route.ts
// Simplified Hospitals API endpoint using centralized CMS service
// Fixed: NO pagination slicing, complete data retrieval, debug logging

import { NextResponse } from "next/server"
import { searchHospitals } from '@/lib/cms'

// Cache configuration
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
}

/**
 * GET /api/hospitals
 * 
 * Query parameters:
 * - q: search query (optional)
 * - page: pagination page (default: 0) - IGNORED for complete data
 * - pageSize: items per page (default: 50) - IGNORED, returns all
 */
export async function GET(req: Request) {
  const requestId = crypto.randomUUID?.() || Date.now().toString()

  try {
    const url = new URL(req.url)
    const query = url.searchParams.get('q')
    const page = Math.max(0, Number(url.searchParams.get('page') || 0))
    // Allow fetching up to 1000 records (Wix API limit)
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') || 1000))

    console.log(`[DEBUG] /api/hospitals: requestId=${requestId}, query="${query}", page=${page}, pageSize=${pageSize}`)

    // Fetch ALL hospitals using centralized CMS service (NO PAGINATION)
    console.log(`[DEBUG] /api/hospitals: Calling searchHospitals with query="${query}"`)
    const hospitals = await searchHospitals(query || '')
    console.log(`[DEBUG] /api/hospitals: Found ${hospitals.length} hospitals`)

    // Debug: log treatment counts per hospital
    hospitals.forEach((h: any, idx: number) => {
      const treatmentCount = h.treatments?.length || 0
      const branchCount = h.branches?.length || 0
      console.log(`[DEBUG] /api/hospitals: Hospital ${idx+1}: ${h.hospitalName} - ${branchCount} branches, ${treatmentCount} treatments`)
    })

    // Return ALL data without pagination slicing
    const total = hospitals.length
    const hasMore = false // Always false since we return all data

    console.log(`[DEBUG] /api/hospitals: Returning ${total} hospitals (no pagination)`)

    return NextResponse.json(
      {
        items: hospitals,
        total,
        page: 0, // Always 0 since we return all
        pageSize: total, // Return all items
        hasMore: false,
      },
      {
        headers: {
          ...CACHE_HEADERS,
          'X-Request-Id': requestId,
          'X-Total-Count': String(total),
          'X-Has-More': String(hasMore),
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
