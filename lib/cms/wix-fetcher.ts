// lib/cms/wix-fetcher.ts
// Optimized Wix CMS data fetching with pagination and filter support

import { wixClient } from '@/lib/wixClient'
import { memoryCache, CACHE_CONFIG, normalizePagination, type PaginationParams } from './cache'

// =============================================================================
// COLLECTION NAMES
// =============================================================================

const COLLECTIONS = {
  BRANCHES: 'BranchesMaster',
  DOCTORS: 'DoctorMaster',
  CITIES: 'CityMaster',
  HOSPITALS: 'HospitalMaster',
  ACCREDITATIONS: 'Accreditation',
  SPECIALTIES: 'SpecialistsMaster',
  DEPARTMENTS: 'Department',
  TREATMENTS: 'TreatmentMaster',
  STATES: 'StateMaster',
  COUNTRIES: 'CountryMaster',
} as const

// Max limit per Wix API request
const MAX_WIX_LIMIT = 1000

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getValue(item: any, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = item?.[key] ?? item?.data?.[key]
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'string') {
        return value
      }
      if (typeof value === 'object') {
        return value.name || value.title || value.state || value.StateName || value.stateName || value['State Name'] || null
      }
      return String(value)
    }
  }
  return null
}

function extractRichText(field: any): string {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (field.nodes) {
    return field.nodes
      .map((node: any) => {
        if (node.type === 'PARAGRAPH' && node.nodes) {
          return node.nodes.map((n: any) => n.textData?.text || '').join('')
        }
        return ''
      })
      .join('\n')
  }
  return ''
}

function shouldShowHospital(item: any): boolean {
  const showHospital = item?.ShowHospital ?? item?.data?.ShowHospital ?? item?.showHospital ?? item?.data?.showHospital
  return showHospital === true || showHospital === 'true' || showHospital === 1 || showHospital === '1' || showHospital === 'yes'
}

function extractMultiReference(field: any, ...nameKeys: string[]): any[] {
  if (!field) return []
  const items = Array.isArray(field) ? field : [field]

  return items
    .filter(Boolean)
    .map((ref: any) => {
      if (typeof ref === 'string') return { _id: ref, name: 'ID Reference' }
      if (typeof ref === 'object') {
        let name = 'Unknown'
        for (const key of nameKeys) {
          if (ref[key]) {
            name = ref[key]
            break
          }
        }
        const id = ref._id || ref.ID || ref.data?._id
        return id ? { _id: id, name, ...ref } : null
      }
      return null
    })
    .filter(Boolean)
}

// =============================================================================
// Wix QUERY BUILDER - FILTER FIRST
// =============================================================================

/**
 * Build Wix query with filters pushed to API level
 */
function buildBranchesQuery(filters: {
  branchIds?: string[]
  cityIds?: string[]
  doctorIds?: string[]
  specialtyIds?: string[]
  accreditationIds?: string[]
  treatmentIds?: string[]
  specialistIds?: string[]
  hospitalIds?: string[]
}) {
  const { branchIds, cityIds, doctorIds, specialtyIds, accreditationIds, treatmentIds, specialistIds, hospitalIds } = filters

  let query = wixClient.items
    .query(COLLECTIONS.BRANCHES)
    .include(
      "hospital",
      "HospitalMaster_branches",
      "city",
      "doctor",
      "specialty",
      "accreditation",
      "treatment",
      "specialist",
      "specialists",
      "ShowHospital"
    )

  // Push filters to API level
  if (branchIds?.length) {
    query = query.hasSome("_id", branchIds)
  }
  
  if (cityIds?.length) {
    query = query.hasSome("city", cityIds)
  }
  
  if (doctorIds?.length) {
    query = query.hasSome("doctor", doctorIds)
  }
  
  if (specialtyIds?.length) {
    query = query.hasSome("specialty", specialtyIds)
  }
  
  if (accreditationIds?.length) {
    query = query.hasSome("accreditation", accreditationIds)
  }
  
  if (treatmentIds?.length) {
    query = query.hasSome("treatment", treatmentIds)
  }
  
  if (specialistIds?.length) {
    query = query.hasSome("specialist", specialistIds)
  }
  
  if (hospitalIds?.length) {
    query = query.hasSome("hospital", hospitalIds)
  }

  return query
}

