export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000
}

export function money(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function qty(n: number, decimals: number = 3): string {
  return n.toLocaleString("es-MX", {
    maximumFractionDigits: decimals,
  })
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function snapToStep(n: number, step: number): number {
  if (!step || step <= 0) return round3(n)
  return round3(Math.round(n / step) * step)
}
