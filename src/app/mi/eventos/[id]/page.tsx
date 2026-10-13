import type { Metadata } from "next"
import { EventWorkspace } from "@/components/events/event-workspace"

export const metadata: Metadata = { title: "Evento" }

export default async function MyEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EventWorkspace eventId={id} backHref="/mi/eventos" />
}
