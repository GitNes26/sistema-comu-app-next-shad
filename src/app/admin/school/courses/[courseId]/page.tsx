import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { CourseEditor } from "@/components/school/course-editor"

export const metadata: Metadata = { title: "Libro" }

// El acceso real (administración o dirección del programa) lo decide la API.
export default async function AdminCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const { courseId } = await params
  return <CourseEditor courseId={courseId} />
}
