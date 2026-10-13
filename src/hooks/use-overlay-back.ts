"use client"

import { useEffect, useId } from "react"

// «Atrás» (botón del navegador o gesto del teléfono) con un diálogo, sheet o drawer abierto debe
// cerrar solo ese componente, como su «X», y no regresar a la página anterior. Cada overlay abierto
// agrega una entrada al historial; al volver atrás se cierra el de más arriba (se simula Escape,
// que Radix/vaul ya tratan como «cerrar»). Si el overlay se cierra por otro medio, se retira la
// entrada para no dejar historial sobrante.

const stack: string[] = []
const closers = new Map<string, () => void>()
const consumed = new Set<string>()
let skipPops = 0
let bound = false

function onPop() {
  if (skipPops > 0) {
    skipPops--
    return
  }
  const top = stack[stack.length - 1]
  if (top) closers.get(top)?.()
}

function bind() {
  if (bound || typeof window === "undefined") return
  window.addEventListener("popstate", onPop)
  bound = true
}

export function useOverlayBack() {
  const id = useId()
  useEffect(() => {
    bind()
    let pushed = false
    // Diferido: en StrictMode (montar-desmontar-montar) solo queda una entrada.
    const timer = window.setTimeout(() => {
      window.history.pushState({ ...(window.history.state ?? {}), __overlay: id }, "", window.location.href)
      pushed = true
      stack.push(id)
      closers.set(id, () => {
        consumed.add(id)
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }))
        // Si el componente no se cerró (p. ej. bloquea Escape), se repone la entrada.
        window.setTimeout(() => {
          if (closers.has(id)) {
            consumed.delete(id)
            window.history.pushState({ ...(window.history.state ?? {}), __overlay: id }, "", window.location.href)
          }
        }, 60)
      })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      if (!pushed) return
      closers.delete(id)
      const at = stack.indexOf(id)
      if (at >= 0) stack.splice(at, 1)
      const wasPopped = consumed.delete(id)
      // Cerrado por otro medio (X, arrastre, guardar): quita la entrada que agregó.
      if (!wasPopped && window.history.state?.__overlay === id) {
        skipPops++
        window.history.back()
      }
    }
  }, [id])
}

/** Se monta dentro del contenido de un overlay: existe solo mientras está abierto. */
export function OverlayBackGuard() {
  useOverlayBack()
  return null
}
