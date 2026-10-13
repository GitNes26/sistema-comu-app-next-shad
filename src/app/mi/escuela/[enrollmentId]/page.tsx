import type { Metadata } from "next"
import { StudentPortal } from "@/components/school/student-portal"

export const metadata: Metadata = { title: "Mi libro" }

export default async function MyBookPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params
  return <StudentPortal enrollmentId={enrollmentId} backHref="/mi/escuela" />
}
