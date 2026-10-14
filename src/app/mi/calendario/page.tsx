import type { Metadata } from "next"
import { ChurchCalendar } from "@/components/calendar/church-calendar"

export const metadata: Metadata = { title: "Calendario" }

export default function CalendarPage() {
  return <ChurchCalendar />
}
