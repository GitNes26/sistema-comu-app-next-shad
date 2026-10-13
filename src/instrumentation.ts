// Planificador interno de reportes: revisa cada 5 minutos si hay envíos pendientes.
// Se desactiva con REPORT_SCHEDULER=off (por ejemplo si se usa solo el cron externo).
// Es seguro con varias instancias: cada envío se reclama de forma atómica en la base.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.REPORT_SCHEDULER === "off" || process.env.NODE_ENV === "test") return
  const g = globalThis as unknown as { __reportScheduler?: boolean }
  if (g.__reportScheduler) return
  g.__reportScheduler = true
  const { runDueSchedules } = await import("@/lib/reports/schedules")
  const tick = () => {
    runDueSchedules()
      .then((r) => r.checked > 0 && console.log("[reportes] programados:", JSON.stringify(r)))
      .catch((err) => console.error("[reportes] planificador:", err))
  }
  const timer = setInterval(tick, 5 * 60 * 1000)
  timer.unref?.()
  setTimeout(tick, 30_000).unref?.()
}
