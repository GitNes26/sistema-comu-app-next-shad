// Reglas puras del recibo de donativo: importe con letra (español de México) y folio.

const UNITS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"]
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]
const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"]

function below1000(n: number): string {
  if (n === 100) return "cien"
  const h = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (h) parts.push(HUNDREDS[h])
  if (r > 0) {
    if (r < 30) parts.push(UNITS[r])
    else {
      const t = Math.floor(r / 10)
      const u = r % 10
      parts.push(u ? `${TENS[t]} y ${UNITS[u]}` : TENS[t])
    }
  }
  return parts.join(" ")
}

const apocope = (w: string) => w.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un")

function integerToWords(n: number): string {
  if (n === 0) return "cero"
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (millions) parts.push(millions === 1 ? "un millón" : `${apocope(integerToWords(millions))} millones`)
  if (thousands) parts.push(thousands === 1 ? "mil" : `${apocope(below1000(thousands))} mil`)
  if (rest) parts.push(below1000(rest))
  return parts.join(" ")
}

/** 1250.5 → «mil doscientos cincuenta pesos 50/100 M.N.» (hasta 999 999 999). */
export function amountInWords(amount: number): string {
  const cents = Math.round((Math.abs(amount) % 1) * 100 + 1e-9)
  const whole = Math.floor(Math.abs(amount) + 1e-9)
  const exactMillions = whole > 0 && whole % 1_000_000 === 0
  // Delante de «pesos» el uno se apocopa: un peso, veintiún pesos, ciento un pesos.
  const words = exactMillions ? integerToWords(whole) : apocope(integerToWords(whole))
  const unit = whole === 1 ? "peso" : exactMillions ? "de pesos" : "pesos"
  return `${words} ${unit} ${String(cents).padStart(2, "0")}/100 M.N.`.replace(/^./, (c) => c.toUpperCase())
}

/** R-2026-0007 */
export const receiptFolio = (year: number, n: number) => `R-${year}-${String(n).padStart(4, "0")}`
