"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

type OrganizationContextSyncProps = {
  organizationId: string | null;
  organizationName: string | null;
};

/**
 * Reconcilia el JWT local del dispositivo con la fila actual de la iglesia: un
 * cambio de nombre (o de iglesia activa) debe verse en todos los dispositivos
 * sin cerrar sesión.
 */
export function OrganizationContextSync({ organizationId, organizationName }: OrganizationContextSyncProps) {
  const { data: session, update, status } = useSession();
  const requestedRef = useRef("");

  useEffect(() => {
    if (status !== "authenticated" || !session?.user || !organizationId) return;

    const currentId = session.user.activeOrganizationId ?? session.user.organizationId ?? null;
    const fingerprint = `${organizationId}:${organizationName ?? ""}`;
    const isCurrent = currentId === organizationId && session.user.organizationName === organizationName;

    if (isCurrent || requestedRef.current === fingerprint) return;
    requestedRef.current = fingerprint;
    void update({ activeOrganizationId: organizationId });
  }, [organizationId, organizationName, session, status, update]);

  return null;
}
