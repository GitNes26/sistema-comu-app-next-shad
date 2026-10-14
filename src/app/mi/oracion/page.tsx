import type { Metadata } from "next"
import { MyPrayers } from "@/components/connect/my-prayers"

export const metadata: Metadata = { title: "Oración" }

export default function MyPrayerPage() {
  return <MyPrayers />
}
