import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/auth/permissions"
import { CrudError } from "@/lib/crud/types"
import type { Actor } from "@/lib/ministries/server"

// Contexto común de las rutas de ministerios: sesión → iglesia efectiva → permisos
// globales. El acceso fino por ministerio (relación) lo resuelve `ministryAccess`.

export async function ministriesActor(): Promise<{ actor: Actor } | { response: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) }
  }
  const organizationId = effectiveOrgId(session)
  if (!organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Selecciona una iglesia" }, { status: 403 }) }
  }
  const canManageAll = hasPermission(session, "ministries.manage")
  return {
    actor: {
      userId: session.user.id,
      organizationId,
      canManageAll,
      canViewAll: canManageAll || hasPermission(session, "ministries.view"),
      canAuthorizeExit: hasPermission(session, "kids.authorize_exit"),
      canManageCells: hasPermission(session, "cells.manage"),
      canViewCells: hasPermission(session, "cells.manage") || hasPermission(session, "cells.view"),
      canManageMembers: hasPermission(session, "members.manage"),
      canManageFinance: hasPermission(session, "finance.manage"),
      canViewFinance: hasPermission(session, "finance.manage") || hasPermission(session, "finance.view"),
      canManagePayroll: hasPermission(session, "payroll.manage"),
      canManageVehicles: hasPermission(session, "vehicles.manage"),
      canManageContent: hasPermission(session, "content.manage"),
      canViewStats: hasPermission(session, "panel.stats"),
      canViewReports: hasPermission(session, "reports.view"),
      canViewVehicles: hasPermission(session, "vehicles.manage") || hasPermission(session, "vehicles.view"),
      canManageSchool: hasPermission(session, "school.manage"),
      canViewSchool: hasPermission(session, "school.manage") || hasPermission(session, "school.view"),
      canManageEvents: hasPermission(session, "events.manage"),
      canViewEvents: hasPermission(session, "events.manage") || hasPermission(session, "events.view"),
      canCheckinEvents: hasPermission(session, "events.manage") || hasPermission(session, "events.checkin"),
      canManageGatherings: hasPermission(session, "gatherings.manage"),
      canViewGatherings: hasPermission(session, "gatherings.manage") || hasPermission(session, "gatherings.view"),
    },
  }
}

export function ministryErrorResponse(err: unknown): NextResponse {
  if (err instanceof CrudError) {
    return NextResponse.json({ ok: false, error: err.message, field: err.field ?? null }, { status: err.status })
  }
  console.error("[ministries]", err)
  return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 })
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null)
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
}
