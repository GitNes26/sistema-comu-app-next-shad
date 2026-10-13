// Resolución del organizationId efectivo de una sesión.
// El superAdmin (y los admins multi-org) operan sobre `activeOrganizationId`;
// el resto de usuarios usan su `organizationId` de login.

export type OrgContextUser = {
  scope?: string | null;
  activeOrganizationId?: string | null;
  organizationId?: string | null;
};

export type OrgContextSession = {
  user?: OrgContextUser | null;
} | null;

export function effectiveOrgId(session: OrgContextSession): string | null {
  const org = session?.user?.activeOrganizationId ?? session?.user?.organizationId;
  return org || null;
}

export function isSuperadminSession(session: OrgContextSession): boolean {
  return session?.user?.scope === "superadmin";
}
