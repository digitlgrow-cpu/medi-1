
"use client"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Building2, MapPin, Activity, Users, X, Search } from "lucide-react"

// --- Types ---
interface UniversalOption {
  id: string
  name: string
  type: "branch" | "city" | "treatment" | "doctor"
  label: string
  hospitalName?: string
  city?: string
}

interface BranchData { _id?: string; branchName?: string; city?: any; treatments?: any[]; specialists?: any[] }
interface DoctorData { _id?: string; doctorName?: string; specialization?: any }
interface TreatmentData { _id?: string; id?: string; name?: string; treatmentName?: string }
interface HospitalData { hospitalName?: string; branches?: BranchData[]; doctors?: DoctorData[]; treatments?: TreatmentData[]; specialists?: any[] }

interface WixTreatment {
  _id: string
  name: string
  branchesAvailableAt?: { hospitalName: string; cities?: { cityName?: string; name?: string }[] }[]
}

interface BranchFilterProps { allHospitals: HospitalData[]; initialSearch?: string }

// Combined treatment type for all treatment sources
interface AllTreatmentOption {
  id: string
  name: string
  type: 'treatment'
  label: string
  hospitalName?: string
  city?: string
}

// --- Utilities ---
const slug = (v: string) => v.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-')

const getCity = (data: any): string => {
  if (!data) return ''
  if (typeof data === 'string') return data.trim()
  if (Array.isArray(data) && data[0]) {
    const c = data[0]
    return typeof c === 'string' ? c : c.cityName || c.name || ''
  }
  if (typeof data === 'object') return data.cityName || data.name || ''
  return ''
}

const getName = (item: any): string => {
  if (!item) return 'Unknown'
  if (typeof item === 'string') return item
  return item.name || item.treatmentName || item.cityName || item.branchName || item.doctorName || 
         item.specializationName || item.displayName || item.title || item.label || 'Unknown'
}

// --- Relevance Scoring ---
const calculateRelevanceScore = (query: string, name: string, hospitalName?: string, city?: string): number => {
  if (!query) return 0
  const q = query.toLowerCase().trim()
  const n = name.toLowerCase()
  const h = (hospitalName || '').toLowerCase()
  const c = (city || '').toLowerCase()
  
  // Split query into words for partial matching
  const queryWords = q.split(/\s+/)
  
  // Check for exact match on full name
  if (n === q) return 100
  
  // Check if name starts with query
  if (n.startsWith(q)) return 90
  
  // Check for city exact match
  if (c === q) return 85
  
  // Check for hospital name exact match
  if (h === q) return 80
  
  // Calculate word-based matching score
  let wordMatchScore = 0
  let matchedWords = 0
  
  // Check each word in query against name
  queryWords.forEach(word => {
    if (word.length < 2) return // Skip very short words
    
    // Check if word appears in name (partial match)
    if (n.includes(word)) {
      matchedWords++
      // Higher score if word starts a word in name
      if (n.split(/\s+/).some(w => w.startsWith(word))) {
        wordMatchScore += 15
      } else {
        wordMatchScore += 10
      }
    }
    
    // Check if word appears in hospital name
    if (h.includes(word)) {
      matchedWords++
      if (h.split(/\s+/).some(w => w.startsWith(word))) {
        wordMatchScore += 12
      } else {
        wordMatchScore += 8
      }
    }
    
    // Check if word appears in city
    if (c.includes(word)) {
      matchedWords++
      wordMatchScore += 5
    }
  })
  
  // Bonus for matching multiple words
  if (matchedWords >= queryWords.length && queryWords.length > 1) {
    wordMatchScore += 20
  }
  
  return Math.min(wordMatchScore, 100) // Cap at 100
}

