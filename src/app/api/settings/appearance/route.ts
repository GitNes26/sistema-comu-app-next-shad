import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { assertPermission } from "@/lib/auth/server-permissions";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { THEMES } from "@/lib/appearance";
import { sanitizeAppearance } from "@/lib/appearance";
import {
  getAppSettings,
  upsertAppSettings,
  DEFAULT_APP_SETTINGS,
  type AppSettingsParams,
} from "@/lib/db/app-settings";

// Lectura/guardado de la apariencia de la organización.

async function requireOrg() {
  const session = await getServerSession(authOptions);
  const organizationId = effectiveOrgId(session);
  if (!session?.user?.id || !organizationId) {
    return { session: null, organizationId: null };
  }
  return { session, organizationId };
}

export async function GET() {
  const { organizationId } = await requireOrg();
  if (!organizationId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const settings = (await getAppSettings(organizationId)) ?? DEFAULT_APP_SETTINGS;
  return NextResponse.json(
    { settings },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

export async function PATCH(req: Request) {
  const { session, organizationId } = await requireOrg();
  if (!session || !organizationId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  try {
    assertPermission(session, "settings.manage");
  } catch {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const patch: Partial<AppSettingsParams> = sanitizeAppearance(body) as Partial<AppSettingsParams>;

  const theme = body.theme;
  if (typeof theme === "string" && (THEMES as readonly string[]).includes(theme)) {
    patch.theme = theme;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Sin valores válidos" }, { status: 400 });
  }

  const settings = await upsertAppSettings(organizationId, patch);
  return NextResponse.json(
    { settings },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
