"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * En la app instalada (PWA) un enlace con `target="_blank"` o `window.open`
 * saca al usuario al navegador. Aquí, los enlaces internos de pantallas (admin,
 * POS, portal…) se abren en la misma ventana. Los PDF y descargas (`/api/…`)
 * conservan su comportamiento.
 */
export function PwaLinkGuard() {
  const router = useRouter()

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (!standalone) return

    const internal = (raw: string | URL | undefined | null) => {
      if (!raw) return null
      try {
        const url = new URL(String(raw), window.location.href)
        if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return null
        return `${url.pathname}${url.search}${url.hash}`
      } catch {
        return null
      }
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
      const anchor = (event.target as Element | null)?.closest?.("a[target='_blank']") as HTMLAnchorElement | null
      if (!anchor || anchor.hasAttribute("download")) return
      const path = internal(anchor.href)
      if (!path) return
      event.preventDefault()
      router.push(path)
    }

    const originalOpen = window.open.bind(window)
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      const path = target === "_blank" || target === undefined ? internal(url) : null
      if (path) {
        router.push(path)
        return null
      }
      return originalOpen(url, target, features)
    }) as typeof window.open

    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      window.open = originalOpen
    }
  }, [router])

  return null
}
