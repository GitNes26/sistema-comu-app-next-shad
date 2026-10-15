import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { PublicTheme } from "@/components/public/public-theme"
import { CellFinder } from "@/components/cells/cell-finder"
import { getPublicChurch } from "@/lib/connect/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Encuentra tu hogar de amor" }

export default async function HomesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const church = await getPublicChurch(slug)
  if (!church) notFound()
  return (
    <div className="min-h-dvh bg-muted/30">
      <PublicTheme primary={church.hue?.primary} accent={church.hue?.accent} />
      <div className="mx-auto max-w-4xl px-5 py-[max(1.5rem,env(safe-area-inset-top))] sm:px-8">
        <Link href={`/c/${church.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {church.name}
        </Link>
        <h1 className="mt-5 font-heading text-3xl font-semibold tracking-tight text-balance">Encuentra tu hogar de amor</h1>
        <p className="mt-2 mb-6 text-muted-foreground">Reuniones en casa durante la semana: una familia pequeña donde caminamos juntos. Elige el más cercano a ti.</p>
        <CellFinder mode={{ kind: "public", slug: church.slug }} churchName={church.name} />
      </div>
    </div>
  )
}
