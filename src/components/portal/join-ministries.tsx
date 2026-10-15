"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, HandHeart, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { DialogComponent } from "@/components/ui/dialog"
import { StatusPill } from "@/components/base/status-pill"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { JoinCatalogItem, JoinRequestDto } from "@/lib/portal/server"

// «Quiero servir»: el creyente pide integrarse a un ministerio y su líder decide.
// Los líderes ven aquí mismo las solicitudes pendientes de sus ministerios.

export function JoinMinistries() {
  const [catalog, setCatalog] = useState<JoinCatalogItem[] | null>(null)
  const [requests, setRequests] = useState<JoinRequestDto[]>([])
  const [target, setTarget] = useState<JoinCatalogItem | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        apiJson<{ ministries: JoinCatalogItem[] }>("/api/portal/ministries"),
        apiJson<{ requests: JoinRequestDto[] }>("/api/portal/join-requests"),
      ])
      setCatalog(c.ministries)
      setRequests(r.requests)
    } catch (e) {
      setCatalog([])
      swalError("No se pudo cargar", errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const send = async () => {
    if (!target) return
    setBusy(target.id)
    try {
      await apiJson("/api/portal/ministries", {
        method: "POST",
        body: JSON.stringify({ ministryId: target.id, message }),
      })
      notify.success("Solicitud enviada; su líder la revisará")
      setTarget(null)
      setMessage("")
      await load()
    } catch (e) {
      swalError("No se pudo enviar", errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const decide = async (r: JoinRequestDto, decision: "approve" | "reject") => {
    setBusy(r.id)
    try {
      await apiJson(`/api/portal/join-requests/${r.id}`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      })
      notify.success(
        decision === "approve"
          ? "Se integró al ministerio"
          : "Solicitud rechazada"
      )
      await load()
    } catch (e) {
      swalError("No se pudo resolver", errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (!catalog) return <Skeleton className="h-40 w-full" />
  const available = catalog.filter((m) => m.state !== "member")

  return (
    <div className="space-y-6">
      {requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">
            Solicitudes por decidir
          </h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {r.memberName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Quiere servir en {r.ministryName}
                    {r.message ? ` · «${r.message}»` : ""}
                  </span>
                </span>
                <Button
                  size="sm"
                  disabled={busy === r.id}
                  onClick={() => void decide(r, "approve")}
                >
                  <Check className="size-4" />
                  Aceptar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.id}
                  onClick={() => void decide(r, "reject")}
                >
                  <X className="size-4" />
                  Rechazar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {available.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">
            Quiero servir
          </h2>
          <p className="text-sm text-muted-foreground">
            Elige un ministerio y su líder revisará tu solicitud.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {available.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-2 rounded-2xl border bg-card p-4"
              >
                <div className="flex items-start gap-2">
                  <HandHeart className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.name}</p>
                    {m.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {m.description}
                      </p>
                    )}
                    {m.requirements && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        Requisitos: {m.requirements}
                      </p>
                    )}
                  </div>
                </div>
                {m.state === "pending" ? (
                  <StatusPill tone="warning">Solicitud en revisión</StatusPill>
                ) : (
                  <Button
                    size="sm"
                    variant={m.state === "rejected" ? "outline" : "default"}
                    onClick={() => setTarget(m)}
                  >
                    {m.state === "rejected"
                      ? "Volver a solicitar"
                      : "Solicitar"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <DialogComponent
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        size="md"
        title={target ? `Servir en ${target.name}` : "Servir"}
        description="Cuéntale a su líder por qué quieres servir (opcional)."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setTarget(null)}
              disabled={busy !== null}
            >
              Cancelar
            </Button>
            <Button onClick={() => void send()} disabled={busy !== null}>
              {busy !== null && <Loader2 className="size-4 animate-spin" />}
              Enviar solicitud
            </Button>
          </>
        }
      >
        <Textarea
          rows={4}
          value={message}
          maxLength={500}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mensaje para el líder…"
        />
      </DialogComponent>
    </div>
  )
}
