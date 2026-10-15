import type { Metadata } from "next"
import { CalendarClock } from "lucide-react"
import { PageHero } from "@/components/mi/page-hero"
import { GatheringsOverview } from "@/components/gatherings/gatherings-overview"

export const metadata: Metadata = { title: "Reuniones" }

export default function MyGatheringsPage() {
  return (
    <div className="w-full space-y-5">
      <PageHero icon={CalendarClock} title="Reuniones" description="Cuándo nos reunimos y de qué se ha hablado." />
      <GatheringsOverview />
    </div>
  )
}
