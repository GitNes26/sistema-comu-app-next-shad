"use client"

import { useCallback, useEffect, useState } from "react"
import { Baby, BellRing, MessageCircle, Pencil, Plus, QrCode, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { MyChildDto } from "@/lib/kids/server"
import { swalError } from "@/lib/swal"
import { ChildFormDialog, QrImage, fmtTime } from "./kids-shared"
import { KidsMessagesDialog } from "./kids-messages"

// «Mis hijos»: los niños de los que la persona es tutora. El acceso nace de la
// relación de tutela; nadie ve a un niño que no es suyo.

export function MyKids() {
  const [children, setChildren] = useState<MyChildDto[] | null>(null)
  const [qr, setQr] = useState<MyChildDto | null>(null)
  const [chat, setChat] = useState<MyChildDto | null>(null)
  const [form, setForm] = useState<MyChildDto | "new" | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ children: MyChildDto[] }>("/api/kids/mine")
      setChildren(d.children)
    } catch (e) {
      setChildren([])
      swalError("No se pudieron cargar tus hijos", errorMessage(e))
    }
  }, [])

  useEffect(() => {
    void load()
    // Los avisos llegan en vivo: se refresca el estado de cada hijo.
    const t = setInterval(() => void load(), 15000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div className="w-full space-y-5">
      {/* Un lugar seguro: cálido, claro y con la protección a la vista. */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-warning/20 via-primary/10 to-accent p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -top-10 -right-8 size-44 rounded-full bg-warning/25 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-12 left-10 size-40 rounded-full bg-primary/15 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-3xl bg-card text-primary shadow-sm">
            <Baby className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Mis hijos</h1>
            <p className="text-sm text-muted-foreground">En Comunidad Kids están en buenas manos. Tú sabes siempre dónde están.</p>
          </div>
          <Button onClick={() => setForm("new")}>
            <Plus className="size-4" />
            Registrar hijo
          </Button>
        </div>
        <ul className="relative mt-5 grid gap-2 sm:grid-cols-3">
          {[
            { icon: UserCheck, t: "Entrada registrada", d: "Con QR; el personal sabe quién llegó y a qué salón." },
            { icon: ShieldCheck, t: "Salida protegida", d: "Solo con tu código y la autorización del personal." },
            { icon: BellRing, t: "Avisos al instante", d: "Te escribimos si te necesitamos o cuando sale." },
          ].map((s) => (
            <li key={s.t} className="flex items-start gap-2.5 rounded-2xl bg-card/80 p-3 backdrop-blur">
              <s.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="text-sm leading-snug">
                <span className="block font-medium">{s.t}</span>
                <span className="text-xs text-muted-foreground">{s.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </header>

      {children === null ? (
        <Skeleton className="h-40 w-full" />
      ) : children.length === 0 ? (
        <EmptyState
          icon={Baby}
          title="Aún no tienes hijos registrados"
          description="Registra a tus hijos para obtener su QR. Si ya los registró el personal de Kids, aparecerán aquí al vincularte como tutor."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {children.map((c) => (
            <li key={c.id} className={cn("relative space-y-3 overflow-hidden rounded-3xl border bg-card p-4 pl-5", c.current && !c.current.checkOutAt && "border-success/50 bg-success/5")}>
              <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", c.current && !c.current.checkOutAt ? "bg-success" : "bg-muted")} />
              <div className="flex items-start gap-3">
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Baby className="size-6 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-base font-semibold">{c.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.ageLabel}
                    {c.roomName ? ` · ${c.roomName}` : ""}
                  </p>
                  <div className="mt-1.5">
                    {c.current ? (
                      c.current.checkOutAt ? (
                        <StatusPill tone="neutral">Salió a las {fmtTime(c.current.checkOutAt)}</StatusPill>
                      ) : (
                        <StatusPill tone="success">En {c.current.roomName} desde {fmtTime(c.current.checkInAt)}</StatusPill>
                      )
                    ) : (
                      <StatusPill tone="neutral" dot={false}>
                        Hoy no está en Kids
                      </StatusPill>
                    )}
                  </div>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Editar a ${c.fullName}`} onClick={() => setForm(c)}>
                  <Pencil className="size-4" />
                </Button>
              </div>
              {c.indications && (
                <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-2.5 text-xs">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span className="whitespace-pre-line">{c.indications}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setQr(c)}>
                  <QrCode className="size-4" />
                  Mostrar QR
                </Button>
                <Button variant="outline" onClick={() => setChat(c)} className="relative">
                  <MessageCircle className="size-4" />
                  Mensajes
                  {c.unread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[0.7rem] font-semibold text-white">
                      {c.unread}
                    </span>
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DialogComponent
        open={qr !== null}
        onOpenChange={(o) => !o && setQr(null)}
        title={qr?.fullName ?? "QR"}
        description="Muéstralo al personal de Kids al llegar y al recoger."
      >
        {qr && (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-2xl bg-white p-4">
              <QrImage token={qr.qrToken} size={260} />
            </div>
            <p className="text-center text-xs text-muted-foreground">La salida la autoriza el personal de Kids; no compartas este código.</p>
          </div>
        )}
      </DialogComponent>

      <KidsMessagesDialog
        staff={false}
        open={chat !== null}
        childId={chat?.id ?? null}
        childName={chat?.fullName ?? ""}
        onClose={() => setChat(null)}
        onChanged={undefined}
      />
      <ChildFormDialog mode="guardian" child={form === "new" ? null : form} open={form !== null} onClose={() => setForm(null)} onSaved={load} />
    </div>
  )
}
