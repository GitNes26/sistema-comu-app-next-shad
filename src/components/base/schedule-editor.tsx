"use client"

import { CalendarDays, Copy, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { TimePicker } from "@/components/base/time-picker"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DAYS_LABELS,
  type DaySchedule,
  type DayScheduleSlot,
} from "@/lib/schedule"

export {
  emptySchedule,
  type DaySchedule,
  type DayScheduleSlot,
} from "@/lib/schedule"
export { formatSchedule, parseSchedule, DAYS_LABELS } from "@/lib/schedule"

interface ScheduleEditorProps {
  schedule: DaySchedule[]
  onChange: (s: DaySchedule[]) => void
  disabled?: boolean
}

export function buildLegend(schedule: DaySchedule[]): string {
  const enabled = schedule.filter((d) => d.enabled)
  if (enabled.length === 0) return "Cerrado todos los días"

  // Group consecutive days with same slots
  const groups: { days: number[]; slots: DayScheduleSlot[] }[] = []
  for (const d of schedule) {
    if (!d.enabled) continue
    const slotsKey = JSON.stringify(d.slots)
    const last = groups[groups.length - 1]
    if (last && JSON.stringify(last.slots) === slotsKey) {
      const prevDay = last.days[last.days.length - 1]
      if (d.day === prevDay + 1 || (prevDay === 6 && d.day === 0)) {
        last.days.push(d.day)
        continue
      }
    }
    groups.push({ days: [d.day], slots: d.slots })
  }

  const fmt = (h: string) => {
    const [hh, mm] = h.split(":").map(Number)
    const period = hh >= 12 ? "PM" : "AM"
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
    return mm === 0
      ? `${h12} ${period}`
      : `${h12}:${String(mm).padStart(2, "0")} ${period}`
  }

  const formatSlots = (slots: DayScheduleSlot[]) =>
    slots.map((s) => `${fmt(s.open)} – ${fmt(s.close)}`).join(" / ")

  const parts = groups.map((g) => {
    const dayNames = g.days.map((d) => DAYS_LABELS[d])
    let range: string
    if (dayNames.length === 1) {
      range = dayNames[0]
    } else if (dayNames.length === 2) {
      range = `${dayNames[0]} y ${dayNames[1]}`
    } else {
      range = `${dayNames[0]}–${dayNames[dayNames.length - 1]}`
    }
    return `${range} ${formatSlots(g.slots)}`
  })

  return parts.join(", ")
}

