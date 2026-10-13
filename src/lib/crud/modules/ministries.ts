import { prisma } from "@/lib/db";
import { createsCycle } from "@/lib/ministries/rules";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

// Catálogo de ministerios (administración). La gestión diaria (miembros, reuniones,
// lista, requisiciones) vive en el espacio de trabajo del ministerio.

export interface MinistryDto {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  kind: string;
  description: string | null;
  requirements: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  memberCount: number;
  leaderNames: string;
}

const include = {
  parent: { select: { name: true } },
  _count: { select: { members: { where: { isActive: true } } } },
  members: {
    where: { isActive: true, role: "leader" as const },
    select: { member: { select: { fullName: true } } },
  },
} as const;

type Row = Awaited<ReturnType<typeof prisma.ministry.findFirstOrThrow<{ include: typeof include }>>>;

const text = (v: unknown, max = 255): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

function serialize(m: Row): MinistryDto {
  return {
    id: m.id,
    name: m.name,
    parentId: m.parentId,
    parentName: m.parent?.name ?? null,
    kind: m.kind,
    description: m.description,
    requirements: m.requirements,
    imageUrl: m.imageUrl,
    sortOrder: m.sortOrder,
    isActive: m.isActive,
    memberCount: m._count.members,
    leaderNames: m.members.map((l) => l.member.fullName).join(", "),
  };
}

async function parentIdFor(organizationId: string, raw: unknown, selfId?: string): Promise<string | null> {
  const parentId = text(raw, 40);
  if (!parentId) return null;
  if (parentId === selfId) throw new CrudError("Un ministerio no puede ser padre de sí mismo", 400, "parentId");
  const all = await prisma.ministry.findMany({ where: { organizationId }, select: { id: true, parentId: true } });
  if (!all.some((m) => m.id === parentId)) throw new CrudError("Ministerio padre no válido", 400, "parentId");
  if (selfId && createsCycle(selfId, parentId, new Map(all.map((m) => [m.id, m.parentId])))) {
    throw new CrudError("Esa relación crearía un ciclo entre ministerios", 400, "parentId");
  }
  return parentId;
}

async function assertNameFree(organizationId: string, name: string, exceptId?: string) {
  const dup = await prisma.ministry.findFirst({
    where: { organizationId, name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new CrudError("Ya existe un ministerio con ese nombre", 400, "name");
}

export const ministriesModule: CrudModule<MinistryDto> = {
  key: "ministries",

  async createDefaults() {
    return { isActive: true, sortOrder: 0 };
  },

  async list(organizationId, params: ListParams): Promise<CrudListResult<MinistryDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";
    const where = {
      organizationId,
      ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.ministry.findMany({
        where,
        include,
        orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ministry.count({ where }),
    ]);
    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const m = await prisma.ministry.findFirst({ where: { id, organizationId }, include });
    if (!m) throw new CrudError("Ministerio no encontrado", 404);
    return serialize(m);
  },

  async create(organizationId, input) {
    const data = input as Record<string, unknown>;
    const name = text(data.name, 120);
    if (!name) throw new CrudError("El nombre es obligatorio", 400, "name");
    await assertNameFree(organizationId, name);
    const parentId = await parentIdFor(organizationId, data.parentId);
    const created = await prisma.ministry.create({
      data: {
        organizationId,
        name,
        parentId,
        kind: text(data.kind, 30) ?? "general",
        description: text(data.description, 2000),
        requirements: text(data.requirements, 2000),
        imageUrl: text(data.imageUrl, 500),
        sortOrder: Number.isFinite(Number(data.sortOrder)) ? Math.trunc(Number(data.sortOrder)) : 0,
        isActive: data.isActive !== false,
      },
      include,
    });
    return serialize(created);
  },

  async update(organizationId, id, input) {
    const data = input as Record<string, unknown>;
    const existing = await prisma.ministry.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Ministerio no encontrado", 404);
    const name = data.name !== undefined ? text(data.name, 120) : undefined;
    if (data.name !== undefined && !name) throw new CrudError("El nombre es obligatorio", 400, "name");
    if (name) await assertNameFree(organizationId, name, id);
    const parentId = data.parentId !== undefined ? await parentIdFor(organizationId, data.parentId, id) : undefined;
    const updated = await prisma.ministry.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(parentId !== undefined ? { parentId } : {}),
        ...(data.kind !== undefined ? { kind: text(data.kind, 30) ?? "general" } : {}),
        ...(data.description !== undefined ? { description: text(data.description, 2000) } : {}),
        ...(data.requirements !== undefined ? { requirements: text(data.requirements, 2000) } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: text(data.imageUrl, 500) } : {}),
        ...(data.sortOrder !== undefined && Number.isFinite(Number(data.sortOrder)) ? { sortOrder: Math.trunc(Number(data.sortOrder)) } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive !== false } : {}),
      },
      include,
    });
    return serialize(updated);
  },

  async remove(organizationId, id) {
    const m = await prisma.ministry.findFirst({ where: { id, organizationId } });
    if (!m) throw new CrudError("Ministerio no encontrado", 404);
    // Se inactiva (no se borra): conserva miembros, reuniones y asistencia.
    await prisma.ministry.update({ where: { id }, data: { isActive: false } });
  },
};
