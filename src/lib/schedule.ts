export interface DayScheduleSlot {
  open: string;
  close: string;
}

export interface DaySchedule {
  day: number;
  enabled: boolean;
  slots: DayScheduleSlot[];
}

export const DAYS_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

export function emptySchedule(): DaySchedule[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day: i,
    enabled: i >= 1 && i <= 5,
    slots: [{ open: "09:00", close: "18:00" }],
  }));
}

/** Legacy single-slot format for backward compat. */
interface LegacyDaySchedule {
  day: number;
  enabled: boolean;
  open?: string;
  close?: string;
  slots?: DayScheduleSlot[];
}

export function parseSchedule(raw: unknown): DaySchedule[] {
  if (Array.isArray(raw)) {
    return (raw as LegacyDaySchedule[]).map((d) => ({
      day: d.day,
      enabled: d.enabled,
      slots: Array.isArray(d.slots) && d.slots.length > 0
        ? d.slots
        : [{ open: d.open ?? "09:00", close: d.close ?? "18:00" }],
    }));
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return (parsed as LegacyDaySchedule[]).map((d) => ({
          day: d.day,
          enabled: d.enabled,
          slots: Array.isArray(d.slots) && d.slots.length > 0
            ? d.slots
            : [{ open: d.open ?? "09:00", close: d.close ?? "18:00" }],
        }));
      }
    } catch {}
  }
  return emptySchedule();
}

export function formatSchedule(schedule: DaySchedule[]): string {
  const enabled = schedule.filter((d) => d.enabled);
  if (enabled.length === 0) return "Cerrado";
  const first = enabled[0];
  const s = first.slots[0];
  if (!s) return "Cerrado";
  if (enabled.length === 7 && first.slots.length === 1) return `${s.open} – ${s.close}`;
  const names = enabled.map((d) => DAYS_LABELS[d.day]).join(", ");
  if (first.slots.length === 1) return `${names} ${s.open} – ${s.close}`;
  const slotStrs = first.slots.map((sl) => `${sl.open}–${sl.close}`).join(", ");
  return `${names} ${slotStrs}`;
}

export function isScheduleOpenNow(schedule: DaySchedule[] | null, timezone = "America/Mexico_City"): { open: boolean; message: string } {
  if (!schedule || schedule.length === 0) return { open: false, message: "Sin horario" };
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
  const parts = formatter.formatToParts(now);
  const dayStr = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const currentMinutes = hour * 60 + minute;
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const today = dayMap[dayStr] ?? 0;
  const todaySchedule = schedule.find((s) => s.day === today);
  if (!todaySchedule || !todaySchedule.enabled) return { open: false, message: "Cerrado hoy" };

  for (const slot of todaySchedule.slots) {
    const [openH, openM] = slot.open.split(":").map(Number);
    const [closeH, closeM] = slot.close.split(":").map(Number);
    const isOpen = currentMinutes >= openH * 60 + openM && currentMinutes < closeH * 60 + closeM;
    if (isOpen) {
      return { open: true, message: `Abierto hasta ${slot.close}` };
    }
  }

  // Find next opening slot
  const nextSlot = todaySchedule.slots.find((slot) => {
    const [openH, openM] = slot.open.split(":").map(Number);
    return currentMinutes < openH * 60 + openM;
  });
  if (nextSlot) return { open: false, message: `Abre a las ${nextSlot.open}` };
  return { open: false, message: `Ya cerró. Abre a las ${todaySchedule.slots[0]?.open ?? "09:00"}` };
}

// ── Fechas en la zona horaria de la iglesia ──────────────────────────────────

/** Fecha/hora de pared (año, mes 0-11, día, día de semana, minutos) en la zona dada. */
export function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(get("year")),
    month: Number(get("month")) - 1,
    day: Number(get("day")),
    weekday: dayMap[get("weekday")] ?? 0,
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

/** Convierte una hora de pared en la zona dada al instante UTC real. */
export function zonedToDate(year: number, month: number, day: number, minutes: number, timezone: string): Date {
  const guess = Date.UTC(year, month, day, Math.floor(minutes / 60), minutes % 60);
  const seen = zonedParts(new Date(guess), timezone);
  const seenUtc = Date.UTC(seen.year, seen.month, seen.day, Math.floor(seen.minutes / 60), seen.minutes % 60);
  return new Date(guess - (seenUtc - guess));
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Próxima apertura según el horario, a partir de `from`.
 * `fromNextDay`: ignora lo que quede de hoy (siguiente día hábil).
 * Devuelve null si el horario no tiene días habilitados.
 */
export function nextOpening(schedule: DaySchedule[], timezone: string, from = new Date(), fromNextDay = false): Date | null {
  const now = zonedParts(from, timezone);
  for (let offset = fromNextDay ? 1 : 0; offset <= 14; offset++) {
    const weekday = (now.weekday + offset) % 7;
    const entry = schedule.find((d) => d.day === weekday);
    if (!entry?.enabled || !entry.slots.length) continue;
    const opens = entry.slots.map((s) => toMinutes(s.open)).sort((a, b) => a - b);
    const candidate = offset === 0 ? opens.find((m) => m > now.minutes) : opens[0];
    if (candidate == null) continue;
    // Día calendario local + offset (Date.UTC normaliza fin de mes).
    const d = new Date(Date.UTC(now.year, now.month, now.day + offset));
    return zonedToDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), candidate, timezone);
  }
  return null;
}

/** Mañana a la hora en que abre (o a las 00:00 si mañana no hay servicio). */
export function tomorrowOpening(schedule: DaySchedule[] | null, timezone: string, from = new Date()): Date {
  const now = zonedParts(from, timezone);
  const d = new Date(Date.UTC(now.year, now.month, now.day + 1));
  const entry = schedule?.find((s) => s.day === d.getUTCDay());
  const first = entry?.enabled && entry.slots.length ? Math.min(...entry.slots.map((s) => toMinutes(s.open))) : 0;
  return zonedToDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), first, timezone);
}
