// Reglas puras del portal del creyente (sin base de datos): tipos de publicación,
// estados de transmisión y conversión de enlaces de YouTube/Facebook a su reproductor.

export const POST_KINDS = {
  announcement: "Anuncio",
  devotional: "Devocional",
  article: "Artículo",
  news: "Noticia",
} as const
export type PostKind = keyof typeof POST_KINDS
export const isPostKind = (v: unknown): v is PostKind => typeof v === "string" && v in POST_KINDS

export const POST_AUDIENCES = { all: "Toda la iglesia", leaders: "Solo líderes" } as const
export type PostAudience = keyof typeof POST_AUDIENCES
export const isPostAudience = (v: unknown): v is PostAudience => typeof v === "string" && v in POST_AUDIENCES

export const STREAM_STATUS = { scheduled: "Programada", live: "En vivo", ended: "Terminada" } as const
export type StreamStatus = keyof typeof STREAM_STATUS
export const isStreamStatus = (v: unknown): v is StreamStatus => typeof v === "string" && v in STREAM_STATUS

export const STREAM_PLATFORMS = { youtube: "YouTube", facebook: "Facebook" } as const
export type StreamPlatform = keyof typeof STREAM_PLATFORMS

export interface ParsedStream {
  platform: StreamPlatform
  /** Enlace normalizado (el que se guarda). */
  url: string
  /** Dirección del reproductor incrustado. */
  embedUrl: string
}

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtube-nocookie.com", "youtube-nocookie.com"])
const FB_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch", "www.fb.watch"])
const YT_ID = /^[A-Za-z0-9_-]{11}$/
const YT_CHANNEL = /^UC[A-Za-z0-9_-]{22}$/

/**
 * Reconoce un enlace de YouTube o de Facebook y arma su reproductor. Solo acepta
 * https y esos dos orígenes: lo demás devuelve null (nunca se incrusta una dirección libre).
 */
export function parseStreamUrl(raw: string): ParsedStream | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== "https:") return null
  const host = u.hostname.toLowerCase()
  const parts = u.pathname.split("/").filter(Boolean)

  if (YT_HOSTS.has(host)) {
    let id: string | null = null
    if (host === "youtu.be") id = parts[0] ?? null
    else if (u.pathname === "/watch") id = u.searchParams.get("v")
    else if (["live", "embed", "shorts", "v"].includes(parts[0] ?? "")) id = parts[1] ?? null
    if (id && YT_ID.test(id)) {
      return { platform: "youtube", url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` }
    }
    // Directo permanente de un canal: youtube.com/channel/UC…/live
    if (parts[0] === "channel" && YT_CHANNEL.test(parts[1] ?? "") && parts[2] === "live") {
      return {
        platform: "youtube",
        url: `https://www.youtube.com/channel/${parts[1]}/live`,
        embedUrl: `https://www.youtube-nocookie.com/embed/live_stream?channel=${parts[1]}`,
      }
    }
    return null
  }

  if (FB_HOSTS.has(host)) {
    const isVideo = host.endsWith("fb.watch") || parts.includes("videos") || parts[0] === "watch" || parts[0] === "reel" || parts.includes("posts")
    if (!isVideo) return null
    u.hash = ""
    const url = u.toString()
    if (url.length > 500) return null
    return {
      platform: "facebook",
      url,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=560`,
    }
  }
  return null
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
/** «Miércoles · 19:30». */
export function weeklySlotLabel(dayOfWeek: number, startTime: string): string {
  return `${DAY_NAMES[((dayOfWeek % 7) + 7) % 7]} · ${startTime}`
}