// =============================================================================
// DATA MAPPERS
// =============================================================================

function mapBranch(item: any): any {
  return {
    _id: item._id || item.ID,
    branchName: getValue(item, 'branchName', 'Branch Name') || 'Unknown Branch',
    address: getValue(item, 'address', 'Address'),
    city: extractMultiReference(item.city, 'cityName', 'city name', 'name'),
    specialty: extractMultiReference(item.specialty, 'specialization', 'Specialty Name', 'title', 'name'),
    accreditation: extractMultiReference(item.accreditation, 'title', 'Title'),
    description: extractRichText(item.description || item.data?.description),
    totalBeds: getValue(item, 'totalBeds', 'Total Beds'),
    noOfDoctors: getValue(item, 'noOfDoctors', 'No of Doctors'),
    yearEstablished: getValue(item, 'yearEstablished'),
    branchImage: item.branchImage || item['Branch Image'] || null,
    logo: item.logo || item.Logo || null,
    doctors: extractMultiReference(item.doctor, 'doctorName', 'Doctor Name'),
    specialists: extractMultiReference(item.specialist || item.specialists, 'specialty', 'Specialty Name', 'title', 'name'),
    treatments: extractMultiReference(item.treatment, 'treatmentName', 'Treatment Name', 'title', 'name'),
    specialization: [
      ...extractMultiReference(item.specialty, 'specialty', 'Specialty Name', 'title', 'name'),
      ...extractMultiReference(item.treatment, 'treatmentName', 'Treatment Name', 'title', 'name').map((t) => ({
        ...t,
        isTreatment: true,
      })),
    ],
    popular: getValue(item, 'popular') === 'true',
    isStandalone: false,
    showHospital: shouldShowHospital(item),
  }
}

function mapTreatment(item: any): any {
  return {
    _id: item._id || item.ID,
    name: getValue(item, 'treatmentName', 'Treatment Name', 'title', 'name') || 'Unknown Treatment',
    description: extractRichText(item.Description || item.description),
    category: getValue(item, 'category', 'Category'),
    duration: getValue(item, 'duration', 'Duration'),
    cost: getValue(item, 'cost', 'Cost', 'averageCost'),
    treatmentImage: item.treatmentImage || item['treatment image'] || null,
    popular: getValue(item, 'popular') === 'true',
  }
}

function mapDoctor(item: any): any {
  const aboutField = item.aboutDoctor || item.data?.aboutDoctor
  return {
    _id: item._id || item.ID,
    doctorName: getValue(item, 'doctorName', 'Doctor Name') || 'Unknown Doctor',
    specialization: extractMultiReference(item.Specialist, 'specialty', 'Specialty Name', 'title', 'name', 'Specialist'),
    qualification: getValue(item, 'qualification', 'Qualification'),
    experienceYears: getValue(item, 'experienceYears', 'Experience (Years)'),
    designation: getValue(item, 'designation', 'Designation'),
    aboutDoctor: extractRichText(aboutField),
    profileImage: item.profileImage || item['profile Image'] || null,
    popular: getValue(item, 'popular') === 'true',
  }
}

function mapSpecialist(item: any): any {
  const treatments = item.treatment || item.data?.treatment || []
  const treatmentArray = Array.isArray(treatments) ? treatments : [treatments].filter(Boolean)
  
  return {
    _id: item._id || item.ID,
    name: getValue(item, 'specialty', 'Specialty Name', 'title', 'name') || 'Unknown Specialist',
    treatments: treatmentArray.map((t: any) => ({
      _id: t._id || t.ID || t,
      name: getValue(t, 'treatmentName', 'Treatment Name', 'title', 'name') || 'Unknown Treatment',
      description: extractRichText(t.Description || t.description),
      cost: getValue(t, 'cost', 'Cost', 'averageCost'),
      treatmentImage: t.treatmentImage || t['treatment image'] || null,
    })),
    department: extractMultiReference(item.department, 'department', 'name', 'title'),
  }
}

