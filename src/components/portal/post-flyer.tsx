"use client"

import type { CSSProperties } from "react"
import { BookOpen, Megaphone, Newspaper, PenLine } from "lucide-react"
import { cn } from "@/lib/utils"
import { excerpt, FLYER_FONTS, type Flyer, type FlyerDesign } from "@/lib/portal/flyer"
import { POST_KINDS, type PostKind } from "@/lib/portal/rules"

// Flyer de una publicación. Se dibuja con HTML/CSS (nítido en cualquier tamaño, sin
// generar archivos): la plantilla depende del tipo de aviso y respeta colores y tipografía.

const KIND_ICON: Record<PostKind, typeof Megaphone> = {
  announcement: Megaphone,
  devotional: BookOpen,
  article: PenLine,
  news: Newspaper,
}

export function PostFlyer({
  flyer,
  title,
  body,
  kind,
  churchName,
  className,
}: {
  flyer: Flyer
  title: string
  body: string
  kind: PostKind
  churchName?: string | null
  className?: string
}) {
  if (flyer.mode === "upload") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={flyer.url} alt={title} loading="lazy" className={cn("block w-full rounded-2xl object-contain", className)} />
    )
  }
  // El contenedor fija la unidad de texto (cqw): el flyer se ve igual en la vista previa y en el feed.
  return (
    <div className="w-full [container-type:inline-size]">
      <TemplateFlyer d={flyer} title={title} body={body} churchName={churchName} className={className} />
    </div>
  )
}

function TemplateFlyer({ d, title, body, churchName, className }: { d: FlyerDesign; title: string; body: string; churchName?: string | null; className?: string }) {
  const font = FLYER_FONTS[d.font]
  const Icon = KIND_ICON[d.template]
  const sub = d.subtitle ?? excerpt(body)
  const style = { "--fl-bg": d.bg, "--fl-fg": d.fg, "--fl-ac": d.accent, fontFamily: font.css } as CSSProperties
  const heading = { fontWeight: font.weight } as CSSProperties
  const kindLabel = POST_KINDS[d.template]

  const photo = d.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={d.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
  ) : null

  const footer = (
    <div className="mt-auto flex items-end justify-between gap-3 pt-4 text-[0.7em] opacity-90">
      <span className="min-w-0">{d.footer}</span>
      {churchName && <span className="shrink-0 font-semibold tracking-wide uppercase">{churchName}</span>}
    </div>
  )

  const badge = (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-[0.7em] font-semibold tracking-wide uppercase" style={{ background: "var(--fl-ac)", color: "var(--fl-bg)" }}>
      <Icon className="size-[1.1em]" /> {kindLabel}
    </span>
  )

  // Anuncio: cartel. Imagen arriba (si hay), titular enorme, cinta de acento.
  if (d.template === "announcement") {
    return (
      <div style={style} className={cn("relative flex aspect-[4/5] w-full flex-col overflow-hidden rounded-2xl text-[3.6cqw]", className)}>
        <div className="absolute inset-0" style={{ background: "var(--fl-bg)" }} />
        {photo && (
          <div className="relative h-[38%] w-full overflow-hidden">
            {photo}
            <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(to top, var(--fl-bg), transparent)" }} />
          </div>
        )}
        <div className="relative flex flex-1 flex-col gap-3 p-[6%]" style={{ color: "var(--fl-fg)" }}>
          {badge}
          <h3 className="text-[2.6em] leading-[1.02] uppercase [text-wrap:balance]" style={heading}>
            {title}
          </h3>
          <span className="h-1.5 w-16 rounded-full" style={{ background: "var(--fl-ac)" }} />
          <p className="text-[1.05em] leading-snug opacity-90 [text-wrap:pretty]">{sub}</p>
          {footer}
        </div>
      </div>
    )
  }

  // Devocional: cita centrada sobre la imagen o el fondo.
  if (d.template === "devotional") {
    return (
      <div style={style} className={cn("relative flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden rounded-2xl text-center text-[3.6cqw]", className)}>
        <div className="absolute inset-0" style={{ background: "var(--fl-bg)" }} />
        {photo}
        {photo && <div className="absolute inset-0" style={{ background: "var(--fl-bg)", opacity: 0.72 }} />}
        <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-4 p-[8%]" style={{ color: "var(--fl-fg)" }}>
          <Icon className="size-[2.2em]" style={{ color: "var(--fl-ac)" }} />
          <h3 className="text-[2.1em] leading-tight [text-wrap:balance]" style={heading}>
            “{title}”
          </h3>
          <span className="h-px w-20" style={{ background: "var(--fl-ac)" }} />
          <p className="max-w-[90%] text-[1.05em] leading-relaxed italic opacity-90 [text-wrap:pretty]">{sub}</p>
        </div>
        <div className="relative flex w-full flex-col px-[8%] pb-[6%]" style={{ color: "var(--fl-fg)" }}>
          {footer}
        </div>
      </div>
    )
  }

  // Artículo: franja lateral de acento y composición editorial.
  if (d.template === "article") {
    return (
      <div style={style} className={cn("relative flex aspect-[4/5] w-full overflow-hidden rounded-2xl text-[3.6cqw]", className)}>
        <div className="absolute inset-0" style={{ background: "var(--fl-bg)" }} />
        <div className="relative w-[7%] shrink-0" style={{ background: "var(--fl-ac)" }} />
        <div className="relative flex flex-1 flex-col gap-3 p-[6%]" style={{ color: "var(--fl-fg)" }}>
          {badge}
          {photo && (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl">
              {photo}
            </div>
          )}
          <h3 className="text-[2em] leading-tight [text-wrap:balance]" style={heading}>
            {title}
          </h3>
          <p className="text-[1em] leading-relaxed opacity-85 [text-wrap:pretty]">{sub}</p>
          {footer}
        </div>
      </div>
    )
  }

  // Noticia: imagen de fondo completa, titular sobre degradado y cintillo.
  return (
    <div style={style} className={cn("relative flex aspect-[4/5] w-full flex-col justify-end overflow-hidden rounded-2xl text-[3.6cqw]", className)}>
      <div className="absolute inset-0" style={{ background: "var(--fl-bg)" }} />
      {photo}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--fl-bg) 25%, transparent 80%)" }} />
      <div className="relative flex flex-col gap-3 p-[6%]" style={{ color: "var(--fl-fg)" }}>
        <span className="w-fit rounded px-2 py-0.5 text-[0.7em] font-bold tracking-widest uppercase" style={{ background: "var(--fl-ac)", color: "var(--fl-bg)" }}>
          {kindLabel}
        </span>
        <h3 className="text-[2.3em] leading-[1.05] [text-wrap:balance]" style={heading}>
          {title}
        </h3>
        <p className="text-[1em] leading-snug opacity-90 [text-wrap:pretty]">{sub}</p>
        {footer}
      </div>
    </div>
  )
}
