import type { Metadata } from "next"
import { Ticket } from "lucide-react"
import { PageHero } from "@/components/mi/page-hero"
import { MyEvents } from "@/components/events/my-events"

export const metadata: Metadata = { title: "Eventos" }

export default function MyEventsPage() {
  return (
    <div className="w-full space-y-5">
      <PageHero icon={Ticket} title="Eventos" description="Aparta tu boleto y, cuando el evento lo permite, elige tu lugar." />
      <MyEvents />
    </div>
  )
}
