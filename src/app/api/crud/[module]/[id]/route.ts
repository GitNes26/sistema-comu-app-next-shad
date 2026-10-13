import { NextRequest, NextResponse } from "next/server";
import { guardCrud, crudErrorResponse } from "../../guard";
import { prisma } from "@/lib/db";
import { CrudError } from "@/lib/crud/types";

/** Restauración (reactivar isActive), siempre acotada a la iglesia de la sesión. */
const RESTORE: Record<string, (organizationId: string, id: string) => Promise<{ count: number }>> = {
  members: (organizationId, id) => prisma.member.updateMany({ where: { id, organizationId }, data: { isActive: true } }),
  locations: (organizationId, id) => prisma.location.updateMany({ where: { id, organizationId }, data: { isActive: true } }),
  positions: (organizationId, id) => prisma.employeePosition.updateMany({ where: { id, organizationId }, data: { isActive: true } }),
  employees: (organizationId, id) => prisma.employee.updateMany({ where: { id, organizationId }, data: { isActive: true } }),
};

async function genericRestore(organizationId: string, id: string, module: string) {
  const restore = RESTORE[module];
  if (!restore) throw new CrudError("Este módulo no soporta restauración", 400);
  const result = await restore(organizationId, id);
  if (result.count === 0) throw new CrudError("Registro no encontrado", 404);
}

export async function GET(req: NextRequest) {
  const [module, id] = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2);
  const guard = await guardCrud(module, "view");
  if ("response" in guard) return guard.response;
  const { entry, organizationId } = guard;

  try {
    const row = await entry.module.get(organizationId, id);
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  const [module, id] = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2);
  const guard = await guardCrud(module, "manage");
  if ("response" in guard) return guard.response;
  const { entry, organizationId, userId } = guard;

  try {
    const body = await req.json();
    const row = await entry.module.update(organizationId, id, body, { userId });
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const [module, id] = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2);
  const guard = await guardCrud(module, "delete");
  if ("response" in guard) return guard.response;
  const { entry, organizationId } = guard;

  try {
    await entry.module.remove(organizationId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const [module, id] = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  if (action !== "restore") {
    return NextResponse.json({ ok: false, error: "Acción no válida" }, { status: 400 });
  }

  const guard = await guardCrud(module, "manage");
  if ("response" in guard) return guard.response;
  const { entry, organizationId } = guard;

  try {
    if (entry.module.restore) {
      await entry.module.restore(organizationId, id);
    } else {
      await genericRestore(organizationId, id, module);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return crudErrorResponse(err);
  }
}
