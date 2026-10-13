import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MyEvents } from "@/components/events/my-events"

export const metadata: Metadata = { title: "Eventos" }

export default function MyEventsPage() {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/mi">
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
      </Button>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Eventos</h1>
        <p className="text-sm text-muted-foreground">Aparta tu boleto y, cuando el evento lo permite, elige tu lugar.</p>
      </div>
      <MyEvents />
    </div>
  )
}
