import { prisma } from "@/lib/db";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface PositionDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  employeeCount: number;
}

export const positionsModule: CrudModule<PositionDto> = {
  key: "positions",

  async list(organizationId, params: ListParams): Promise<CrudListResult<PositionDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";

    const where = {
      organizationId,
      ...(q ? { name: { contains: q } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.employeePosition.findMany({
        where,
        include: { _count: { select: { employees: true } } },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.employeePosition.count({ where }),
    ]);

    return {
      rows: rows.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        isActive: p.isActive,
        employeeCount: p._count.employees,
      })),
      total,
    };
  },

  async get(organizationId, id) {
    const p = await prisma.employeePosition.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { employees: true } } },
    });
    if (!p) throw new CrudError("Puesto no encontrado", 404);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      employeeCount: p._count.employees,
    };
  },

  async create(organizationId, input) {
    const data = input as Record<string, unknown>;
    if (!data.name || String(data.name).trim() === "") {
      throw new CrudError("El nombre es obligatorio", 400, "name");
    }
    const p = await prisma.employeePosition.create({
      data: {
        organizationId,
        name: String(data.name).trim(),
        description: data.description ? String(data.description) : null,
        isActive: data.isActive !== false,
      },
    });
    return { id: p.id, name: p.name, description: p.description, isActive: p.isActive, employeeCount: 0 };
  },

  async update(organizationId, id, input) {
    const data = input as Record<string, unknown>;
    const existing = await prisma.employeePosition.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Puesto no encontrado", 404);

    const p = await prisma.employeePosition.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: String(data.name).trim() || existing.name } : {}),
        ...(data.description !== undefined ? { description: data.description ? String(data.description) : null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive !== false } : {}),
      },
      include: { _count: { select: { employees: true } } },
    });
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      employeeCount: p._count.employees,
    };
  },

  async remove(organizationId, id) {
    const p = await prisma.employeePosition.findFirst({ where: { id, organizationId } });
    if (!p) throw new CrudError("Puesto no encontrado", 404);
    // Soft-delete: deactivate position to preserve history.
    await prisma.employeePosition.update({ where: { id }, data: { isActive: false } });
  },
};