// Cliente HTTP mínimo de los espacios de ministerio (Consolidación, Kids…):
// conserva el campo que el servidor señala para poder enfocarlo o reaccionar.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public field: string | null
  ) {
    super(message)
  }
}

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...(init.headers ?? {}) } : init?.headers,
  })
  const data = (await res.json().catch(() => null)) as (T & { error?: string; field?: string | null }) | null
  if (!res.ok) throw new ApiError(data?.error ?? "Error de red", res.status, data?.field ?? null)
  return data as T
}

export const errorMessage = (err: unknown, fallback = "Ocurrió un error") => (err instanceof Error ? err.message : fallback)
