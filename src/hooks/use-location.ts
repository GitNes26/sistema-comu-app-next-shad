"use client"

import { useState, useCallback } from "react"
import {
  isGoogleMapsAvailable,
  loadGoogleMaps,
  googleReverseGeocode,
  googlePlacesSearch,
  googlePlaceDetails,
} from "@/lib/google-maps-loader"

export interface LocationCoords {
  lat: number
  lon: number
}

export interface AddressParts {
  calle?: string
  numero?: string
  colonia?: string
  cp?: string
  municipio?: string
  estado?: string
  pais?: string
}

export interface LocationResult {
  coords: LocationCoords
  address: string
  parts: AddressParts
}

/** Última posición conocida del dispositivo: sirve para acercar las sugerencias de dirección. */
let knownPosition: LocationCoords | null = null
export const getKnownPosition = () => knownPosition
export const rememberPosition = (lat: number, lon: number) => {
  knownPosition = { lat, lon }
}

// ── Nominatim fallback ──────────────────────────────────────

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: {
    road?: string
    house_number?: string
    suburb?: string
    neighborhood?: string
    postcode?: string
    city?: string
    town?: string
    state?: string
    country?: string
  }
}

async function nominatimReverse(lat: number, lon: number): Promise<LocationResult | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: "json",
      addressdetails: "1",
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    const data: NominatimResult = await res.json()
    const a = data.address ?? {}
    const parts: AddressParts = {
      calle: a.road,
      numero: a.house_number,
      colonia: a.suburb ?? a.neighborhood,
      cp: a.postcode,
      municipio: a.city ?? a.town,
      estado: a.state,
      pais: a.country,
    }
    const address = [
      [parts.calle, parts.numero].filter(Boolean).join(" "),
      parts.colonia,
      parts.municipio,
      parts.estado,
      parts.cp,
    ]
      .filter(Boolean)
      .join(", ")
    return { coords: { lat, lon }, address, parts }
  } catch {
    return null
  }
}

async function nominatimSearch(query: string, near?: LocationCoords | null): Promise<Array<{ description: string; lat: number; lon: number }>> {
  const run = async (bounded: boolean) => {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      limit: "5",
      countrycodes: "mx",
    })
    // Primero solo lo cercano (~60 km); si no hay nada, todo México.
    if (near && bounded) {
      const d = 0.55
      params.set("viewbox", `${near.lon - d},${near.lat + d},${near.lon + d},${near.lat - d}`)
      params.set("bounded", "1")
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: "application/json" } })
    if (!res.ok) return []
    const data: NominatimResult[] = await res.json()
    return data.map((r) => ({ description: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }))
  }
  try {
    if (near) {
      const local = await run(true)
      if (local.length > 0) return local
    }
    return await run(false)
  } catch {
    return []
  }
}

// ── Hook ────────────────────────────────────────────────────

export interface UseLocationReturn {
  /** Get the user's current location via browser Geolocation */
  detectMyLocation: () => Promise<LocationResult | null>
  /** Search for an address (Google Places or Nominatim fallback); `near` acerca los resultados */
  searchAddress: (query: string, near?: LocationCoords | null) => Promise<Array<{ description: string; placeId?: string; lat?: number; lon?: number }>>
  /** Get details for a Google Place (placeId) */
  getPlaceDetails: (placeId: string) => Promise<LocationResult | null>
  /** Reverse geocode coordinates to address */
  reverseGeocode: (lat: number, lon: number) => Promise<LocationResult | null>
  /** Si el permiso ya fue concedido, obtiene la posición en silencio (sin pedirlo) para acercar las sugerencias */
  warmLocation: () => Promise<LocationCoords | null>
  /** Whether Google Maps is available */
  hasGoogleMaps: boolean
  /** Current loading state */
  loading: boolean
  /** Current error message */
  error: string | null
}

