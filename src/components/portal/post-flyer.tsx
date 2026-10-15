"use client"

import type { CSSProperties } from "react"
import { BookOpen, Megaphone, Newspaper, PenLine } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  excerpt,
  FLYER_FONTS,
  type Flyer,
  type FlyerDesign,
} from "@/lib/portal/flyer"
import { POST_KINDS, type PostKind } from "@/lib/portal/rules"

// Flyer de una publicación. Se dibuja con HTML/CSS (nítido en cualquier tamaño, sin
// generar archivos). La **estructura** (layout) es independiente de colores y tipografía:
// cartel, cita, editorial, titular, dividido, marco, tipográfico y banner.

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
      <img
        src={flyer.url}
        alt={title}
        loading="lazy"
        className={cn("block w-full rounded-2xl object-contain", className)}
      />
    )
  }
  // El contenedor fija la unidad de texto (cqw): el flyer se ve igual en la vista previa y en el feed.
  return (
    <div className="w-full [container-type:inline-size]">
      <TemplateFlyer
        d={flyer}
        title={title}
        body={body}
        churchName={churchName}
        className={className}
      />
    </div>
  )
}

function TemplateFlyer({
  d,
  title,
  body,
  churchName,
  className,
}: {
  d: FlyerDesign
  title: string
  body: string
  churchName?: string | null
  className?: string
}) {
  const font = FLYER_FONTS[d.font]
  const Icon = KIND_ICON[d.template]
  const sub = d.subtitle ?? excerpt(body)
  const style = {
    "--fl-bg": d.bg,
    "--fl-fg": d.fg,
    "--fl-ac": d.accent,
    fontFamily: font.css,
  } as CSSProperties
  const heading = { fontWeight: font.weight } as CSSProperties
  const kindLabel = POST_KINDS[d.template]
  const root = (extra: string) =>
    cn(
      "relative flex w-full overflow-hidden rounded-2xl text-[3.6cqw]",
      extra,
      className
    )

  const photo = d.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={d.imageUrl}
      alt=""
      className="absolute inset-0 size-full object-cover"
    />
  ) : null

  const footer = (
    <div className="mt-auto flex items-end justify-between gap-3 pt-4 text-[0.7em] opacity-90">
      <span className="min-w-0">{d.footer}</span>
      {churchName && (
        <span className="shrink-0 font-semibold tracking-wide uppercase">
          {churchName}
        </span>
      )}
    </div>
  )

  const badge = (
    <span
      className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-[0.7em] font-semibold tracking-wide uppercase"
      style={{ background: "var(--fl-ac)", color: "var(--fl-bg)" }}
    >
      <Icon className="size-[1.1em]" /> {kindLabel}
    </span>
  )
  const bg = (
    <div className="absolute inset-0" style={{ background: "var(--fl-bg)" }} />
  )

  switch (d.layout) {
    // Cartel: imagen arriba, titular enorme en mayúsculas y cinta de acento.
    case "poster":
      return (
        <div style={style} className={root("aspect-[4/5] flex-col")}>
          {bg}
          {photo && (
            <div className="relative h-[38%] w-full overflow-hidden">
              {photo}
              <div
                className="absolute inset-x-0 bottom-0 h-1/2"
                style={{
                  background:
                    "linear-gradient(to top, var(--fl-bg), transparent)",
                }}
              />
            </div>
          )}
          <div
            className="relative flex flex-1 flex-col gap-3 p-[6%]"
            style={{ color: "var(--fl-fg)" }}
          >
            {badge}
            <h3
              className="text-[2.6em] leading-[1.02] uppercase [text-wrap:balance]"
              style={heading}
            >
              {title}
            </h3>
            <span
              className="h-1.5 w-16 rounded-full"
              style={{ background: "var(--fl-ac)" }}
            />
            <p className="text-[1.05em] leading-snug opacity-90 [text-wrap:pretty]">
              {sub}
            </p>
            {footer}
          </div>
        </div>
      )

    // Cita: texto centrado sobre fondo o imagen.
    case "quote":
      return (
        <div
          style={style}
          className={root(
            "aspect-[4/5] flex-col items-center justify-center text-center"
          )}
        >
          {bg}
          {photo}
          {photo && (
            <div
              className="absolute inset-0"
              style={{ background: "var(--fl-bg)", opacity: 0.72 }}
            />
          )}
          <div
            className="relative flex w-full flex-1 flex-col items-center justify-center gap-4 p-[8%]"
            style={{ color: "var(--fl-fg)" }}
          >
            <Icon className="size-[2.2em]" style={{ color: "var(--fl-ac)" }} />
            <h3
              className="text-[2.1em] leading-tight [text-wrap:balance]"
              style={heading}
            >
              “{title}”
            </h3>
            <span
              className="h-px w-20"
              style={{ background: "var(--fl-ac)" }}
            />
            <p className="max-w-[90%] text-[1.05em] leading-relaxed italic opacity-90 [text-wrap:pretty]">
              {sub}
            </p>
          </div>
          <div
            className="relative flex w-full flex-col px-[8%] pb-[6%]"
            style={{ color: "var(--fl-fg)" }}
          >
            {footer}
          </div>
        </div>
      )

    // Editorial: franja lateral de acento, imagen apaisada y texto de lectura.
    case "editorial":
      return (
        <div style={style} className={root("aspect-[4/5]")}>
          {bg}
          <div
            className="relative w-[7%] shrink-0"
            style={{ background: "var(--fl-ac)" }}
          />
          <div
            className="relative flex flex-1 flex-col gap-3 p-[6%]"
            style={{ color: "var(--fl-fg)" }}
          >
            {badge}
            {photo && (
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl">
                {photo}
              </div>
            )}
            <h3
              className="text-[2em] leading-tight [text-wrap:balance]"
              style={heading}
            >
              {title}
            </h3>
            <p className="text-[1em] leading-relaxed opacity-85 [text-wrap:pretty]">
              {sub}
            </p>
            {footer}
          </div>
        </div>
      )

    // Titular: imagen a pantalla completa con titular sobre degradado.
    case "headline":
      return (
        <div
          style={style}
          className={root("aspect-[4/5] flex-col justify-end")}
        >
          {bg}
          {photo}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--fl-bg) 25%, transparent 80%)",
            }}
          />
          <div
            className="relative flex flex-col gap-3 p-[6%]"
            style={{ color: "var(--fl-fg)" }}
          >
            <span
              className="w-fit rounded px-2 py-0.5 text-[0.7em] font-bold tracking-widest uppercase"
              style={{ background: "var(--fl-ac)", color: "var(--fl-bg)" }}
            >
              {kindLabel}
            </span>
            <h3
              className="text-[2.3em] leading-[1.05] [text-wrap:balance]"
              style={heading}
            >
              {title}
            </h3>
            <p className="text-[1em] leading-snug opacity-90 [text-wrap:pretty]">
              {sub}
            </p>
            {footer}
          </div>
        </div>
      )

    // Dividido: mitad de color/imagen con corte diagonal y mitad de texto.
    case "split":
      return (
        <div style={style} className={root("aspect-[4/5] flex-col")}>
          {bg}
          <div
            className="relative h-[46%] w-full overflow-hidden"
            style={{
              background: "var(--fl-ac)",
              clipPath: "polygon(0 0, 100% 0, 100% 78%, 0 100%)",
            }}
          >
            {photo}
            {!photo && (
              <Icon
                className="absolute right-[8%] bottom-[18%] size-[7em] opacity-25"
                style={{ color: "var(--fl-bg)" }}
              />
            )}
          </div>
          <div
            className="relative -mt-[2%] flex flex-1 flex-col gap-3 p-[7%]"
            style={{ color: "var(--fl-fg)" }}
          >
            <p
              className="text-[0.75em] font-bold tracking-[0.2em] uppercase"
              style={{ color: "var(--fl-ac)" }}
            >
              {kindLabel}
            </p>
            <h3
              className="text-[2.1em] leading-[1.05] [text-wrap:balance]"
              style={heading}
            >
              {title}
            </h3>
            <p className="text-[1em] leading-snug opacity-85 [text-wrap:pretty]">
              {sub}
            </p>
            {footer}
          </div>
        </div>
      )

    // Marco: borde doble, imagen circular y texto centrado (invitación).
    case "frame":
      return (
        <div style={style} className={root("aspect-[4/5] flex-col p-[4%]")}>
          {bg}
          <div
            className="relative flex flex-1 flex-col items-center gap-3 rounded-xl border-2 p-[6%] text-center"
            style={{
              borderColor: "var(--fl-ac)",
              color: "var(--fl-fg)",
              outline: "1px solid var(--fl-ac)",
              outlineOffset: "0.5em",
            }}
          >
            {photo ? (
              <div
                className="relative aspect-square w-[34%] overflow-hidden rounded-full ring-2"
                style={{ ["--tw-ring-color" as string]: "var(--fl-ac)" }}
              >
                {photo}
              </div>
            ) : (
              <Icon
                className="size-[2.4em]"
                style={{ color: "var(--fl-ac)" }}
              />
            )}
            <p
              className="text-[0.75em] font-semibold tracking-[0.25em] uppercase"
              style={{ color: "var(--fl-ac)" }}
            >
              {kindLabel}
            </p>
            <h3
              className="text-[2em] leading-tight [text-wrap:balance]"
              style={heading}
            >
              {title}
            </h3>
            <span
              className="h-px w-16"
              style={{ background: "var(--fl-ac)" }}
            />
            <p className="text-[1em] leading-relaxed opacity-90 [text-wrap:pretty]">
              {sub}
            </p>
            {footer}
          </div>
        </div>
      )

    // Tipográfico: solo letra, enorme, sobre color sólido.
    case "type":
      return (
        <div
          style={style}
          className={root("aspect-[4/5] flex-col justify-between p-[7%]")}
        >
          {bg}
          <p
            className="relative text-[0.8em] font-bold tracking-[0.25em] uppercase"
            style={{ color: "var(--fl-ac)" }}
          >
            {kindLabel}
          </p>
          <h3
            className="relative text-[4.4em] leading-[0.95] tracking-tight break-words [text-wrap:balance]"
            style={{ ...heading, color: "var(--fl-fg)" }}
          >
            {title}
          </h3>
          <div
            className="relative flex flex-col gap-2"
            style={{ color: "var(--fl-fg)" }}
          >
            <span
              className="h-2 w-24 rounded-full"
              style={{ background: "var(--fl-ac)" }}
            />
            <p className="text-[1em] leading-snug opacity-85 [text-wrap:pretty]">
              {sub}
            </p>
            {footer}
          </div>
        </div>
      )

    // Banner: formato apaisado (16:9) para compartir; texto a la izquierda, imagen a la derecha.
    case "banner":
    default:
      return (
        <div style={style} className={root("aspect-[16/9]")}>
          {bg}
          <div
            className="relative flex w-[58%] flex-col justify-center gap-2 p-[5%]"
            style={{ color: "var(--fl-fg)" }}
          >
            <p
              className="text-[0.75em] font-bold tracking-[0.2em] uppercase"
              style={{ color: "var(--fl-ac)" }}
            >
              {kindLabel}
            </p>
            <h3
              className="text-[2.1em] leading-[1.05] [text-wrap:balance]"
              style={heading}
            >
              {title}
            </h3>
            <p className="line-clamp-3 text-[0.95em] leading-snug opacity-85">
              {sub}
            </p>
            {footer}
          </div>
          <div
            className="relative flex-1"
            style={{
              background: "var(--fl-ac)",
              clipPath: "polygon(14% 0, 100% 0, 100% 100%, 0 100%)",
            }}
          >
            {photo}
            {!photo && (
              <Icon
                className="absolute top-1/2 left-1/2 size-[5em] -translate-x-1/2 -translate-y-1/2 opacity-30"
                style={{ color: "var(--fl-bg)" }}
              />
            )}
          </div>
        </div>
      )
  }
}
