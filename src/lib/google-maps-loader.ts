/**
 * Google Maps Loader — Dynamically loads the Maps JavaScript API with Places library.
 *
 * If NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set, all methods return null
 * and the app falls back to Nominatim (OpenStreetMap).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary?: (lib: string) => Promise<unknown>
        places?: {
          AutocompleteService: new () => any
          PlacesService: new (div: HTMLElement) => any
          PlacesServiceStatus: Record<string, string>
        }
        Geocoder: new () => any
      }
    }
  }
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

let loaded = false
let loading: Promise<boolean> | null = null

export function isGoogleMapsAvailable(): boolean {
  return !!API_KEY
}

/**
 * Load the Google Maps JavaScript API with the Places library.
 * Returns true if loaded successfully, false otherwise.
 */
export async function loadGoogleMaps(): Promise<boolean> {
  if (!API_KEY) return false
  if (loaded && window.google?.maps?.places) return true
  if (loading) return loading

  loading = new Promise<boolean>((resolve) => {
    // Set callback for when API loads
    const callbackName = "__googleMapsInit"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any)[callbackName] = () => {
      loaded = true
      resolve(true)
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=${callbackName}`
    script.async = true
    script.defer = true
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })

  return loading
}

export interface GooglePlaceResult {
  placeId: string
  description: string
  lat: number
  lon: number
  addressComponents: {
    street?: string
    streetNumber?: string
    neighborhood?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
}

/**
 * Search for places using Google Places Autocomplete.
 * Returns up to `limit` suggestions.
 */
export async function googlePlacesSearch(
  query: string,
  limit = 5,
  near?: { lat: number; lon: number } | null
): Promise<Array<{ description: string; placeId: string }>> {
  const ok = await loadGoogleMaps()
  if (!ok || !window.google?.maps?.places) return []

  return new Promise((resolve) => {
    const service = new window.google!.maps!.places!.AutocompleteService()
    service.getPlacePredictions(
      {
        input: query,
        limit,
        componentRestrictions: { country: "mx" },
        // Resultados cercanos a quien escribe (≈50 km a la redonda).
        ...(near ? { location: { lat: near.lat, lng: near.lon }, radius: 50000 } : {}),
      },
      (predictions: any, status: any) => {
        if (status !== "OK" || !predictions) {
          resolve([])
          return
        }
        resolve(
          predictions.map((p: any) => ({
            description: p.description,
            placeId: p.place_id,
          }))
        )
      }
    )
  })
}

/**
 * Get detailed place info (coordinates + address components) from a placeId.
 */
export async function googlePlaceDetails(placeId: string): Promise<GooglePlaceResult | null> {
  const ok = await loadGoogleMaps()
  if (!ok || !window.google?.maps?.places) return null

  const div = document.createElement("div")
  const service = new window.google!.maps!.places!.PlacesService(div)

  return new Promise((resolve) => {
    service.getDetails(
      { placeId, fields: ["geometry", "address_components", "formatted_address"] },
      (result: any, status: any) => {
        if (status !== "OK" || !result?.geometry?.location) {
          resolve(null)
          return
        }

        const loc = result.geometry.location
        const components = result.address_components ?? []

        const get = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name

        resolve({
          placeId,
          description: result.formatted_address ?? "",
          lat: loc.lat(),
          lon: loc.lng(),
          addressComponents: {
            street: get("route"),
            streetNumber: get("street_number"),
            neighborhood: get("sublocality") ?? get("neighborhood"),
            city: get("locality") ?? get("administrative_area_level_2"),
            state: get("administrative_area_level_1"),
            postalCode: get("postal_code"),
            country: get("country"),
          },
        })
      }
    )
  })
}

/**
 * Reverse geocode coordinates to an address using Google Geocoder.
 */
export async function googleReverseGeocode(
  lat: number,
  lon: number
): Promise<GooglePlaceResult | null> {
  const ok = await loadGoogleMaps()
  if (!ok || !window.google?.maps) return null

  return new Promise((resolve) => {
    const geocoder = new window.google!.maps!.Geocoder()
    geocoder.geocode({ location: { lat, lng: lon } }, (results: any, status: any) => {
      if (status !== "OK" || !results?.[0]) {
        resolve(null)
        return
      }

      const r = results[0]
      const components = r.address_components ?? []
      const get = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name

      resolve({
        placeId: r.place_id,
        description: r.formatted_address ?? "",
        lat,
        lon,
        addressComponents: {
          street: get("route"),
          streetNumber: get("street_number"),
          neighborhood: get("sublocality") ?? get("neighborhood"),
          city: get("locality") ?? get("administrative_area_level_2"),
          state: get("administrative_area_level_1"),
          postalCode: get("postal_code"),
          country: get("country"),
        },
      })
    })
  })
}
