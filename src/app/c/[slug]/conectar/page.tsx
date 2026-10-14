import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { PublicTheme } from "@/components/public/public-theme"
import { ConnectForm } from "@/components/public/connect-form"
import { getPublicChurch } from "@/lib/connect/server"
import { isCardKind } from "@/lib/connect/rules"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ tipo?: string }> }

export const metadata: Metadata = { title: "Quiero conectarme" }

export default async function ConnectPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { tipo } = await searchParams
  const church = await getPublicChurch(slug)
  if (!church) notFound()

  return (
    <div className="min-h-dvh bg-muted/30">
      <PublicTheme primary={church.hue?.primary} accent={church.hue?.accent} />
      <div className="mx-auto max-w-2xl px-5 py-[max(1.5rem,env(safe-area-inset-top))] sm:px-8">
        <Link href={`/c/${church.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {church.name}
        </Link>
        <h1 className="mt-5 font-heading text-3xl font-semibold tracking-tight text-balance">Nos da mucho gusto que estés aquí</h1>
        <p className="mt-2 mb-6 text-muted-foreground">Cuéntanos qué necesitas y alguien de la familia te acompañará.</p>
        <ConnectForm slug={church.slug} churchName={church.name} initialKind={isCardKind(tipo) ? tipo : "visitor"} />
      </div>
    </div>
  )
}
