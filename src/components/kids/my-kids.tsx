"use client"

import { useCallback, useEffect, useState } from "react"
import { Baby, MessageCircle, Pencil, Plus, QrCode, ShieldAlert } from "lucide-react"
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Baby className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Mis hijos</h1>
          <p className="text-sm text-muted-foreground">Su QR de entrada y salida, y los avisos de Comunidad Kids.</p>
        </div>
        <Button onClick={() => setForm("new")}>
          <Plus className="size-4" />
          Registrar hijo
        </Button>
      </div>

      {children === null ? (
        <Skeleton className="h-40 w-full" />
      ) : children.length === 0 ? (
        <EmptyState
          icon={Baby}
          title="Aún no tienes hijos registrados"
          description="Registra a tus hijos para obtener su QR. Si ya los registró el personal de Kids, aparecerán aquí al vincularte como tutor."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {children.map((c) => (
            <li key={c.id} className="space-y-3 rounded-2xl border bg-card p-4">
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
