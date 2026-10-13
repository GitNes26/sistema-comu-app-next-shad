import type { Session } from "next-auth";
import type { SessionRole } from "@/lib/auth/permissions";

// Redirección post-login según nivel: panel administrativo para quien opera la
// iglesia; «Mi espacio» para el creyente.

export function homeForRole(role: SessionRole | undefined): string {
  switch (role) {
    case "believer":
      return "/mi";
    case "superadmin":
    case "owner":
    case "admin":
    case "leader":
    case "servant":
      return "/admin";
    default:
      return "/auth/login";
  }
}

export function homeForSession(session: Session | null): string {
  if (!session?.user) return "/auth/login";
  if (session.user.scope === "portal") return "/mi";
  return homeForRole(session.user.role);
}

/** Resuelve el destino final respetando un callbackUrl explícito cuando es seguro. */
export function resolveLoginDestination(
  role: SessionRole | undefined,
  callbackUrl?: string | null
): string {
  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }
  return homeForRole(role);
}
