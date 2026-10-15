import type { Metadata } from "next"
import { MyFamily } from "@/components/families/my-family"

export const metadata: Metadata = { title: "Mi familia" }

export default function MyFamilyPage() {
  return <MyFamily />
}
