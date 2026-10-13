"use client"

import { useId, useState } from "react"
import { MapPin, MapPinned } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { InfoField } from "@/components/base/info-field"
import { LocationSearch } from "@/components/shared/location-search"
import dynamic from "next/dynamic"
import { useLocation, type LocationResult } from "@/hooks/use-location"

const AddressMapPicker = dynamic(() => import("@/components/shared/address-map-picker").then((m) => m.AddressMapPicker), { ssr: false })

export interface GpsValue {
  lat: number
  lon: number
  calle?: string
  numero?: string
  colonia?: string
  cp?: string
  municipio?: string
  estado?: string
}

export interface GpsPickerProps {
  id?: string
  value?: GpsValue | null
  onChange?: (value: GpsValue | null) => void
  onPermissionError?: () => void
  label?: string
  helper?: React.ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
  error?: string
}

export function GpsPicker({
  id,
  value,
  onChange,
  label,
  helper,
  required,
  disabled,
  className,
  error,
}: GpsPickerProps) {
  const autoId = useId().replace(/:/g, "")
  const fieldId = id ?? `gps-${autoId}`
  const { hasGoogleMaps } = useLocation()
  const [showMap, setShowMap] = useState(false)

  function handleLocationChange(address: string, coords: { lat: number; lon: number } | null) {
    if (coords) {
      onChange?.({
        lat: coords.lat,
        lon: coords.lon,
        calle: value?.calle,
        numero: value?.numero,
        colonia: value?.colonia,
        cp: value?.cp,
        municipio: value?.municipio,
        estado: value?.estado,
      })
    }
  }

  function handleLocationSelect(result: LocationResult) {
    onChange?.({
      lat: result.coords.lat,
      lon: result.coords.lon,
      calle: result.parts.calle,
      numero: result.parts.numero,
      colonia: result.parts.colonia,
      cp: result.parts.cp,
      municipio: result.parts.municipio,
      estado: result.parts.estado,
    })
  }

  function handleMapConfirm(v: { lat: number; lon: number; parts: LocationResult["parts"] }) {
    onChange?.({
      lat: v.lat,
      lon: v.lon,
      calle: v.parts.calle,
      numero: v.parts.numero,
      colonia: v.parts.colonia,
      cp: v.parts.cp,
      municipio: v.parts.municipio,
      estado: v.parts.estado,
    })
  }

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <MapPin className="size-4 text-muted-foreground" />
          <Label htmlFor={fieldId} className="cursor-pointer leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}

      <LocationSearch
        id={fieldId}
        value={value ? [value.calle, value.numero, value.colonia, value.municipio, value.estado, value.cp].filter(Boolean).join(", ") : ""}
        onChange={handleLocationChange}
        onLocationSelect={handleLocationSelect}
        lat={value?.lat}
        lon={value?.lon}
        placeholder="Buscar dirección, calle o colonia…"
        disabled={disabled}
        showMap={false}
        showDetect={true}
        validationError={error}
      />

      {/* Mapa a pantalla completa (mismo selector que el portal) */}
      <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={() => setShowMap(true)}>
        <MapPinned className="mr-1.5 size-4" />
        {value ? "Confirmar o ajustar el pin en el mapa" : "Elegir en el mapa"}
      </Button>
      <AddressMapPicker
        open={showMap}
        initial={value ? { lat: value.lat, lon: value.lon } : null}
        onClose={() => setShowMap(false)}
        onConfirm={(v) => {
          setShowMap(false)
          handleMapConfirm(v)
        }}
      />

      {/* Coordinate fields + details */}
      {value && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <InfoField label="Latitud">
              <Input
                type="number"
                step="any"
                min={-90}
                max={90}
                value={Number.isFinite(value.lat) ? value.lat : ""}
                onChange={(e) =>
                  onChange?.({ ...value, lat: Number(e.target.value) })
                }
                disabled={disabled}
              />
            </InfoField>
            <InfoField label="Longitud">
              <Input
                type="number"
                step="any"
                min={-180}
                max={180}
                value={Number.isFinite(value.lon) ? value.lon : ""}
                onChange={(e) =>
                  onChange?.({ ...value, lon: Number(e.target.value) })
                }
                disabled={disabled}
              />
            </InfoField>
            {value.calle && (
              <InfoField label="Calle">
                <Input value={value.calle} disabled className="text-sm" />
              </InfoField>
            )}
            {value.numero && (
              <InfoField label="Número">
                <Input value={value.numero} disabled className="text-sm" />
              </InfoField>
            )}
            {value.colonia && (
              <InfoField label="Colonia">
                <Input value={value.colonia} disabled className="text-sm" />
              </InfoField>
            )}
            {value.cp && (
              <InfoField label="C.P.">
                <Input value={value.cp} disabled className="text-sm" />
              </InfoField>
            )}
            {value.municipio && (
              <InfoField label="Municipio">
                <Input value={value.municipio} disabled className="text-sm" />
              </InfoField>
            )}
            {value.estado && (
              <InfoField label="Estado">
                <Input value={value.estado} disabled className="text-sm" />
              </InfoField>
            )}
          </div>
        </div>
      )}

      {!hasGoogleMaps && (
        <p className="text-xs text-muted-foreground">
          Usa Google Maps para mejores resultados de búsqueda
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
