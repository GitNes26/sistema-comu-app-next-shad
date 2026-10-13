export type ListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  [key: string]: string | number | undefined;
};

export type CrudListResult<T> = { rows: T[]; total: number };

export interface CrudContext {
  userId: string;
}

export interface CrudModule<T> {
  key: string;
  /** Values calculated by the server for a new form (folios, tenant defaults, etc.). */
  createDefaults?: (organizationId: string) => Promise<Record<string, unknown>>;
  list: (organizationId: string, params: ListParams) => Promise<CrudListResult<T>>;
  get: (organizationId: string, id: string) => Promise<T>;
  create: (organizationId: string, input: unknown, ctx: CrudContext) => Promise<T>;
  update: (organizationId: string, id: string, input: unknown, ctx: CrudContext) => Promise<T>;
  remove: (organizationId: string, id: string) => Promise<void>;
  /** Restore a soft-deactivated record. Optional — generic fallback reactivates isActive. */
  restore?: (organizationId: string, id: string) => Promise<void>;
}

export class CrudError extends Error {
  status: number;
  field?: string;
  constructor(message: string, status = 400, field?: string) {
    super(message);
    this.name = "CrudError";
    this.status = status;
    this.field = field;
  }
}

export function parseListParams(searchParams: URLSearchParams): ListParams {
  const params: ListParams = {};
  for (const [key, value] of searchParams.entries()) {
    if (key === "page" || key === "pageSize") {
      params[key] = Number(value);
    } else {
      params[key] = value;
    }
  }
  return params;
}

