"use client"

import * as React from "react"
import {
  Camera,
  MapPin,
  FolderOpen,
  Mic,
  Bell,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type PermissionType = "camera" | "geolocation" | "files" | "microphone" | "notifications"

interface PermissionSliderProps {
  type: PermissionType
  open: boolean
  onOpenChange: (open: boolean) => void
  onGranted?: () => void
  onDenied?: () => void
}

const PERMISSION_CONFIG: Record<
  PermissionType,
  {
    title: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    browserPermission?: PermissionName
    requestFn?: () => Promise<boolean>
  }
> = {
  camera: {
    title: "Permiso de Cámara",
    description:
      "Para escanear códigos QR y tomar fotos de productos, necesitamos acceso a tu cámara.",
    icon: Camera,
    browserPermission: "camera" as PermissionName,
    requestFn: async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach((t) => t.stop())
        return true
      } catch {
        return false
      }
    },
  },
  geolocation: {
    title: "Permiso de Ubicación",
    description:
      "Para calcular distancias de entrega y encontrar la sede más cercana, necesitamos tu ubicación.",
    icon: MapPin,
    browserPermission: "geolocation" as PermissionName,
    requestFn: async () => {
      return new Promise((resolve) => {
        if (!window.isSecureContext || !navigator.geolocation) {
          resolve(false)
          return
        }
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 }
        )
      })
    },
  },
  files: {
    title: "Permiso de Archivos",
    description:
      "Para subir imágenes de productos, evidencia de entrega y documentos, necesitamos acceso a tus archivos.",
    icon: FolderOpen,
    requestFn: async () => {
      try {
        if ("showOpenFilePicker" in window) {
          const handle = await (window as Record<string, unknown> & { showOpenFilePicker: (opts?: Record<string, unknown>) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
            multiple: false,
            types: [
              {
                description: "Imágenes",
                accept: { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] },
              },
            ],
          });
          return handle.length > 0;
        }
        return true
      } catch {
        return false
      }
    },
  },
  microphone: {
    title: "Permiso de Micrófono",
    description:
      "Para búsquedas por voz y comunicaciones en tiempo real, necesitamos acceso a tu micrófono.",
    icon: Mic,
    browserPermission: "microphone" as PermissionName,
    requestFn: async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
        return true
      } catch {
        return false
      }
    },
  },
  notifications: {
    title: "Permiso de Notificaciones",
    description:
      "Para recibir alertas de nuevos pedidos, actualizaciones de estado y promociones.",
    icon: Bell,
    browserPermission: "notifications" as PermissionName,
    requestFn: async () => {
      try {
        const result = await Notification.requestPermission()
        return result === "granted"
      } catch {
        return false
      }
    },
  },
}

export function PermissionSlider({
  type,
  open,
  onOpenChange,
  onGranted,
  onDenied,
}: PermissionSliderProps) {
  const [status, setStatus] = React.useState<"idle" | "checking" | "granted" | "denied">("idle")
  const config = PERMISSION_CONFIG[type]
  const Icon = config.icon

  const checkPermission = React.useCallback(async () => {
    setStatus("checking")
    try {
      if (config.browserPermission && navigator.permissions) {
        const result = await navigator.permissions.query({
          name: config.browserPermission,
        })
        if (result.state === "granted") {
          setStatus("granted")
          onGranted?.()
          return
        }
        if (result.state === "denied") {
          setStatus("denied")
          return
        }
      }
      setStatus("idle")
    } catch {
      setStatus("idle")
    }
  }, [config, onGranted])

  React.useEffect(() => {
    if (open) checkPermission()
  }, [open, checkPermission])

  const handleRequest = async () => {
    setStatus("checking")
    try {
      const granted = await config.requestFn?.()
      if (granted) {
        setStatus("granted")
        onGranted?.()
        setTimeout(() => onOpenChange(false), 1200)
      } else {
        setStatus("denied")
        onDenied?.()
      }
    } catch {
      setStatus("denied")
      onDenied?.()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Icon className="size-7 text-primary" />
          </div>
          <DialogTitle className="text-center">{config.title}</DialogTitle>
          <DialogDescription className="text-center text-sm">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          {status === "granted" && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-success-ink">
              <CheckCircle2 className="size-4 shrink-0" />
              Permiso concedido
            </div>
          )}
          {status === "denied" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                <XCircle className="size-4 shrink-0" />
                Permiso denegado
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>
                  Ve a la configuración de tu navegador o sistema para habilitar el permiso
                  manualmente.
                </span>
              </div>
            </div>
          )}
          {status === "idle" && (
            <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>Haz clic en &quot;Permitir&quot; para otorgar el permiso.</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          {status !== "granted" && (
            <Button
              size="sm"
              onClick={handleRequest}
              disabled={status === "checking" || status === "denied"}
            >
              {status === "checking" ? "Verificando…" : "Permitir"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hook便捷方式
export function usePermissionSlider(type: PermissionType) {
  const [open, setOpen] = React.useState(false)
  const [granted, setGranted] = React.useState(false)

  const request = React.useCallback(() => {
    if (granted) {
      return true
    }
    setOpen(true)
    return false
  }, [granted])

  return {
    open,
    setOpen,
    granted,
    setGranted,
    request,
    Slider: (
      <PermissionSlider
        type={type}
        open={open}
        onOpenChange={setOpen}
        onGranted={() => setGranted(true)}
      />
    ),
  }
}
