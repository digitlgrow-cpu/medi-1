"use client"

import { useState, useEffect } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight, Building2, AlertCircle } from "lucide-react"
import ContactModal from "@/components/ContactModal"
import Autoplay from "embla-carousel-autoplay"
import { getWixImageUrl } from "@/lib/wixMedia"
import Link from "next/link"
import { generateSlug } from "@/lib/cms"
import { fetchAllBranches } from "@/app/api/hospitals/fetchers"
import ScrollableTitle from "@/components/ScrollableTitle"


interface Hospital {
  _id: string
  hospitalName: string
  hospitalSlug: string
  image: string
  branchId: string
  address?: string | null
  city?: string
  yearEstablished?: number | null
  totalBeds?: number | null
  noOfDoctors?: number | null
}

const LoadingSkeleton = () => (
  <section className="bg-white py-12">
    <div className="container mx-auto px-4">
      <div className="flex justify-between items-center mb-8">
        <div className="space-y-2">
          <div className="h-8 w-52 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex gap-4">
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full"
          >
            <div className="w-full h-56 bg-gray-200 animate-pulse" />
            -y-4 flex<div className="p-6 space flex-col flex-grow">
              <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
              <div className="mt-auto h-8 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
)

export default function PopularHospitalsSection() {
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      slidesToScroll: 1,
      breakpoints: {
        "(min-width: 1024px)": { slidesToScroll: 4 },
        "(min-width: 768px)": { slidesToScroll: 2 },
      },
    },
    [Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })],
  )

  const fetchHospitals = async (): Promise<Hospital[]> => {
    try {
      const branches = await fetchAllBranches()
      
      // Filter only popular hospitals/branches
      const popularHospitals = branches.filter((branch: any) => branch.popular === true)
      
      if (!popularHospitals.length) return []

      return popularHospitals.map((branch: any) => {
        // Process Wix image URL using getWixImageUrl for direct CDN URL
        const wixImage = branch.branchImage || branch.data?.branchImage || undefined
        let imageUrl = getWixImageUrl(wixImage)
        if (!imageUrl) {
          // Fallback: if not a Wix URL, use as-is or placeholder
          imageUrl = branch.branchImage || branch.data?.branchImage || "/placeholder.svg"
        }
        
        const hospitalName = branch.branchName || branch.data?.branchName || "Hospital"
        const slug = generateSlug(hospitalName)
        
        // Get city name from the city reference
        const cityName = branch.city?.name || branch.data?.city?.name || ""
        
        return {
          _id: branch._id,
          hospitalName: hospitalName,
          hospitalSlug: slug,
          image: imageUrl || "/placeholder.svg",
          branchId: branch._id,
          address: branch.address || branch.data?.address || null,
          city: cityName,
          yearEstablished: branch.yearEstablished || branch.data?.yearEstablished || null,
          totalBeds: branch.totalBeds || branch.data?.totalBeds || null,
          noOfDoctors: branch.noOfDoctors || branch.data?.noOfDoctors || null,
        }
      })
    } catch (error: any) {
      console.error("Error fetching hospitals from CMS:", error)
      throw new Error("CMS_ERROR")
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchHospitals()
      setHospitals(result)
    } catch (err: any) {
      setError(
        err.message === "CMS_ERROR"
          ? "Unable to load hospitals data"
          : "Unable to load hospitals data",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) return <LoadingSkeleton />

  if (hospitals.length === 0) {
    return (
      <section className="bg-white pb-10">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 rounded-full mb-6">
            <Building2 className="h-10 w-10 text-blue-600" />
          </div>
          <h2 className="md:text-4xl text-3xl font-bold text-[#241d1f] mb-4">
            Our Hospitals
          </h2>
          <p className="text-lg text-[#241d1f]">
            Hospital information is currently being updated. Please check back soon!
          </p>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="bg-gray-50 px-2 md:px-0 pb-12">
        <div className="container mx-auto">
          {error && (
            <div className="flex items-center gap-2 mb-4 text-sm text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-between items-center mb-5">
            <div className="space-y-2">
              <h2 className="text-3xl md:text-4xl font-bold text-[#241d1f]">
                Popular Hospitals
              </h2>
            
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => emblaApi?.scrollPrev()}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white text-[#241d1f] p-1.5 rounded-full shadow-md hover:bg-gray-100 transition-colors duration-200"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="embla__container flex -mx-2 items-stretch">
                {hospitals.map((hospital, index) => (
                  <div
                    key={hospital._id || index}
                    className="embla__slide px-2 min-w-0 flex-grow-0 flex-shrink-0 basis-full md:basis-1/2 lg:basis-1/4"
                  >
                    <Link
                      href={`/search/hospitals/${hospital.hospitalSlug}?bid=${hospital.branchId}`}
                      className="block group bg-white border border-gray-100 rounded-xs overflow-hidden flex flex-col h-full min-h-[300px] hover:shadow-lg transition-shadow duration-200"
                    >
                      {/* Image */}
                      <div className="relative w-full h-48 overflow-hidden">
                        <img
                          src={hospital.image}
                          alt={hospital.hospitalName}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            // Prevent infinite loop if fallback also fails
                            if (!target.dataset.fallbackAttempted) {
                              target.dataset.fallbackAttempted = "true"
                              target.src = `/placeholder.svg`
                            }
                          }}
                        />
                      </div>

                      {/* Content */}
                      <div className="p-4 flex flex-col flex-1">
                        <ScrollableTitle 
                          text={hospital.hospitalName + (hospital.city ? ` - ${hospital.city}` : '')} 
                          className="tracking-tight text-xl font-medium leading-tight text-[#241d1f] hover:text-primary "
                        />
                        
                        <footer className="border-t border-gray-100 pt-2 mt-auto">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center rounded-xs bg-gray-50 p-2 border border-gray-50 space-y-0">
                              <p className=" text-lg md:text-sm font-medium text-gray-700">{hospital.yearEstablished ?? '?'}</p>
                              <p className=" text-lg md:text-sm text-gray-700">Estd.</p>
                            </div>
                            <div className="text-center rounded-xs bg-gray-50 p-2 border border-gray-50 space-y-0">
                              <p className=" text-lg md:text-sm font-medium text-gray-700">{hospital.totalBeds ?? '?'}+</p>
                              <p className=" text-lg md:text-sm text-gray-700">Beds</p>
                            </div>
                            <div className="text-center rounded-xs bg-gray-50 p-2 border border-gray-50 space-y-0">
                              <p className=" text-lg md:text-sm font-medium text-gray-700">{hospital.noOfDoctors ?? '?'}+</p>
                              <p className=" text-lg md:text-sm text-gray-700">Doctors</p>
                            </div>
                          </div>
                        </footer>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => emblaApi?.scrollNext()}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white text-[#241d1f] p-1.5 rounded-full shadow-md hover:bg-gray-100 transition-colors duration-200"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      <ContactModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
