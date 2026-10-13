// Distancias entre coordenadas (puro, sin base de datos).

export interface GeoPoint {
  lat: number
  lng: number
}

const R_KM = 6371

/** Distancia en km sobre la esfera (fórmula de haversine). */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Ordena de la más cercana a la más lejana; descarta lo que no tiene ubicación válida. */
export function rankByDistance<T extends { lat: number | null; lng: number | null }>(items: T[], origin: GeoPoint): (T & { distanceKm: number })[] {
  return items
    .filter((i): i is T & { lat: number; lng: number } => typeof i.lat === "number" && typeof i.lng === "number" && Number.isFinite(i.lat) && Number.isFinite(i.lng))
    .map((i) => ({ ...i, distanceKm: Math.round(haversineKm(origin, { lat: i.lat, lng: i.lng }) * 10) / 10 }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
}