export function ScheduleEditor({
  schedule,
  onChange,
  disabled,
}: ScheduleEditorProps) {
  const [replicateOpen, setReplicateOpen] = useState(false)
  const [targetDays, setTargetDays] = useState<number[]>([])
  const updateDay = (idx: number, patch: Partial<DaySchedule>) => {
    const next = schedule.map((d, i) => (i === idx ? { ...d, ...patch } : d))
    onChange(next)
  }

  const updateSlot = (
    dayIdx: number,
    slotIdx: number,
    patch: Partial<DayScheduleSlot>
  ) => {
    const next = schedule.map((d, i) => {
      if (i !== dayIdx) return d
      const slots = d.slots.map((s, j) =>
        j === slotIdx ? { ...s, ...patch } : s
      )
      return { ...d, slots }
    })
    onChange(next)
  }

  const addSlot = (dayIdx: number) => {
    const next = schedule.map((d, i) => {
      if (i !== dayIdx) return d
      return { ...d, slots: [...d.slots, { open: "14:00", close: "18:00" }] }
    })
    onChange(next)
  }

  const removeSlot = (dayIdx: number, slotIdx: number) => {
    const next = schedule.map((d, i) => {
      if (i !== dayIdx) return d
      if (d.slots.length <= 1) return d
      return { ...d, slots: d.slots.filter((_, j) => j !== slotIdx) }
    })
    onChange(next)
  }

  const legend = buildLegend(schedule)

  const source = useMemo(() => {
    const monday = schedule.find((d) => d.day === 1 && d.enabled && d.slots.length > 0)
    return monday ?? schedule.find((d) => d.enabled && d.slots.length > 0)
  }, [schedule])

  const openReplicate = () => {
    if (!source) return
    setTargetDays(schedule.filter((day) => day.day !== source.day).map((day) => day.day))
    setReplicateOpen(true)
  }

  const replicateSchedule = () => {
    if (!source || targetDays.length === 0) return
    onChange(
      schedule.map((d) =>
        !targetDays.includes(d.day)
          ? d
          : { day: d.day, enabled: true, slots: source.slots.map((s) => ({ ...s })) }
      )
    )
    setReplicateOpen(false)
  }

  const hasSource = schedule.some((d) => d.enabled && d.slots.length > 0)

  return (
    <div className="space-y-3">
      {/* Leyenda en tiempo real + replicar lunes */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Horario: </span>
          {legend}
          {!hasSource && (
            <p className="mt-0.5 text-xs text-muted-foreground/80">
              Tip: configura el Lunes y replica en el resto de la semana con un toque.
            </p>
          )}
        </div>
        {hasSource && source && (
          <Popover open={replicateOpen} onOpenChange={setReplicateOpen}>
            <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="h-11 shrink-0 gap-1.5 whitespace-nowrap desk:h-8" onClick={openReplicate} disabled={disabled}><Copy className="size-3.5" />Replicar {DAYS_LABELS[source.day]}</Button></PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3 p-3">
              <div><p className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4 text-primary"/>Copiar horario</p><p className="mt-1 text-xs text-muted-foreground">El horario de {DAYS_LABELS[source.day]} se aplicará únicamente a los días elegidos.</p></div>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={()=>setTargetDays([1,2,3,4,5].filter(day=>day!==source.day))}>Lun–Vie</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={()=>setTargetDays([0,6].filter(day=>day!==source.day))}>Fin de semana</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={()=>setTargetDays(schedule.filter(day=>day.day!==source.day).map(day=>day.day))}>Todos</Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {schedule.filter(day=>day.day!==source.day).map(day=><label key={day.day} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-sm"><Checkbox checked={targetDays.includes(day.day)} onCheckedChange={(checked)=>setTargetDays(current=>checked?[...current,day.day]:current.filter(value=>value!==day.day))}/>{DAYS_LABELS[day.day]}</label>)}
              </div>
              <Button type="button" className="w-full" size="sm" disabled={!targetDays.length} onClick={replicateSchedule}><Copy className="size-4"/>Aplicar a {targetDays.length} {targetDays.length===1?"día":"días"}</Button>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {schedule.map((s, dayIdx) => (
        <div key={dayIdx} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-10 text-xs font-medium text-muted-foreground">
              {DAYS_LABELS[s.day]}
            </span>
            <Switch
              className="hover:cursor-pointer hover:shadow-xl"
              checked={s.enabled}
              onCheckedChange={(v) => updateDay(dayIdx, { enabled: v })}
              disabled={disabled}
            />
          </div>
          {s.enabled && (
            <div className="ml-0 space-y-1.5 sm:ml-12">
              {s.slots.map((slot, slotIdx) => (
                <div key={slotIdx} className="flex flex-wrap items-center gap-2">
                  <TimePicker
                    value={slot.open}
                    onChange={(v) =>
                      updateSlot(dayIdx, slotIdx, { open: v ?? "09:00" })
                    }
                    disabled={disabled}
                    clearable={false}
                    size="sm"
                  />
                  <span className="text-xs text-muted-foreground">a</span>
                  <TimePicker
                    value={slot.close}
                    onChange={(v) =>
                      updateSlot(dayIdx, slotIdx, { close: v ?? "18:00" })
                    }
                    disabled={disabled}
                    clearable={false}
                    size="sm"
                  />
                  {s.slots.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 text-destructive desk:size-7"
                      onClick={() => removeSlot(dayIdx, slotIdx)}
                      disabled={disabled}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => addSlot(dayIdx)}
                disabled={disabled}
              >
                <Plus className="size-3" />
                Agregar horario
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
