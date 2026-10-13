// Cliente HTTP para los endpoints CRUD genéricos del admin.

export class ApiError extends Error {
  status: number;
  field?: string | null;
  constructor(message: string, status = 500, field?: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field ?? null;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    field?: string | null;
  } | null;
  if (!res.ok) {
    throw new ApiError(data?.error ?? "Error de red", res.status, data?.field);
  }
  return data as T;
}

export interface CrudListResponse {
  ok: boolean;
  rows: Record<string, unknown>[];
  total: number;
}

async function list(
  module: string,
  params: Record<string, string | number> = {}
): Promise<CrudListResponse> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  );
  return request<CrudListResponse>(`/api/crud/${module}?${qs.toString()}`);
}

async function get(module: string, id: string) {
  return request<{ ok: boolean; row: Record<string, unknown> }>(
    `/api/crud/${module}/${id}`
  );
}

async function create(module: string, body: Record<string, unknown>) {
  return request<{ ok: boolean; row: Record<string, unknown> }>(
    `/api/crud/${module}`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

async function update(module: string, id: string, body: Record<string, unknown>) {
  return request<{ ok: boolean; row: Record<string, unknown> }>(
    `/api/crud/${module}/${id}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

async function remove(module: string, id: string) {
  return request<{ ok: boolean }>(`/api/crud/${module}/${id}`, {
    method: "DELETE",
  });
}

async function restore(module: string, id: string) {
  return request<{ ok: boolean }>(`/api/crud/${module}/${id}?action=restore`, {
    method: "POST",
  });
}


export const crudApi = { list, get, create, update, remove, restore };