export function useLocation(): UseLocationReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasGoogleMaps = isGoogleMapsAvailable()

  const detectMyLocation = useCallback(async (): Promise<LocationResult | null> => {
    if (!window.isSecureContext) {
      setError("La ubicación requiere abrir el sistema mediante HTTPS.")
      return null
    }
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no soporta geolocalización.")
      return null
    }

    setLoading(true)
    setError(null)

    return new Promise((resolve) => {
      const success = async (pos: GeolocationPosition) => {
          const lat = pos.coords.latitude
          const lon = pos.coords.longitude
          knownPosition = { lat, lon }
          setError(null)
          try {
            // Try Google reverse geocode first
            if (hasGoogleMaps) {
              const result = await googleReverseGeocode(lat, lon)
              if (result) {
                resolve({
                  coords: { lat, lon },
                  address: result.description,
                  parts: {
                    calle: result.addressComponents.street,
                    numero: result.addressComponents.streetNumber,
                    colonia: result.addressComponents.neighborhood,
                    cp: result.addressComponents.postalCode,
                    municipio: result.addressComponents.city,
                    estado: result.addressComponents.state,
                    pais: result.addressComponents.country,
                  },
                })
                setLoading(false)
                return
              }
            }
            // Fallback to Nominatim
            const result = await nominatimReverse(lat, lon)
            resolve(result ?? { coords: { lat, lon }, address: "", parts: {} })
          } catch {
            resolve({ coords: { lat, lon }, address: "", parts: {} })
          } finally {
            setLoading(false)
          }
        }
      const failure = (err: GeolocationPositionError, retried = false) => {
          if (!retried && err.code !== err.PERMISSION_DENIED) {
            navigator.geolocation.getCurrentPosition(success, (finalError) => failure(finalError, true), { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 })
            return
          }
          setLoading(false)
          if (err.code === 1) {
            setError("Ubicación bloqueada. En el navegador abre los permisos de este sitio, permite Ubicación y vuelve a intentarlo.")
          } else if (err.code === 2 || err.code === 3) {
            // Suele ser señal momentánea (no GPS apagado): se puede seguir escribiendo o moviendo el pin.
            setError("No pudimos fijar tu ubicación exacta ahora. Escribe tu dirección o ubícala moviendo el pin en el mapa.")
          } else {
            setError("No se pudo obtener tu ubicación.")
          }
          resolve(null)
        }
      navigator.geolocation.getCurrentPosition(success, failure, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
    })
  }, [hasGoogleMaps])

  const searchAddress = useCallback(
    async (query: string, near?: LocationCoords | null) => {
      if (!query.trim()) return []
      setLoading(true)
      setError(null)
      const center = near ?? knownPosition
      try {
        if (hasGoogleMaps) {
          await loadGoogleMaps()
          const results = await googlePlacesSearch(query, 5, center)
          if (results.length > 0) return results
        }
        // Fallback to Nominatim
        return await nominatimSearch(query, center)
      } catch {
        setError("Error al buscar la dirección.")
        return []
      } finally {
        setLoading(false)
      }
    },
    [hasGoogleMaps]
  )

  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<LocationResult | null> => {
      setLoading(true)
      try {
        const result = await googlePlaceDetails(placeId)
        if (!result) return null
        return {
          coords: { lat: result.lat, lon: result.lon },
          address: result.description,
          parts: {
            calle: result.addressComponents.street,
            numero: result.addressComponents.streetNumber,
            colonia: result.addressComponents.neighborhood,
            cp: result.addressComponents.postalCode,
            municipio: result.addressComponents.city,
            estado: result.addressComponents.state,
            pais: result.addressComponents.country,
          },
        }
      } catch {
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const reverseGeocode = useCallback(
    async (lat: number, lon: number): Promise<LocationResult | null> => {
      if (hasGoogleMaps) {
        const result = await googleReverseGeocode(lat, lon)
        if (result) {
          return {
            coords: { lat, lon },
            address: result.description,
            parts: {
              calle: result.addressComponents.street,
              numero: result.addressComponents.streetNumber,
              colonia: result.addressComponents.neighborhood,
              cp: result.addressComponents.postalCode,
              municipio: result.addressComponents.city,
              estado: result.addressComponents.state,
              pais: result.addressComponents.country,
            },
          }
        }
      }
      return nominatimReverse(lat, lon)
    },
    [hasGoogleMaps]
  )

  const warmLocation = useCallback(async (): Promise<LocationCoords | null> => {
    if (knownPosition) return knownPosition
    try {
      if (!("geolocation" in navigator) || !window.isSecureContext) return null
      const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName })
      if (status?.state !== "granted") return null
      return await new Promise<LocationCoords | null>((resolve) =>
        navigator.geolocation.getCurrentPosition(
          (p) => {
            knownPosition = { lat: p.coords.latitude, lon: p.coords.longitude }
            resolve(knownPosition)
          },
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        )
      )
    } catch {
      return null
    }
  }, [])

  return {
    detectMyLocation,
    warmLocation,
    searchAddress,
    getPlaceDetails,
    reverseGeocode,
    hasGoogleMaps,
    loading,
    error,
  }
}
