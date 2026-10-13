import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveLoginUser } from "@/lib/auth/options";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/org-hint — pista de iglesia para la pantalla de login.
 * Dado un identificador (correo, código o teléfono), responde con la iglesia
 * recordada a la que la persona volverá a entrar (si sigue teniendo acceso) y la
 * lista de iglesias accesibles.
 *
 * Sin sesión: es solo una pista visual para quien pertenece a varias iglesias.
 * NUNCA confirma si el identificador existe ni permite elegir iglesia desde aquí:
 * la membresía real se resuelve al autenticar. Rate limit básico para frenar el
 * sondeo por fuerza bruta de nombres.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_REQUESTS;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(ip)) {
      return NextResponse.json({ ok: false, error: "Demasiadas solicitudes" }, { status: 429 });
    }

    const body = (await req.json()) as { identifier?: string };
    const identifier = body.identifier?.trim();
    if (!identifier || identifier.length < 3) {
      return NextResponse.json({ ok: true, lastOrg: null, organizations: [], accessibleCount: 0 });
    }

    const user = await resolveLoginUser(identifier);
    // Respuesta neutra: no se revela si el identificador existe. El superadmin
    // tampoco expone catálogo (el selector de iglesia posterior al acceso lo cubre).
    if (!user || user.isSuperadmin) {
      return NextResponse.json({ ok: true, lastOrg: null, organizations: [], accessibleCount: 0 });
    }

    const accessible = new Set(user.memberships.map((m) => m.organizationId));
    const organizations = await prisma.organization.findMany({
      where: { id: { in: [...accessible] }, isBlocked: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const lastOrg =
      organizations.find((o) => o.id === user.lastOrganizationId) ?? null;

    return NextResponse.json({ ok: true, lastOrg, organizations, accessibleCount: organizations.length });
  } catch (err) {
    console.error("[org-hint]", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}
