import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { effectiveOrgId } from "@/lib/auth/org-context";
import type { PermissionKey } from "@/lib/auth/permission-keys";
import { getCrudEntry, type CrudRegistryEntry } from "@/lib/crud/modules";
import { CrudError } from "@/lib/crud/types";

// Guard compartido para los endpoints CRUD del admin.
// Verifica sesión + organización + permiso del módulo según la acción.

type CrudAction = "view" | "manage" | "delete";

export function permissionForAction(
  entry: CrudRegistryEntry,
  action: CrudAction
): PermissionKey {
  if (action === "delete") return entry.permissionDelete ?? entry.permissionManage;
  if (action === "manage") return entry.permissionManage;
  return entry.permissionView;
}

export async function guardCrud(
  moduleKey: string,
  action: CrudAction
): Promise<
  | { entry: CrudRegistryEntry; organizationId: string; userId: string }
  | { response: NextResponse }
> {
  const entry = getCrudEntry(moduleKey);
  if (!entry) {
    return {
      response: NextResponse.json({ ok: false, error: "Módulo no encontrado" }, { status: 404 }),
    };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  const organizationId = effectiveOrgId(session);
  if (session.user.scope === "portal" || !organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  if (!hasPermission(session, permissionForAction(entry, action))) {
    return { response: NextResponse.json({ ok: false, error: "No tienes permiso para esta acción" }, { status: 403 }) };
  }

  return { entry, organizationId, userId: session.user.id };
}

export function isCrudError(err: unknown): err is CrudError {
  return err instanceof CrudError;
}

export function crudErrorResponse(err: unknown): NextResponse {
  if (isCrudError(err)) {
    return NextResponse.json(
      { ok: false, error: err.message, field: err.field ?? null },
      { status: err.status }
    );
  }
  if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
    return NextResponse.json(
      { ok: false, error: "Ya existe un registro con los mismos datos", field: null },
      { status: 400 }
    );
  }
  console.error("[crud]", err);
  return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
}