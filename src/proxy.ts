import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isPlanBlockedPath } from "@/lib/billing/plan-permissions";

/** Páginas globales del superadmin (no dependen de una iglesia activa). */
const PLATFORM_PATHS = [
  "/admin/settings/organizations",
  "/admin/settings/subscriptions",
  "/admin/settings/plans",
  "/admin/settings/menus",
];

// Proxy de Next 16 (antes middleware). Protección de rutas (primera barrera; cada página y API repite su propia
// comprobación de sesión, iglesia efectiva y permiso).
// - /admin  → sesiones de app o superadmin (el creyente va a «Mi espacio»)
// - /mi     → cualquier sesión autenticada (espacio personal)
// El callbackUrl viaja en la query para volver a la pantalla original.

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const secure = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: `${secure ? "__Secure-" : ""}comu-app.session-token`,
  });

  const loginUrl = (target: string) => {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = `?callbackUrl=${encodeURIComponent(target)}`;
    return url;
  };

  // Sesión inválida (usuario desactivado/eliminado) → tratar como sin sesión.
  const authenticated = Boolean(token && !token.invalid);

  // Áreas que el plan contratado no incluye: se redirige a «Mi plan».
  if (
    authenticated &&
    token!.scope === "app" &&
    isPlanBlockedPath(pathname, token!.planDenied as string[] | undefined)
  ) {
    const url = new URL("/admin/settings/my-plan", req.url);
    url.searchParams.set("bloqueado", pathname);
    return NextResponse.redirect(url);
  }

  // Un creyente con sesión permanece en su espacio personal.
  if (authenticated && token!.scope === "portal" && pathname === "/") {
    return NextResponse.redirect(new URL("/mi", req.url));
  }

  // Primera configuración: solo con sesión.
  if (pathname.startsWith("/auth/onboarding")) {
    if (!authenticated) return NextResponse.redirect(loginUrl(pathname + search));
    return NextResponse.next();
  }

  // Panel administrativo
  if (pathname.startsWith("/admin")) {
    if (!authenticated) return NextResponse.redirect(loginUrl(pathname + search));
    if (token!.scope === "portal") return NextResponse.redirect(new URL("/mi", req.url));
    // El superadmin sin iglesia activa solo ve las páginas globales de Plataforma;
    // para el resto elige primero en qué iglesia operar.
    if (
      token!.scope === "superadmin" &&
      !token!.activeOrganizationId &&
      !PLATFORM_PATHS.some((p) => pathname.startsWith(p))
    ) {
      return NextResponse.redirect(new URL("/admin/settings/organizations", req.url));
    }
    // Usuarios sin iglesia van al onboarding primero.
    if (
      token!.scope !== "superadmin" &&
      !token!.activeOrganizationId &&
      !pathname.startsWith("/auth/onboarding")
    ) {
      return NextResponse.redirect(new URL("/auth/onboarding", req.url));
    }
    return NextResponse.next();
  }

  // Espacio personal del creyente (también lo usan líderes y administradores).
  if (pathname.startsWith("/mi")) {
    if (!authenticated) return NextResponse.redirect(loginUrl(pathname + search));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/mi/:path*", "/auth/onboarding"],
};
