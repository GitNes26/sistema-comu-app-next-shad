import type { MenuInput, MenuNode } from "@/lib/menus/server";

// Cliente HTTP del CRUD de menús.

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error ?? "Error de red");
  return data;
}

export const menusApi = {
  adminList: () => json<{ ok: boolean; menus: MenuNode[] }>("/api/menus/admin"),
  create: (input: MenuInput) =>
    json<{ ok: boolean; menu: MenuNode }>("/api/menus", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: MenuInput) =>
    json<{ ok: boolean; menu: MenuNode }>(`/api/menus/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    json<{ ok: boolean }>(`/api/menus/${id}`, { method: "DELETE" }),
  reorder: (items: { id: string; sortOrder: number; parentId: string | null }[]) =>
    json<{ ok: boolean }>("/api/menus/reorder", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
};
