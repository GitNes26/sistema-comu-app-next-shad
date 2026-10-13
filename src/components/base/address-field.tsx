"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { LocationSearch } from "@/components/shared/location-search"
import type { LocationResult } from "@/hooks/use-location"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { MapPin } from "lucide-react"

export interface AddressGpsValue {
  lat: number
  lon: number
}

interface AddressFieldProps {
  id?: string
  address: string
  onAddressChange: (address: string) => void
  latitude: number | null
  longitude: number | null
  onGpsChange: (gps: AddressGpsValue | null) => void
  label?: string
  required?: boolean
  disabled?: boolean
  className?: string
  textarea?: boolean
  showMap?: boolean
  placeholder?: string
  helper?: React.ReactNode
  error?: string
  icon?: React.ReactNode
}

export function AddressField({
  id,
  address,
  onAddressChange,
  latitude,
  longitude,
  onGpsChange,
  label = "Dirección",
  required,
  disabled,
  className,
  showMap = true,
  placeholder = "Calle, número, colonia, ciudad…",
  helper,
  error,
  icon,
}: AddressFieldProps) {
  const autoId = React.useId().replace(/:/g, "")
  const fieldId = id ?? `address-${autoId}`
  function handleChange(newAddress: string, coords: { lat: number; lon: number } | null) {
    onAddressChange(newAddress)
    if (coords) {
      onGpsChange(coords)
    }
  }

  function handleLocationSelect(result: LocationResult) {
    onAddressChange(result.address)
    onGpsChange({ lat: result.coords.lat, lon: result.coords.lon })
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{icon ?? <MapPin className="size-4" />}</span>
        <Label htmlFor={fieldId} className="cursor-pointer">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        {helper && <InfoTooltip text={helper} />}
      </div>

      <LocationSearch
        id={fieldId}
        value={address}
        onChange={handleChange}
        onLocationSelect={handleLocationSelect}
        lat={latitude}
        lon={longitude}
        placeholder={placeholder}
        disabled={disabled}
        showMap={showMap}
        showDetect={true}
        validationError={error}
      />
      {error && <p id={`${fieldId}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