// --- Search Component ---
const SearchDropdown = ({
  value, onChange, placeholder, options, onOptionSelect, onClear
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: UniversalOption[]
  onOptionSelect: (id: string, type: UniversalOption['type']) => void
  onClear: () => void
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Lightweight, real-time filtered results with relevance scoring
  const filtered = useMemo(() => {
    if (!value) return options // Show all options by default
    
    return options
      .map(opt => ({
        opt,
        score: calculateRelevanceScore(value, opt.name, opt.hospitalName, opt.city)
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.opt.name.localeCompare(b.opt.name))
      .map(({ opt }) => opt) // Show all matching results (no limit)
  }, [value, options])

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setIsOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const icon = (type: UniversalOption['type']) => {
    const map = { branch: Building2, city: MapPin, treatment: Activity, doctor: Users }
    const Icon = map[type]
    return <Icon className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
  }

  const badge = (type: UniversalOption['type']) => {
    if (type === 'city') return null
    const labels: Record<string, string> = { branch: 'Hospital', treatment: 'Treatment', doctor: 'Doctor' }
    return <span className="text-xs font-medium text-gray-500">{labels[type]}</span>
  }

  return (
    <div ref={ref} className="md:relative w-full max-w-xl mx-auto">
      <div className="md:relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text" value={value} autoComplete="off"
          onChange={e => { onChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
        {value && (
          <button onClick={onClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {isOpen && filtered.length > 0 && (
        <div className="absolute w-[98%] mx-auto left-0 right-0 z-50 md:mt-1.5 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto md:left-auto md:right-auto md:w-full">
          {filtered.map(opt => (
            <button
              key={`${opt.type}-${opt.id}`}
              onClick={() => { onOptionSelect(opt.id, opt.type); setIsOpen(false); }}
              className="w-full text-left px-4 py-3 flex items-start hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{opt.name}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <div>{icon(opt.type)}</div>
                  {badge(opt.type)}
                    
                    {/* Show city for city type */}
                    {opt.type === 'branch' && opt.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{opt.city}</span>}
                    
                    {/* Show city for city type */}
                    {opt.type === 'city' && opt.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{opt.city}</span>}
                    
                    {(opt.type === 'doctor') && opt.hospitalName && <span className="truncate">{opt.hospitalName}</span>}
                    
                    {/* Show city for doctor types */}
                    {(opt.type === 'doctor') && opt.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{opt.city}</span>}
          
                  </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Main Component ---
const BranchFilter = ({ allHospitals, initialSearch = "" }: BranchFilterProps) => {
  const router = useRouter()
  const [query, setQuery] = useState(initialSearch)
  const [allTreatments, setAllTreatments] = useState<AllTreatmentOption[]>([])

  // Fetch treatments from multiple sources
  const fetchAllTreatments = useCallback(async () => {
    try {
      // 1. Fetch from Wix API (main TreatmentMaster collection) - fetch ALL treatments without pagination
      const wixRes = await fetch('/api/treatments?pageSize=1000')
      const wixData = await wixRes.json()
      const wixTreatmentsData = (wixData.items || []) as WixTreatment[]

      // 2. Collect treatments from all sources
      const allTreatmentOptions: AllTreatmentOption[] = []
      const seen = new Set<string>()

      const addTreatment = (opt: AllTreatmentOption) => {
        const key = `${opt.type}-${opt.id}`
        if (!seen.has(key)) {
          allTreatmentOptions.push(opt)
          seen.add(key)
        }
      }

      // Process Wix treatments
      wixTreatmentsData.forEach((t) => {
        if (t._id && t.name) {
          const loc = t.branchesAvailableAt?.[0]
          const treatmentSlug = slug(t.name)
          addTreatment({
            id: treatmentSlug, // Use slug from name instead of Wix ID
            name: t.name,
            type: 'treatment',
            label: 'Treatment',
            hospitalName: loc?.hospitalName || '',
            city: loc?.cities?.[0]?.cityName || ''
          })
        }
      })

      // Process treatments from all hospitals and their branches/specialists
      allHospitals.forEach(h => {
        const hname = h.hospitalName || ''

        // Hospital-level treatments
        h.treatments?.forEach((t) => {
          const name = getName(t)
          if (name && name !== 'Unknown') {
            const id = t._id || t.id || slug(name)
            addTreatment({
              id,
              name,
              type: 'treatment',
              label: 'Treatment',
              hospitalName: hname,
              city: ''
            })
          }
        })

        h.branches?.forEach(b => {
          const city = getCity(b.city)

          // Branch-level treatments
          b.treatments?.forEach((t) => {
            const name = getName(t)
            if (name && name !== 'Unknown') {
              const id = t._id || t.id || slug(name)
              addTreatment({
                id,
                name,
                type: 'treatment',
                label: 'Treatment',
                hospitalName: hname,
                city
              })
            }
          })

          // Specialist-level treatments
          b.specialists?.forEach((s) => {
            s.treatments?.forEach((t: any) => {
              const name = getName(t)
              if (name && name !== 'Unknown') {
                const id = t._id || t.id || slug(name)
                addTreatment({
                  id,
                  name,
                  type: 'treatment',
                  label: 'Treatment',
                  hospitalName: hname,
                  city
                })
              }
            })
          })
        })
      })

      setAllTreatments(allTreatmentOptions)
    } catch (error) {
      console.error('Error fetching treatments:', error)
      setAllTreatments([])
    }
  }, [allHospitals])

  useEffect(() => {
    fetchAllTreatments()
  }, [fetchAllTreatments])

  const options = useMemo(() => {
    const opts: UniversalOption[] = []
    const seen = new Set<string>()

    const add = (opt: UniversalOption) => { if (!seen.has(`${opt.type}-${opt.id}`)) { opts.push(opt); seen.add(`${opt.type}-${opt.id}`); } }

    // Doctors - HIDDEN from dropdown (only accessible via specialties)
    // allHospitals.forEach(h => {
    //   const hname = h.hospitalName || ''
    //   h.doctors?.forEach((d: DoctorData) => { if (d._id && d.doctorName) add({ id: d._id, name: getName(d.doctorName), type: 'doctor', label: 'Doctor', hospitalName: hname }) })
    // })

    // Treatments from all sources (Wix API + hospitals + branches + specialists)
    allTreatments.forEach((t) => {
      add({
        id: t.id,
        name: t.name,
        type: 'treatment',
        label: 'Treatment',
        hospitalName: t.hospitalName || '',
        city: t.city || ''
      })
    })

    // Hospital Treatments (fallback - in case any were missed)
    const treatments = new Map<string, UniversalOption>()
    allHospitals.forEach(h => {
      const hname = h.hospitalName || ''
      h.treatments?.forEach((t: TreatmentData) => {
        const name = getName(t)
        if (name && name !== 'Unknown') {
          const id = t._id || t.id || slug(name)
          if (!seen.has(`treatment-${id}`)) treatments.set(id, { id, name, type: 'treatment', label: 'Treatment', hospitalName: hname, city: '' })
        }
      })
      h.branches?.forEach(b => {
        const city = getCity(b.city)
        b.treatments?.forEach((t: any) => {
          const name = getName(t)
          if (name && name !== 'Unknown') {
            const id = t._id || t.id || slug(name)
            if (!seen.has(`treatment-${id}`)) treatments.set(id, { id, name, type: 'treatment', label: 'Treatment', hospitalName: hname, city })
          }
        })
        b.specialists?.forEach((s: any) => {
          s.treatments?.forEach((t: any) => {
            const name = getName(t)
            if (name && name !== 'Unknown') {
              const id = t._id || t.id || slug(name)
              if (!seen.has(`treatment-${id}`)) treatments.set(id, { id, name, type: 'treatment', label: 'Treatment', hospitalName: hname, city })
            }
          })
        })
      })
    })
    treatments.forEach(o => add(o))

    // Branches
    allHospitals.forEach(h => {
      const hname = h.hospitalName || ''
      h.branches?.forEach(b => {
        if (b._id && b.branchName) add({ id: b._id, name: getName(b.branchName), type: 'branch', label: 'Branch', hospitalName: hname, city: getCity(b.city) })
      })
    })

    return opts.sort((a, b) => a.name.localeCompare(b.name))
  }, [allHospitals, allTreatments])

  const handleSelect = useCallback((id: string, type: UniversalOption['type']) => {
    const opt = options.find(o => o.id === id && o.type === type)
    if (!opt) return
    const s = slug(opt.name)
    let url = ''
    switch (type) {
      case 'doctor': url = `/doctors/${s}`; break
      case 'treatment': url = `/treatment/${s}`; break
      case 'city': url = `/search/?view=hospitals&city=${s}`; break
      case 'branch': url = `/search/hospitals/${s}`; break
    }
    router.push(url)
    setQuery('')
  }, [options, router])

  return <SearchDropdown value={query} onChange={setQuery} placeholder="Search hospitals, treatments..." options={options} onOptionSelect={handleSelect} onClear={() => setQuery('')} />
}

export default BranchFilter