function mapCity(item: any): any {
  return {
    _id: item._id || item.ID,
    cityName: getValue(item, 'cityName', 'city name', 'name', 'City Name') || 'Unknown City',
    state: getValue(item, 'state', 'State Name', 'stateName') || 'Unknown State',
    country: getValue(item, 'country', 'Country Name') || 'India',
  }
}

// =============================================================================
// PAGINATED FETCHERS - FILTER FIRST, THEN PAGINATE
// =============================================================================

/**
 * Fetch branches with filters applied first, then paginated
 */
export async function fetchBranchesWithFilters(
  filters: {
    branchIds?: string[]
    cityIds?: string[]
    doctorIds?: string[]
    specialtyIds?: string[]
    accreditationIds?: string[]
    treatmentIds?: string[]
    specialistIds?: string[]
    hospitalIds?: string[]
  },
  pagination: PaginationParams
): Promise<{ branches: any[], total: number, hasMore: boolean }> {
  const { page, pageSize } = normalizePagination(pagination.page, pagination.pageSize)
  
  // Build query with filters pushed to API
  const query = buildBranchesQuery(filters)
  
  // Apply limit to fetch filtered results (Wix max is 1000)
  const limit = Math.min(pageSize * (page + 1), MAX_WIX_LIMIT)
  
  // Fetch filtered results from Wix
  const result = await query.limit(limit).find()
  
  // Map and filter results
  const mappedBranches = result.items
    .filter((b: any) => shouldShowHospital(b))
    .map(mapBranch)
  
  const total = result.totalCount || mappedBranches.length
  
  // Apply pagination
  const startIndex = page * pageSize
  const paginatedBranches = mappedBranches.slice(startIndex, startIndex + pageSize)
  
  return {
    branches: paginatedBranches,
    total,
    hasMore: startIndex + pageSize < total,
  }
}

/**
 * Fetch all branches (cached) - for initial load
 */
export async function fetchAllBranches(): Promise<any[]> {
  const cacheKey = 'wix_all_branches'
  const cached = memoryCache.get<any[]>(cacheKey)
  if (cached) return cached

  return memoryCache.dedupe(cacheKey, async () => {
    const result = await wixClient.items
      .query(COLLECTIONS.BRANCHES)
      .include(
        'hospital',
        'HospitalMaster_branches',
        'city',
        'doctor',
        'specialty',
        'accreditation',
        'treatment',
        'specialist',
        'specialists',
        'ShowHospital'
      )
      .limit(MAX_WIX_LIMIT)
      .find()

    const branches = result.items.filter((b: any) => shouldShowHospital(b)).map(mapBranch)
    memoryCache.set(cacheKey, branches, CACHE_CONFIG.HOSPITALS * 1000)
    return branches
  })
}

/**
 * Fetch all hospitals (cached)
 */
export async function fetchAllHospitals(): Promise<any[]> {
  const cacheKey = 'wix_all_hospitals'
  const cached = memoryCache.get<any[]>(cacheKey)
  if (cached) return cached

  return memoryCache.dedupe(cacheKey, async () => {
    const result = await wixClient.items
      .query(COLLECTIONS.HOSPITALS)
      .include('specialty', 'ShowHospital')
      .ascending('_createdDate')
      .limit(MAX_WIX_LIMIT)
      .find()

    memoryCache.set(cacheKey, result.items, CACHE_CONFIG.HOSPITALS * 1000)
    return result.items
  })
}

/**
 * Fetch all treatments (cached)
 */
