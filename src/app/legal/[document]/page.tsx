import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocument, LEGAL_DOCUMENTS, type LegalDocumentKey } from "@/components/legal/legal-document";
export function generateStaticParams() { return Object.keys(LEGAL_DOCUMENTS).map((document) => ({ document })); }
export async function generateMetadata({ params }: { params: Promise<{ document: string }> }): Promise<Metadata> { const { document } = await params; const data = LEGAL_DOCUMENTS[document as LegalDocumentKey]; return data ? { title: data.title, description: data.summary } : {}; }
export default async function LegalDocumentPage({ params }: { params: Promise<{ document: string }> }) { const { document } = await params; if (!(document in LEGAL_DOCUMENTS)) notFound(); return <LegalDocument document={document as LegalDocumentKey} />; }
