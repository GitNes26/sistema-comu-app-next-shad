// Conversión entre los textos que guardan los formularios («YYYY-MM-DD», «HH:mm»,
// «YYYY-MM-DDTHH:mm») y los componentes DatePicker / TimePicker / DateTimePicker.

const pad = (n: number) => String(n).padStart(2, "0")

/** «2026-10-05» → Date a mediodía local (evita saltos de día por zona horaria). */
export const ymdToDate = (s: string | null | undefined): Date | null => (s ? new Date(`${s.slice(0, 10)}T12:00:00`) : null)

/** Date → «2026-10-05» (fecha local). */
export const dateToYmd = (d: Date | null | undefined): string => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "")

/** «2026-10-05T18:30» → Date local. */
export const localToDate = (s: string | null | undefined): Date | null => (s ? new Date(s) : null)

/** Date → «2026-10-05T18:30» (hora local). */
export const dateToLocal = (d: Date | null | undefined): string =>
  d ? `${dateToYmd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}` : ""
