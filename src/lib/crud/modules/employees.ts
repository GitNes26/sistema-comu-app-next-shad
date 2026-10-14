import { prisma } from "@/lib/db";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface EmployeeDto {
  id: string;
  memberId: string;
  fullName: string;
  phone: string | null;
  employeeCode: string | null;
  positionId: string | null;
  positionName: string | null;
  locationId: string | null;
  locationName: string | null;
  hiredAt: string | null;
  salaryType: string;
  salaryAmount: number;
  paymentFrequency: string;
  payMethod: string;
  notes: string | null;
  isActive: boolean;
}

const include = {
  member: { select: { fullName: true, phone: true } },
  position: { select: { name: true } },
  location: { select: { name: true } },
} as const;

type Row = Awaited<ReturnType<typeof prisma.employee.findFirstOrThrow<{ include: typeof include }>>>;

const text = (v: unknown, max = 255): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};
const SALARY_TYPES = ["", "hourly", "daily", "weekly", "monthly"];
const FREQUENCIES = ["weekly", "biweekly", "monthly"];
const PAY_METHODS = ["cash", "transfer", "check"];

function serialize(e: Row): EmployeeDto {
  return {
    id: e.id,
    memberId: e.memberId,
    fullName: e.member.fullName,
    phone: e.member.phone,
    employeeCode: e.employeeCode,
    positionId: e.positionId,
    positionName: e.position?.name ?? null,
    locationId: e.locationId,
    locationName: e.location?.name ?? null,
    hiredAt: e.hiredAt ? e.hiredAt.toISOString().slice(0, 10) : null,
    salaryType: e.salaryType,
    salaryAmount: e.salaryAmount.toNumber(),
    paymentFrequency: e.paymentFrequency,
    payMethod: e.payMethod,
    notes: e.notes,
    isActive: e.isActive,
  };
}

async function parse(organizationId: string, data: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || data.employeeCode !== undefined) out.employeeCode = text(data.employeeCode, 40)?.toUpperCase() ?? null;
  if (!partial || data.notes !== undefined) out.notes = text(data.notes, 1000);
  if (!partial || data.hiredAt !== undefined) {
    const raw = text(data.hiredAt, 30);
    if (raw) {
      const d = new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw);
      if (Number.isNaN(d.getTime())) throw new CrudError("Fecha inválida", 400, "hiredAt");
      out.hiredAt = d;
    } else out.hiredAt = null;
  }
  if (!partial || data.salaryType !== undefined) {
    const v = String(data.salaryType ?? "");
    if (!SALARY_TYPES.includes(v)) throw new CrudError("Tipo de pago inválido", 400, "salaryType");
    out.salaryType = v;
  }
  if (!partial || data.paymentFrequency !== undefined) {
    const v = String(data.paymentFrequency ?? "biweekly");
    if (!FREQUENCIES.includes(v)) throw new CrudError("Frecuencia inválida", 400, "paymentFrequency");
    out.paymentFrequency = v;
  }
  if (!partial || data.payMethod !== undefined) {
    const v = String(data.payMethod ?? "cash");
    if (!PAY_METHODS.includes(v)) throw new CrudError("Forma de pago inválida", 400, "payMethod");
    out.payMethod = v;
  }
  if (!partial || data.salaryAmount !== undefined) {
    const n = Number(data.salaryAmount ?? 0);
    if (!Number.isFinite(n) || n < 0) throw new CrudError("Monto inválido", 400, "salaryAmount");
    out.salaryAmount = n;
  }
  if (!partial || data.isActive !== undefined) out.isActive = data.isActive !== false;
  if (!partial || data.positionId !== undefined) {
    const id = text(data.positionId, 40);
    if (id && !(await prisma.employeePosition.findFirst({ where: { id, organizationId }, select: { id: true } })))
      throw new CrudError("Puesto no válido", 400, "positionId");
    out.positionId = id;
  }
  if (!partial || data.locationId !== undefined) {
    const id = text(data.locationId, 40);
    if (id && !(await prisma.location.findFirst({ where: { id, organizationId }, select: { id: true } })))
      throw new CrudError("Sede no válida", 400, "locationId");
    out.locationId = id;
  }
  return out;
}

async function assertCodeFree(organizationId: string, code: unknown, exceptId?: string) {
  if (typeof code !== "string" || !code) return;
  const dup = await prisma.employee.findFirst({
    where: { organizationId, employeeCode: code, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new CrudError("Ese código de empleado ya existe", 400, "employeeCode");
}

export const employeesModule: CrudModule<EmployeeDto> = {
  key: "employees",

  async list(organizationId, params: ListParams): Promise<CrudListResult<EmployeeDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";
    const where = {
      organizationId,
      ...(q ? { OR: [{ member: { fullName: { contains: q } } }, { employeeCode: { contains: q } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include,
        orderBy: [{ isActive: "desc" }, { member: { fullName: "asc" } }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.employee.count({ where }),
    ]);
    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const e = await prisma.employee.findFirst({ where: { id, organizationId }, include });
    if (!e) throw new CrudError("Empleado no encontrado", 404);
    return serialize(e);
  },

  async create(organizationId, input) {
    const raw = input as Record<string, unknown>;
    const memberId = text(raw.memberId, 40);
    if (!memberId) throw new CrudError("Elige al creyente", 400, "memberId");
    const member = await prisma.member.findFirst({ where: { id: memberId, organizationId }, select: { id: true } });
    if (!member) throw new CrudError("El creyente no existe en esta iglesia", 400, "memberId");
    if (await prisma.employee.findUnique({ where: { memberId }, select: { id: true } }))
      throw new CrudError("Este creyente ya es empleado", 409, "memberId");
    const data = await parse(organizationId, raw, false);
    await assertCodeFree(organizationId, data.employeeCode);
    const created = await prisma.employee.create({
      data: { organizationId, memberId, ...data } as Parameters<typeof prisma.employee.create>[0]["data"],
      include,
    });
    return serialize(created);
  },

  async update(organizationId, id, input) {
    const existing = await prisma.employee.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Empleado no encontrado", 404);
    const data = await parse(organizationId, input as Record<string, unknown>, true);
    await assertCodeFree(organizationId, data.employeeCode, id);
    const updated = await prisma.employee.update({
      where: { id },
      data: data as Parameters<typeof prisma.employee.update>[0]["data"],
      include,
    });
    return serialize(updated);
  },

  async remove(organizationId, id) {
    const e = await prisma.employee.findFirst({ where: { id, organizationId } });
    if (!e) throw new CrudError("Empleado no encontrado", 404);
    await prisma.employee.update({ where: { id }, data: { isActive: false } });
  },
};
