"use client"

import { useState, useEffect } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight, BriefcaseMedical, AlertCircle, ArrowUpRight } from "lucide-react"
import ContactModal from "@/components/ContactModal"
import Autoplay from "embla-carousel-autoplay"
import { getAllCMSData, ExtendedTreatmentData } from "@/lib/cms"
import { getWixImageUrl } from "@/lib/wixMedia"
import Link from "next/link"
import { generateSlug } from "@/lib/cms"
import ScrollableTitle from "@/components/ScrollableTitle"


interface Service {
  _id: string
  treatmentName: string
  treatmentSlug: string
  image: string
  treatmentId: string
  description?: string
  cost?: string
  duration?: string
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
            <div className="p-6 space-y-4 flex flex-col flex-grow">
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

export default function ServiceSection() {
  const [services, setServices] = useState<Service[]>([])
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

  const fetchServices = async (): Promise<Service[]> => {
    try {
      const { treatments } = await getAllCMSData()
      
      // Filter only popular treatments
      const popularTreatments = treatments.filter((treatment: ExtendedTreatmentData) => treatment.popular === true)
      
      if (!popularTreatments.length) return []

      return popularTreatments.map((treatment: ExtendedTreatmentData) => {
        // Process Wix image URL using getWixImageUrl for direct CDN URL
        const wixImage = treatment.treatmentImage || undefined
        let imageUrl = getWixImageUrl(wixImage)
        if (!imageUrl) {
          // Fallback: if not a Wix URL, use as-is or placeholder
          imageUrl = treatment.treatmentImage || "/placeholder.svg"
        }
        
        const slug = generateSlug(treatment.name || "")
        
        // Strip HTML tags from description and truncate to ~100 chars
        const stripHtml = (html: string) => {
          return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
        }
        const rawDescription = treatment.description || ""
        const cleanDescription = stripHtml(rawDescription)
        const shortDescription = cleanDescription.length > 80 
          ? cleanDescription.substring(0, 80).trim() + "..."
          : cleanDescription
        
        return {
          _id: treatment._id,
          treatmentName: treatment.name || "Treatment",
          treatmentSlug: slug,
          image: imageUrl,
          treatmentId: treatment._id,
          description: shortDescription,
          cost: treatment.cost || undefined,
          duration: treatment.duration || undefined,
        }
      })
    } catch (error: any) {
      console.error("Error fetching treatments from CMS:", error)
      throw new Error("CMS_ERROR")
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchServices()
      setServices(result)
    } catch (err: any) {
      setError(
        err.message === "CMS_ERROR"
          ? "Unable to load services data"
          : "Unable to load services data",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) return <LoadingSkeleton />

  if (services.length === 0) {
    return (
      <section className="bg-white py-16">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 rounded-full mb-6">
            <BriefcaseMedical className="h-10 w-10 text-blue-600" />
          </div>
          <h2 className="md:text-4xl text-3xl font-bold text-[#241d1f] mb-4">
            Our Treatments
          </h2>
         
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="bg-gray-50 px-2 md:px-0 py-12">
        <div className="container mx-auto">
          <div className="mb-5">
            <h2 className="text-2xl md:text-3xl font-bold text-[#241d1f] mb-2">
              Our Treatments
            </h2>
         
          </div>

          {error && (
            <div className="flex items-center gap-2 mb-4 text-sm text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

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
                {services.map((service, index) => (
                  <div
                    key={service._id || index}
                    className="embla__slide px-2 min-w-0 flex-grow-0 flex-shrink-0 basis-full md:basis-1/2 lg:basis-1/4"
                  >
                    <Link
                      href={`/treatment/${service.treatmentSlug}?tid=${service.treatmentId}`}
                      className="group bg-white border border-gray-100 rounded-xs overflow-hidden flex flex-col h-full min-h-[300px] hover:shadow-lg hover:border-gray-200 transition-all duration-300 cursor-pointer block"
                    >
                      {/* Image */}
                      <div className="relative w-full h-48 overflow-hidden">
                        <img
                          src={service.image}
                          alt={service.treatmentName}
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
                          text={service.treatmentName} 
                          className="tracking-tight text-xl font-medium leading-tight text-[#241d1f] hover:text-primary "
                        />
                        {service.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {service.description}
                          </p>
                        )}
                        {/* <div className="mt-auto pt-3 flex items-end justify-between">
                          <div className="flex flex-col gap-1">
                            {service.cost && (
                              <span className="text-green-600 font-bold text-lg">
                                {service.cost}
                              </span>
                            )}
                            {service.duration && !service.cost && (
                              <span className="text-gray-500 text-xs">
                                Duration: {service.duration}
                              </span>
                            )}
                          </div>
                        </div> */}
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
