import type { Metadata } from "next"
import { DiplomaView } from "@/components/school/diploma-view"

export const metadata: Metadata = { title: "Diploma" }

export default async function DiplomaPage({ params }: { params: Promise<{ diplomaId: string }> }) {
  const { diplomaId } = await params
  return <DiplomaView diplomaId={diplomaId} backHref="/mi/escuela" />
}
