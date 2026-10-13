import type { Metadata } from "next"
import { MyKids } from "@/components/kids/my-kids"

export const metadata: Metadata = { title: "Mis hijos" }

// Los hijos se resuelven por la sesión (relación de tutela); no recibe ids.
export default function MyKidsPage() {
  return <MyKids />
}
