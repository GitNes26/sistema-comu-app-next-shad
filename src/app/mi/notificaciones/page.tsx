import type { Metadata } from "next"
import { BellRing } from "lucide-react"
import { NotificationsCenter } from "@/components/admin/notifications/notifications-center"

export const metadata: Metadata = { title: "Notificaciones" }

// Bandeja de avisos de la persona (anuncios, transmisiones, pagos, diplomas…).
export default function MyNotificationsPage() {
  return <NotificationsCenter icon={<BellRing className="size-5" />} />
}
