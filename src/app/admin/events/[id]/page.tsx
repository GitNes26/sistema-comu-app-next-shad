import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { EventWorkspace } from "@/components/events/event-workspace"

export const metadata: Metadata = { title: "Evento" }

// El acceso real (permiso global, liderar el grupo o público del evento) lo decide la API.
export default async function AdminEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const { id } = await params
  return <EventWorkspace eventId={id} backHref="/admin/events" />
}
