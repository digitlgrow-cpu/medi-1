// lib/cms/index.ts
// Central export for CMS module

export * from './types'
export * from './cache'
export {
  getAllCMSData,
  getCachedCMSData,
  getHospitalBySlug,
  getTreatmentBySlug,
  searchHospitals,
  generateSlug,
  getDoctorBySlug,
} from './data-service'

// Export optimized fetchers
export {
  fetchAllBranches,
  fetchAllHospitals,
  fetchAllTreatments,
  fetchAllDoctors,
  fetchAllCities,
  fetchAllSpecialists,
  fetchBranchesWithFilters,
  fetchTreatmentsByIds,
  fetchSpecialistsByIds,
  fetchCitiesByIds,
  COLLECTIONS,
} from './wix-fetcher'
