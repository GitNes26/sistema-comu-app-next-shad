"use client";

import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/auth/permissions";
import type { PermissionKey } from "@/lib/auth/permission-keys";

/** Verifica un permiso en el cliente usando la sesión. */
export function usePermission(permission: PermissionKey): boolean {
  const { data: session } = useSession();
  return hasPermission(session, permission);
}