export async function fetchAllTreatments(): Promise<any[]> {
  const cacheKey = 'wix_all_treatments'
  const cached = memoryCache.get<any[]>(cacheKey)
  if (cached) return cached

  return memoryCache.dedupe(cacheKey, async () => {
    const result = await wixClient.items
      .query(COLLECTIONS.TREATMENTS)
      .include('branches', 'hospital', 'city', 'department')
      .limit(MAX_WIX_LIMIT)
      .find()

    const treatments = result.items.map(mapTreatment)
    memoryCache.set(cacheKey, treatments, CACHE_CONFIG.TREATMENTS * 1000)
    return treatments
  })
}

/**
 * Fetch all doctors (cached)
 */
export async function fetchAllDoctors(): Promise<any[]> {
  const cacheKey = 'wix_all_doctors'
  const cached = memoryCache.get<any[]>(cacheKey)
  if (cached) return cached

  return memoryCache.dedupe(cacheKey, async () => {
    const result = await wixClient.items
      .query(COLLECTIONS.DOCTORS)
      .include('specialization', 'treatment')
      .limit(MAX_WIX_LIMIT)
      .find()

    const doctors = result.items.map(mapDoctor)
    memoryCache.set(cacheKey, doctors, CACHE_CONFIG.DOCTORS * 1000)
    return doctors
  })
}

/**
 * Fetch all cities (cached)
 */
export async function fetchAllCities(): Promise<any[]> {
  const cacheKey = 'wix_all_cities'
  const cached = memoryCache.get<any[]>(cacheKey)
  if (cached) return cached

  return memoryCache.dedupe(cacheKey, async () => {
    const result = await wixClient.items
      .query(COLLECTIONS.CITIES)
      .include('state', 'State', 'stateRef')
      .limit(MAX_WIX_LIMIT)
      .find()

    const cities = result.items.map(mapCity)
    memoryCache.set(cacheKey, cities, CACHE_CONFIG.CITIES * 1000)
    return cities
  })
}

/**
 * Fetch all specialists (cached)
 */
export async function fetchAllSpecialists(): Promise<any[]> {
  const cacheKey = 'wix_all_specialists'
  const cached = memoryCache.get<any[]>(cacheKey)
  if (cached) return cached

  return memoryCache.dedupe(cacheKey, async () => {
    const result = await wixClient.items
      .query(COLLECTIONS.SPECIALTIES)
      .include('department', 'treatment', 'branches')
      .limit(MAX_WIX_LIMIT)
      .find()

    const specialists = result.items.map(mapSpecialist)
    memoryCache.set(cacheKey, specialists, CACHE_CONFIG.HOSPITALS * 1000)
    return specialists
  })
}

// =============================================================================
// FILTER-BASED FETCHERS
// =============================================================================

/**
 * Fetch treatments by IDs
 */
export async function fetchTreatmentsByIds(ids: string[]): Promise<any[]> {
  if (!ids.length) return []
  
  const result = await wixClient.items
    .query(COLLECTIONS.TREATMENTS)
    .hasSome('_id', ids)
    .find()
  
  return result.items.map(mapTreatment)
}

/**
 * Fetch specialists by IDs
 */
export async function fetchSpecialistsByIds(ids: string[]): Promise<any[]> {
  if (!ids.length) return []
  
  const result = await wixClient.items
    .query(COLLECTIONS.SPECIALTIES)
    .hasSome('_id', ids)
    .include('department', 'treatment')
    .find()
  
  return result.items.map(mapSpecialist)
}

/**
 * Fetch cities by IDs
 */
export async function fetchCitiesByIds(ids: string[]): Promise<any[]> {
  if (!ids.length) return []
  
  const result = await wixClient.items
    .query(COLLECTIONS.CITIES)
    .hasSome('_id', ids)
    .find()
  
  return result.items.map(mapCity)
}

// =============================================================================
// EXPORTS
// =============================================================================

export { COLLECTIONS }
