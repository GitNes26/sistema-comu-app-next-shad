import type { Metadata } from "next"
import { Gradebook } from "@/components/school/gradebook"

export const metadata: Metadata = { title: "Mi grupo" }

export default async function MyGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  return <Gradebook groupId={groupId} backHref="/mi/escuela" />
}
