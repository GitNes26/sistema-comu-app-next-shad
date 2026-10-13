import type { Metadata } from "next"
import { DocumentViewer } from "@/components/school/document-viewer"

export const metadata: Metadata = { title: "Libro digital" }

// El servidor decide qué páginas entrega según la última clase del grupo.
export default async function BookPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params
  return <DocumentViewer documentId={documentId} backHref="/mi/escuela" />
}
