"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Crosshair, MapPin, MapPinned, Loader2, Map, X, ChevronRight } from "lucide-react"
import dynamic from "next/dynamic"
import { MapPreview } from "@/components/shared/map-preview"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocation, type LocationResult } from "@/hooks/use-location"

const AddressMapPicker = dynamic(() => import("@/components/shared/address-map-picker").then((m) => m.AddressMapPicker), { ssr: false })

interface LocationSearchProps {
  id?: string
  /** Current address text */
  value: string
  /** Called when address changes */
  onChange: (address: string, coords: { lat: number; lon: number } | null) => void
  /** Full location result callback (with address parts) */
  onLocationSelect?: (result: LocationResult) => void
  /** Latitude */
  lat?: number | null
  /** Longitude */
  lon?: number | null
  /** Label */
  label?: string
  /** Placeholder */
  placeholder?: string
  /** Required */
  required?: boolean
  /** Disabled */
  disabled?: boolean
  /** Show map preview */
  showMap?: boolean
  /** Show "use my location" button */
  showDetect?: boolean
  /** Additional CSS class */
  className?: string
  validationError?: string
}

export function LocationSearch({
  id,
  value,
  onChange,
  onLocationSelect,
  lat,
  lon,
  label,
  placeholder = "Buscar dirección, calle o colonia…",
  required,
  disabled,
  showMap = true,
  showDetect = true,
  className,
  validationError,
}: LocationSearchProps) {
  const { detectMyLocation, searchAddress, getPlaceDetails, loading, error, hasGoogleMaps } = useLocation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Array<{ description: string; placeId?: string; lat?: number; lon?: number }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchedEmpty, setSearchedEmpty] = useState(false)
  const [showMapState, setShowMapState] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounced search
  const handleQueryChange = useCallback(
    (q: string) => {
      setQuery(q)
      setActiveIndex(-1)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!q.trim()) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true)
        setSearchedEmpty(false)
        const results = await searchAddress(q, lat != null && lon != null ? { lat, lon } : null)
        setSuggestions(results)
        setShowSuggestions(true)
        setSearchedEmpty(results.length === 0)
        setSearching(false)
      }, 300)
    },
    [searchAddress, lat, lon]
  )

  // Select a suggestion
  async function selectSuggestion(s: { description: string; placeId?: string; lat?: number; lon?: number }) {
    setShowSuggestions(false)
    setQuery("")
    if (s.placeId) {
      // Google Place — get full details
      const result = await getPlaceDetails(s.placeId)
      if (result) {
        onChange(result.address, result.coords)
        onLocationSelect?.(result)
      }
    } else if (s.lat != null && s.lon != null) {
      // Nominatim result — use the coordinates directly
      onChange(s.description, { lat: s.lat, lon: s.lon })
    }
    setShowMapState(true)
    inputRef.current?.blur()
  }

  // Detect my location
  async function handleDetectLocation() {
    const result = await detectMyLocation()
    if (result) {
      onChange(result.address, result.coords)
      onLocationSelect?.(result)
      setShowMapState(true)
    }
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && activeIndex < 0) {
      // Sin sugerencia activa: comprometer el texto escrito como dirección manual.
      e.preventDefault()
      if (query.trim()) {
        onChange(query.trim(), null)
        setShowSuggestions(false)
        setQuery("")
        inputRef.current?.blur()
      }
      return
    }
    if (!showSuggestions) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, -1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  const hasGps = lat != null && lon != null

  return (
    <div className={cn("space-y-2", className)} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
      )}

      {/* Search input with autocomplete */}
      <div className="relative">
        <div className="relative flex items-center">
          <MapPin className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <Input
            id={id}
            ref={inputRef}
            value={query || value}
            onChange={(e) => {
              if (showSuggestions) {
                handleQueryChange(e.target.value)
              } else {
                onChange(e.target.value, null)
              }
            }}
            onFocus={() => {
              setQuery(value || "")
              if (query.trim() && suggestions.length > 0) setShowSuggestions(true)
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={Boolean(validationError) || undefined}
            aria-describedby={validationError && id ? `${id}-error` : undefined}
            className={cn("pl-9 pr-[4.5rem] md:pl-9 desk:pl-9 md:pr-[4.5rem] desk:pr-[4.5rem]", validationError && "border-destructive focus-visible:ring-destructive/20")}
          />
          {value && !showSuggestions && (
            <button
              type="button"
              className="absolute right-[4.75rem] text-muted-foreground hover:text-foreground"
              onClick={() => {
                onChange("", null)
                setQuery("")
              }}
            >
              <X className="size-3.5" />
            </button>
          )}
          {showDetect && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-9 text-muted-foreground hover:text-primary"
              disabled={disabled}
              onClick={() => setPickerOpen(true)}
              title="Elegir en el mapa"
              aria-label="Elegir en el mapa"
            >
              <MapPinned className="size-4" />
            </Button>
          )}
          {showDetect && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 text-muted-foreground hover:text-primary"
              disabled={disabled || loading}
              onClick={handleDetectLocation}
              title="Usar mi ubicación actual"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Crosshair className="size-4" />
              )}
            </Button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
            <div className="p-1">
              {suggestions.map((s, i) => (
                <button
                  key={s.placeId ?? s.description}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    i === activeIndex
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                  onClick={() => selectSuggestion(s)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{s.description}</span>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
                </button>
              ))}
            </div>
            <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
              {hasGoogleMaps ? "Búsqueda de Google Maps" : "Powered by OpenStreetMap"}
            </div>
          </div>
        )}

        {/* No results */}
        {showSuggestions && !searching && searchedEmpty && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover px-3 py-3 text-sm text-muted-foreground shadow-lg">
            Sin resultados para «{query}». Puedes escribir tu dirección completa y presionar Enter.
          </div>
        )}

        {/* Searching indicator in dropdown */}
        {showSuggestions && searching && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover p-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Buscando…
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && !hasGps && <p className="text-xs text-destructive">{error}</p>}

      {/* Coordinates + map */}
      {hasGps && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {lat!.toFixed(6)}, {lon!.toFixed(6)}
            </span>
            {showMap && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs"
                onClick={() => setShowMapState(!showMapState)}
              >
                <Map className="size-3 mr-1" />
                {showMapState ? "Ocultar mapa" : "Ver mapa"}
              </Button>
            )}
          </div>
          {showMapState && lat != null && lon != null && (
            <MapPreview lat={lat} lon={lon} height={192} />
          )}
        </div>
      )}

      <AddressMapPicker
        open={pickerOpen}
        initial={hasGps ? { lat: lat!, lon: lon! } : null}
        onClose={() => setPickerOpen(false)}
        onConfirm={(v) => {
          setPickerOpen(false)
          const result: LocationResult = { coords: { lat: v.lat, lon: v.lon }, address: v.address, parts: v.parts }
          onChange(v.address, result.coords)
          onLocationSelect?.(result)
        }}
      />
    </div>
  )
}
