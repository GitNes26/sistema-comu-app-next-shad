import type { Metadata } from "next"
import { CoursePage } from "@/components/school/course-page"

export const metadata: Metadata = { title: "Libro" }

export default async function SchoolCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  return <CoursePage courseId={courseId} />
}
