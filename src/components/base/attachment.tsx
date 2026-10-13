"use client"

import * as React from "react"
import Cropper from "react-easy-crop"
import "react-easy-crop/react-easy-crop.css"
import type { Area } from "react-easy-crop"
import {
  Camera,
  CameraOff,
  FileText,
  ImagePlus,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { DialogComponent } from "@/components/ui/dialog"
import { InfoTooltip } from "@/components/base/info-tooltip"

export interface AttachmentProps {
  value?: string | null
  onChange?: (value: string | null) => void
  onFileChange?: (file: File | null) => void
  upload?: (file: File) => Promise<string>
  accept?: string
  maxSizeMB?: number
  label?: string
  helper?: React.ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
  hint?: string
  widthClass?: string
  heightClass?: string
  /** Proporción del recorte (default 1 = cuadrado). */
  cropAspect?: number
}

const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,.pdf"

function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function cropImage(imageSrc: string, pixelCrop: Area): Promise<File> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  canvas.width = Math.round(pixelCrop.width)
  canvas.height = Math.round(pixelCrop.height)
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  )
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  )
  if (!blob) throw new Error("No se pudo recortar la imagen")
  return new File([blob], "recorte.png", { type: "image/png" })
}

export function Attachment({
  value,
  onChange,
  onFileChange,
  upload,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 5,
  label,
  helper,
  required,
  disabled,
  className,
  hint,
  widthClass = "w-40",
  heightClass = "h-40",
  cropAspect = 1,
}: AttachmentProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const cameraRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [uploading, setUploading] = React.useState(false)
  const [imgError, setImgError] = React.useState(false)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const localPreviewRef = React.useRef<string>("")
  // null = detectando; true/false = hay/no hay cámara disponible.
  const [hasCamera, setHasCamera] = React.useState<boolean | null>(null)

  React.useEffect(() => () => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current)
  }, [])

  React.useEffect(() => {
    if (!uploading && value && previewUrl) {
      URL.revokeObjectURL(previewUrl)
      localPreviewRef.current = ""
      setPreviewUrl(null)
    }
  }, [previewUrl, uploading, value])

  React.useEffect(() => {
    let active = true
    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.enumerateDevices !== "function"
    ) {
      setHasCamera(false)
      return
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (active) setHasCamera(devices.some((d) => d.kind === "videoinput"))
      })
      .catch(() => {
        if (active) setHasCamera(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Crop state
  const [cropOpen, setCropOpen] = React.useState(false)
  const [cropSrc, setCropSrc] = React.useState<string>("")
  const [cropFile, setCropFile] = React.useState<File | null>(null)
  const [crop, setCrop] = React.useState({ x: 0, y: 0 })
  const [zoom, setZoom] = React.useState(1)
  const [croppedArea, setCroppedArea] = React.useState<Area | null>(null)

  const acceptsImageOnly = accept.split(",").every((a) => a.trim().startsWith("image/"))
  // Las imágenes persistidas se sirven desde rutas sin extensión; el contrato
  // `accept` es una fuente más confiable que la URL para elegir el preview.
  const isImage = acceptsImageOnly || Boolean(value?.match(/^data:image\//) || value?.match(/\.(png|jpe?g|webp|gif|svg)(?:\?|$)/i))

  async function saveFile(file: File) {
    onFileChange?.(file)
    setImgError(false)
    if (file.type.startsWith("image/")) {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current)
      localPreviewRef.current = URL.createObjectURL(file)
      setPreviewUrl(localPreviewRef.current)
    }
    if (upload) {
      setUploading(true)
      try {
        const url = await upload(file)
        onChange?.(url)
      } catch (uploadError) {
        if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current)
        localPreviewRef.current = ""
        setPreviewUrl(null)
        setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir el archivo.")
      } finally {
        setUploading(false)
      }
    } else {
      const localUrl = URL.createObjectURL(file)
      localPreviewRef.current = localUrl
      onChange?.(localUrl)
    }
  }

  async function processFile(file: File) {
    setError(undefined)
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo excede ${maxSizeMB} MB.`)
      return
    }
    if (accept) {
      const ok = file.type
        ? accept.split(",").map((a) => a.trim().toLowerCase()).some(
            (a) => a === file.type.toLowerCase() || (a.startsWith(".") && file.name.toLowerCase().endsWith(a))
          )
        : true
      if (!ok) {
        setError("Tipo de archivo no permitido.")
        return
      }
    }

    // Si es imagen, abre el editor de recorte antes de guardar.
    if (acceptsImageOnly && file.type.startsWith("image/")) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(file)
      })
      setCropSrc(dataUrl)
      setCropFile(file)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedArea(null)
      setCropOpen(true)
      return
    }

    await saveFile(file)
  }

  async function confirmCrop() {
    if (!croppedArea || !cropSrc) return
    setCropOpen(false)
    try {
      const file = await cropImage(cropSrc, croppedArea)
      await saveFile(file)
    } catch {
      setError("No se pudo recortar la imagen.")
    }
  }

  async function skipCrop() {
    setCropOpen(false)
    if (cropFile) await saveFile(cropFile)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void processFile(file)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <Label className="leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void processFile(file)
          e.target.value = ""
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void processFile(file)
          e.target.value = ""
        }}
      />

      <div className={cn("flex items-start gap-3")}>
        {value || previewUrl ? (
          <div className={cn("relative overflow-hidden rounded-lg border bg-card", widthClass, heightClass)}>
            {uploading && <div className="absolute inset-0 z-10 grid place-items-center bg-background/60"><Loader2 className="size-6 animate-spin" /></div>}
            {isImage && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl ?? value ?? ""}
                alt="Adjunto"
                className="size-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : isImage && imgError ? (
              <div className="grid h-full w-full place-items-center bg-muted text-muted-foreground">
                <ImagePlus className="size-8" />
              </div>
            ) : (
              <object data={value ?? undefined} type="application/pdf" className="size-full" aria-label="Vista previa de PDF">
                <div className="grid h-full w-full place-items-center text-muted-foreground">
                  <FileText className="size-8" />
                </div>
              </object>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-muted-foreground transition-all",
              "hover:-translate-y-0.5 hover:border-primary/60 hover:bg-accent/40 hover:shadow-sm",
              dragging && "border-primary bg-accent",
              widthClass,
              heightClass
            )}
          >
            <UploadCloud className="size-6" />
            <span className="px-2 text-center text-xs">Arrastra o haz clic</span>
            <span className="px-2 text-center text-xs text-muted-foreground/70">Máx {maxSizeMB} MB</span>
          </button>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            {value || previewUrl ? "Reemplazar" : "Subir"}
          </Button>
          {acceptsImageOnly &&
            (hasCamera === false ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="cursor-not-allowed opacity-60"
                title="No se detectó una cámara en este dispositivo"
              >
                <CameraOff className="size-4" />
                Cámara no encontrada
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || uploading || hasCamera === null}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="size-4" />
                Tomar foto
              </Button>
            ))}
          {(value || previewUrl) && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || uploading}
                onClick={() => {
                  setPreviewUrl(null)
                  onChange?.(null)
                }}
              >
                <Trash2 className="size-4" />
                Quitar
              </Button>
            </>
          )}
        </div>
      </div>

      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs leading-relaxed text-destructive">{error}</p>}

      <DialogComponent
        open={cropOpen}
        onOpenChange={(o) => !o && setCropOpen(false)}
        title="Recortar imagen"
        description="Ajusta el encuadre; puedes recortar solo la parte que quieras."
        className="sm:max-w-lg"
        bodyClassName="space-y-3"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCropOpen(false)}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={() => void skipCrop()}>
              Usar completa
            </Button>
            <Button onClick={() => void confirmCrop()}>Recortar</Button>
          </>
        }
      >
          <div className="relative h-72 w-full overflow-hidden rounded-lg bg-black/60">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={cropAspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => setCroppedArea(areaPixels)}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Slider
              min={1}
              max={3}
              step={0.01}
              value={[zoom]}
              onValueChange={(v) => setZoom(v[0])}
            />
          </div>
      </DialogComponent>
    </div>
  )
}
