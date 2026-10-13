"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Check, ChevronsUpDown, Church, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { notify } from "@/lib/notify"
import { cn } from "@/lib/utils"

// Selector de iglesia activa.
// Superadmin: siempre visible (elige iglesia o «Sin iglesia»).
// Resto de sesiones: solo se muestra cuando hay más de una iglesia para cambiar;
// cambia `activeOrganizationId` vía update() de next-auth (el servidor valida la
// membresía).

type OrgOption = {
  id: string
  name: string
  role?: string
  currency?: string
}

export interface OrgSwitcherProps {
  activeOrganizationId?: string | null
  scope?: string | null
  /** "header" = fila superior (nombre oculto en pantallas < md).
   *  "sidebar" = dentro del drawer/sidebar: ocupa el ancho y muestra siempre
   *  nombre + chevron (ya es una superficie ancha). */
  variant?: "header" | "sidebar"
  /** Aviso tras cambiar la iglesia activa con éxito (p. ej. cerrar el drawer). */
  onSwitched?: () => void
}

export function OrgSwitcher({ activeOrganizationId, scope, variant = "header", onSwitched }: OrgSwitcherProps) {
  const router = useRouter()
  const { update } = useSession()
  const [orgs, setOrgs] = React.useState<OrgOption[] | null>(null)
  const [open, setOpen] = React.useState(false)
  const [switching, setSwitching] = React.useState(false)

  const isSuperadmin = scope === "superadmin"

  React.useEffect(() => {
    let active = true
    fetch("/api/settings/organizations/mine", { headers: { "Content-Type": "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { organizations?: OrgOption[] } | null) => {
        if (active) setOrgs(data?.organizations ?? [])
      })
      .catch(() => {
        if (active) setOrgs([])
      })
    return () => {
      active = false
    }
  }, [scope])

  const activeName = React.useMemo(
    () => orgs?.find((o) => o.id === activeOrganizationId)?.name ?? null,
    [orgs, activeOrganizationId]
  )

  // Sin datos todavía (orgs === null): los usuarios de app esperan a saber si
  // tienen más de una iglesia; el superadmin siempre ve el selector.
  const hasMultipleOrgs = orgs !== null && orgs.length > 1
  if (!isSuperadmin && !hasMultipleOrgs) return null

  const switchOrg = async (orgId: string) => {
    if (orgId === activeOrganizationId) {
      setOpen(false)
      return
    }
    setSwitching(true)
    try {
      await update({ activeOrganizationId: orgId })
      setOpen(false)
      // Cerrar antes del refresh: el contexto de navegación cambia debajo y el
      // drawer no debe quedarse abierto encima.
      onSwitched?.()
      router.refresh()
    } catch {
      notify.error("No se pudo cambiar de iglesia")
    } finally {
      setSwitching(false)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-9 gap-2 px-2 text-sm font-medium data-[state=open]:bg-accent",
            variant === "sidebar" && "w-full justify-between"
          )}
          aria-label="Cambiar de iglesia"
          title={activeName ?? "Cambiar de iglesia"}
        >
          <Church className="size-4 shrink-0 text-muted-foreground" />
          <span
            className={
              variant === "sidebar"
                ? "block min-w-0 flex-1 truncate text-left"
                : "hidden min-w-0 max-w-40 truncate md:block"
            }
          >
            {activeName ??
              (orgs === null && activeOrganizationId ? (
                // Mientras llega la lista: marcador, no «Sin iglesia».
                <span className="inline-block h-3.5 w-24 animate-pulse rounded bg-muted align-middle" aria-label="Cargando iglesia" />
              ) : isSuperadmin ? "Sin iglesia" : "Iglesia")}
          </span>
          {switching ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
          ) : (
            <ChevronsUpDown
              className={
                variant === "sidebar"
                  ? "size-3.5 shrink-0 text-muted-foreground"
                  : "hidden size-3.5 shrink-0 text-muted-foreground md:block"
              }
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="w-64">
        <DropdownMenuLabel>{isSuperadmin ? "Iglesias registradas" : "Mis iglesias"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!orgs ? (
          <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Cargando…
          </div>
        ) : orgs.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">No hay iglesias disponibles.</div>
        ) : (
          <DropdownMenuGroup className="max-h-72 overflow-y-auto">
            {orgs.map((o) => (
              <DropdownMenuItem
                key={o.id}
                onSelect={() => void switchOrg(o.id)}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                {o.id === activeOrganizationId && <Check className="size-4 shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
