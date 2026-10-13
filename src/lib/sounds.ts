const STORAGE_KEY = "comu-app.sounds-enabled"

export type SoundName =
  | "notification"
  | "sale-complete"
  | "error"
  | "scan"
  | "cash-open"
  | "cash-close"
  | "order-received"
  | "order-ready"
  | "low-stock"
  // Campana del KDS: nueva reservación próxima confirmada.
  | "reservation-bell";

export interface PlaySoundOptions {
  volume?: number
  rate?: number
}

let enabled = typeof window !== "undefined"
  ? (localStorage.getItem(STORAGE_KEY) ?? "1") === "1"
  : true

// AudioContext unlock para mobile (iOS Safari / Chrome mobile).
let audioCtx: AudioContext | null = null
let unlocked = false

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    } catch {
      return null
    }
  }
  return audioCtx
}

function unlockAudio() {
  if (unlocked) return
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === "suspended") {
    ctx.resume().then(() => { unlocked = true }).catch(() => {})
  } else {
    unlocked = true
  }
}

// Desbloquear en la primera interacción del usuario.
if (typeof window !== "undefined") {
  const events = ["touchstart", "touchend", "click", "keydown"]
  const handler = () => {
    unlockAudio()
    events.forEach((e) => document.removeEventListener(e, handler))
  }
  events.forEach((e) => document.addEventListener(e, handler, { once: true, passive: true }))
}

export function setSoundsEnabled(value: boolean) {
  enabled = value
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
  }
}

export function isSoundsEnabled() {
  return enabled
}

export function playSound(name: SoundName, options: PlaySoundOptions = {}) {
  if (!enabled || typeof window === "undefined") return
  const { volume = 1, rate = 1 } = options

  // Intentar con AudioContext (mejor soporte mobile).
  const ctx = getAudioContext()
  if (ctx && unlocked) {
    fetch(`/sounds/${name}.mp3`)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        const source = ctx.createBufferSource()
        source.buffer = decoded
        source.playbackRate.value = rate
        const gain = ctx.createGain()
        gain.gain.value = volume
        source.connect(gain).connect(ctx.destination)
        source.start(0)
      })
      .catch(() => {
        // Fallback a Audio element.
        playWithAudioElement(name, volume, rate)
      })
    return
  }

  // Fallback: Audio element (desktop o antes del unlock).
  playWithAudioElement(name, volume, rate)
}

function playWithAudioElement(name: string, volume: number, rate: number) {
  const audio = new Audio(`/sounds/${name}.mp3`)
  audio.volume = volume
  audio.playbackRate = rate
  audio.play().catch(() => {})
}

export function useSound() {
  return {
    play: playSound,
    setEnabled: setSoundsEnabled,
    isEnabled: isSoundsEnabled,
  }
}