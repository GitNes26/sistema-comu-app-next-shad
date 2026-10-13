import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { DocumentViewer } from "@/components/school/document-viewer"

export const metadata: Metadata = { title: "Libro digital" }

export default async function AdminBookPage({ params }: { params: Promise<{ documentId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const { documentId } = await params
  return <DocumentViewer documentId={documentId} backHref="/admin/school" />
}
