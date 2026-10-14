import type {
  CompanyProfileInput,
  InvitationRow,
  OrgUserRow,
  ProfileInput,
  RoleRow,
} from "@/lib/settings/server";

// Cliente HTTP de ajustes.

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error ?? "Error de red");
  return data;
}

export interface CompanyProfileView {
  id: string;
  legalName: string | null;
  tradeName: string | null;
  taxId: string | null;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  socialLinks: Record<string, string> | null;
  donationsEnabled: boolean;
  donationBank: string | null;
  donationHolder: string | null;
  donationClabe: string | null;
  donationAccount: string | null;
  donationCard: string | null;
  donationLink: string | null;
  donationNote: string | null;
  publicEnabled: boolean;
  publicSlug: string | null;
  tagline: string | null;
  pastorName: string | null;
  pastorMessage: string | null;
  heroImageUrl: string | null;
  mapUrl: string | null;
}

export interface MyProfileView {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
}

export const settingsApi = {
  company: () => json<{ ok: boolean; profile: CompanyProfileView | null }>("/api/settings/company"),
  updateCompany: (input: CompanyProfileInput) =>
    json<{ ok: boolean; profile: CompanyProfileView }>("/api/settings/company", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  profile: () => json<{ ok: boolean; profile: MyProfileView }>("/api/settings/profile"),
  updateProfile: (input: ProfileInput) =>
    json<{ ok: boolean; profile: MyProfileView }>("/api/settings/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  users: () => json<{ ok: boolean; users: OrgUserRow[] }>("/api/settings/users"),
  updateUser: (membershipId: string, input: { role?: string; roleId?: string; isActive?: boolean }) =>
    json<{ ok: boolean }>(`/api/settings/users/${membershipId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  removeUser: (membershipId: string) =>
    json<{ ok: boolean }>(`/api/settings/users/${membershipId}`, { method: "DELETE" }),

  roles: () => json<{ ok: boolean; roles: RoleRow[] }>("/api/settings/roles"),
  rolePermissions: (roleId: string) =>
    json<{ ok: boolean; permissions: string[] }>(`/api/settings/roles/${roleId}`),
  createRole: (input: { name: string; description?: string | null; copyRoleId?: string | null; global?: boolean; level?: string }) =>
    json<{ ok: boolean; role: RoleRow }>("/api/settings/roles", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateRole: (roleId: string, input: { name?: string; description?: string | null; global?: boolean; level?: string }) =>
    json<{ ok: boolean }>(`/api/settings/roles/${roleId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteRole: (roleId: string) =>
    json<{ ok: boolean }>(`/api/settings/roles/${roleId}`, { method: "DELETE" }),
  setRolePermissions: (roleId: string, permissions: string[]) =>
    json<{ ok: boolean }>(`/api/settings/roles/${roleId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),

  invitations: () => json<{ ok: boolean; invitations: InvitationRow[] }>("/api/settings/invitations"),
  createInvitation: (input: { email: string; role?: string; roleId?: string; locationId?: string | null }) =>
    json<{ ok: boolean; invitation: InvitationRow }>("/api/settings/invitations", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  revokeInvitation: (id: string) =>
    json<{ ok: boolean }>(`/api/settings/invitations/${id}`, { method: "DELETE" }),

};
