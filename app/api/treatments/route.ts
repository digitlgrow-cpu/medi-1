// app/api/treatments/route.ts
// Optimized API endpoint for treatments with improved performance

import { NextResponse } from "next/server"
import { wixClient } from "@/lib/wixClient"
import { COLLECTIONS } from '@/app/api/hospitals/collections'
import { DataMappers, ReferenceMapper } from '@/app/api/hospitals/mappers'
import type { ExtendedTreatmentType } from '@/types/search'

// =============================================================================
// CACHE & DEDUPLICATION
// =============================================================================

let treatmentsCache: ExtendedTreatmentType[] | null = null
let treatmentsCacheTime: number = 0
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

const pendingRequests = new Map<string, Promise<ExtendedTreatmentType[]>>()

/**
 * Get or create deduplicated request
 */
function deduplicatedRequest<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = pendingRequests.get(key)
  if (existing) return existing as Promise<T>
  
  const promise = factory().finally(() => {
    pendingRequests.delete(key)
  })
  pendingRequests.set(key, promise as Promise<ExtendedTreatmentType[]>)
  return promise
}

// =============================================================================
// OPTIMIZED DATA FETCHING
// =============================================================================

/**
 * Fetches all treatments with optimized parallel requests
 */
async function fetchAllTreatmentsOptimized(): Promise<ExtendedTreatmentType[]> {
  return deduplicatedRequest('treatments_all', async () => {
    // Fetch treatments, branches, cities, specialists, and departments in parallel
    const [treatmentsRes, branchesRes, citiesRes] = await Promise.all([
      wixClient.items
        .query(COLLECTIONS.TREATMENTS)
        .include("branches", "hospital", "city", "department")
        .limit(1000)
        .find()
        .catch(() => ({ items: [] })),
      
      wixClient.items
        .query(COLLECTIONS.BRANCHES)
        .include("hospital", "HospitalMaster_branches", "city", "specialist", "treatment", "ShowHospital")
        .limit(1000)
        .find()
        .catch(() => ({ items: [] })),
      
      wixClient.items
        .query(COLLECTIONS.CITIES)
        .limit(500)
        .find()
        .catch(() => ({ items: [] })),
    ])

    // Build cities map
    const citiesMap = new Map<string, any>()
    citiesRes.items.forEach((city: any) => {
      if (city._id) {
        citiesMap.set(city._id, {
          _id: city._id,
          cityName: city.cityName || city["City Name"] || city.name || "Unknown City",
          state: city.state || "Unknown State",
          country: city.country || "India",
        })
      }
    })

    // Filter valid branches (ShowHospital=true)
    const validBranchesMap = new Map<string, any>()
    branchesRes.items.forEach((branch: any) => {
      const showHospital = branch?.ShowHospital ?? branch?.data?.ShowHospital ?? branch?.showHospital
      const shouldShow = showHospital === true || showHospital === "true" || showHospital === 1 || showHospital === "1" || showHospital === "yes"
      if (shouldShow && branch._id) {
        validBranchesMap.set(branch._id, branch)
      }
    })

    // Collect specialist IDs for batch fetch
    const allSpecialistIds = new Set<string>()
    validBranchesMap.forEach((branch: any) => {
      const specialists = branch.specialist || branch.data?.specialist || []
      const specialistArray = Array.isArray(specialists) ? specialists : [specialists].filter(Boolean)
      specialistArray.forEach((s: any) => {
        const id = s?._id || s
        if (id) allSpecialistIds.add(id)
      })
    })

    // Fetch specialists with their treatments and departments
    let specialistDataMap = new Map<string, { treatments: string[], departments: any[] }>()
    if (allSpecialistIds.size > 0) {
      try {
        const specialistRes = await wixClient.items
          .query(COLLECTIONS.SPECIALTIES)
          .hasSome("_id", Array.from(allSpecialistIds))
          .include("treatment", "department")
          .limit(500)
          .find()
        
        specialistRes.items.forEach((spec: any) => {
          const specId = spec._id || spec.ID
          if (!specId) return
          
          const treatments = spec.treatment || spec.data?.treatment || []
          const treatmentArray = Array.isArray(treatments) ? treatments : [treatments].filter(Boolean)
          
          const departments = spec.department || spec.data?.department || []
          const deptArray = Array.isArray(departments) ? departments : [departments].filter(Boolean)
          
          specialistDataMap.set(specId, {
            treatments: treatmentArray.map((t: any) => t?._id || t).filter(Boolean),
            departments: deptArray.map((d: any) => ({
              _id: d?._id || d,
              name: d?.name || d?.department || "Unknown Department",
            })).filter((d: any) => d._id),
          })
        })
      } catch (e) {
        console.warn("Failed to fetch specialists:", e)
      }
    }

    // Build branch-to-specialist mapping
    const branchSpecialistsMap = new Map<string, string[]>()
    validBranchesMap.forEach((branch: any, branchId: string) => {
      const specialists = branch.specialist || branch.data?.specialist || []
      const specialistArray = Array.isArray(specialists) ? specialists : [specialists].filter(Boolean)
      branchSpecialistsMap.set(branchId, specialistArray.map((s: any) => s?._id || s).filter(Boolean))
    })

    // Build treatment-to-branch mapping
    const treatmentBranchesMap = new Map<string, Map<string, any>>()

    // Process valid branches and map treatments
    validBranchesMap.forEach((branch: any, branchId: string) => {
      const hospitalRefs = branch.hospital || branch.HospitalMaster_branches || branch.data?.hospital || []
      const hospitalArray = Array.isArray(hospitalRefs) ? hospitalRefs : [hospitalRefs].filter(Boolean)
      const hospitalId = hospitalArray[0]?._id || hospitalArray[0]?.ID || hospitalArray[0] || branch._id
      const hospitalName = branch.branchName || branch["Branch Name"] || "Unknown Hospital"

      const branchCities = branch.city || branch.data?.city || []
      const cityArray = Array.isArray(branchCities) ? branchCities : [branchCities].filter(Boolean)
      const cities = cityArray.map((c: any) => {
        const cityId = c?._id || c
        return citiesMap.get(cityId) || {
          _id: cityId,
          cityName: c?.cityName || c?.name || "Unknown City",
          state: c?.state || "Unknown State",
          country: "India",
        }
      })

      // Collect departments from specialists
      const branchDepartmentsMap = new Map<string, any>()
      const branchSpecialistIds = branchSpecialistsMap.get(branchId) || []
      branchSpecialistIds.forEach((specialistId: string) => {
        const specialistData = specialistDataMap.get(specialistId)
        if (specialistData) {
          specialistData.departments.forEach((dept: any) => {
            if (dept._id && !branchDepartmentsMap.has(dept._id)) {
              branchDepartmentsMap.set(dept._id, dept)
            }
          })
        }
      })
      const branchDepartments = Array.from(branchDepartmentsMap.values())

      // Map treatments from branch
      const branchTreatments = branch.treatment || branch.data?.treatment || []
      const treatmentArray = Array.isArray(branchTreatments) ? branchTreatments : [branchTreatments].filter(Boolean)
      
      treatmentArray.forEach((treatmentRef: any) => {
        const treatmentId = treatmentRef?._id || treatmentRef
        if (!treatmentId) return

        if (!treatmentBranchesMap.has(treatmentId)) {
          treatmentBranchesMap.set(treatmentId, new Map())
        }
        
        const branchMap = treatmentBranchesMap.get(treatmentId)!
        if (!branchMap.has(branchId)) {
          branchMap.set(branchId, {
            branchId,
            branchName: branch.branchName || branch["Branch Name"] || "Unknown Branch",
            hospitalId: typeof hospitalId === 'string' ? hospitalId : branch._id,
            hospitalName,
            cities,
            departments: branchDepartments,
            cost: null,
          })
        }
      })

      // Also map treatments from specialists at this branch
      branchSpecialistIds.forEach((specialistId: string) => {
        const specialistData = specialistDataMap.get(specialistId)
        if (specialistData) {
          specialistData.treatments.forEach((treatmentId: string) => {
            if (!treatmentBranchesMap.has(treatmentId)) {
              treatmentBranchesMap.set(treatmentId, new Map())
            }
            
            const branchMap = treatmentBranchesMap.get(treatmentId)!
            if (!branchMap.has(branchId)) {
              branchMap.set(branchId, {
                branchId,
                branchName: branch.branchName || branch["Branch Name"] || "Unknown Branch",
                hospitalId: typeof hospitalId === 'string' ? hospitalId : branch._id,
                hospitalName,
                cities,
                departments: branchDepartments,
                cost: null,
              })
            }
          })
        }
      })
    })

    // Map treatments to ExtendedTreatmentType format
    const allTreatments: ExtendedTreatmentType[] = treatmentsRes.items.map((item: any) => {
      const treatment = DataMappers.treatment(item)
      const treatmentId = item._id || item.ID
      
      const branchesMap = treatmentBranchesMap.get(treatmentId)
      const branchesAvailableAt = branchesMap ? Array.from(branchesMap.values()) : []

      const deptRefs = item.department || item.data?.department || []
      const deptArray = Array.isArray(deptRefs) ? deptRefs : [deptRefs].filter(Boolean)
      const departments = deptArray.map((d: any) => ({
        _id: d?._id || d,
        name: d?.name || d?.department || "Unknown Department",
      }))

      return {
        ...treatment,
        branchesAvailableAt,
        departments,
      } as ExtendedTreatmentType
    })

    return allTreatments
  })
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const searchQuery = url.searchParams.get("q")?.trim().toLowerCase() || ""
    const category = url.searchParams.get("category")?.trim() || ""
    const popular = url.searchParams.get("popular") === "true"
    const page = Math.max(0, Number(url.searchParams.get("page") || 0))
    const pageSize = Number(url.searchParams.get("pageSize") || 1000) // Allow fetching all treatments

    const now = Date.now()

    // Check cache first
    if (treatmentsCache && (now - treatmentsCacheTime) < CACHE_DURATION) {
      let filteredTreatments = treatmentsCache

      // Apply filters from cache
      if (searchQuery) {
        filteredTreatments = filteredTreatments.filter(t => 
          (t.name ?? '').toLowerCase().includes(searchQuery) ||
          (t.category ?? '').toLowerCase().includes(searchQuery)
        )
      }

      if (category) {
        filteredTreatments = filteredTreatments.filter(t => t.category === category)
      }

      if (popular) {
        filteredTreatments = filteredTreatments.filter(t => t.popular)
      }

      // Apply pagination
      const total = filteredTreatments.length
      const startIndex = page * pageSize
      const endIndex = startIndex + pageSize
      const paginatedTreatments = filteredTreatments.slice(startIndex, endIndex)
      const hasMore = endIndex < total
      const nextCursor = hasMore ? Buffer.from(`${page + 1}`).toString('base64') : undefined

      return NextResponse.json({
        items: paginatedTreatments,
        total,
        page,
        pageSize,
        filteredCount: total,
        hasMore,
        nextCursor,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
          'X-Has-More': String(hasMore),
        },
      })
    }

    // Fetch all treatments with optimization
    const allTreatments = await fetchAllTreatmentsOptimized()

    // Cache the results
    treatmentsCache = allTreatments
    treatmentsCacheTime = now

    // Apply filters
    let filteredTreatments = allTreatments

    if (searchQuery) {
      filteredTreatments = filteredTreatments.filter(t => 
        (t.name ?? '').toLowerCase().includes(searchQuery) ||
        (t.category ?? '').toLowerCase().includes(searchQuery)
      )
    }

    if (category) {
      filteredTreatments = filteredTreatments.filter(t => t.category === category)
    }

    if (popular) {
      filteredTreatments = filteredTreatments.filter(t => t.popular)
    }

    // Sort alphabetically
    filteredTreatments.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

    // Apply pagination
    const total = filteredTreatments.length
    const startIndex = page * pageSize
    const endIndex = startIndex + pageSize
    const paginatedTreatments = filteredTreatments.slice(startIndex, endIndex)
    const hasMore = endIndex < total
    const nextCursor = hasMore ? Buffer.from(`${page + 1}`).toString('base64') : undefined

    return NextResponse.json({
      items: paginatedTreatments,
      total,
      page,
      pageSize,
      filteredCount: total,
      hasMore,
      nextCursor,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
        'X-Has-More': String(hasMore),
      },
    })
  } catch (error: any) {
    console.error("API Error:", error)
    const errorMessage = error.message || "An unknown error occurred on the server."
    return NextResponse.json({ error: "Failed to fetch treatments", details: errorMessage }, { status: 500 })
  }
}
