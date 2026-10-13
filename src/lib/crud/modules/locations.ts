import { prisma } from "@/lib/db";
import { assertSubscriptionCapacity } from "@/lib/billing/subscriptions";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface LocationDto {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  managerName: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  notes: string | null;
  timezone: string;
  isActive: boolean;
  memberCount: number;
}

type LocationRow = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  latitude: { toNumber(): number } | null;
  longitude: { toNumber(): number } | null;
  managerName: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  notes: string | null;
  timezone: string;
  isActive: boolean;
  _count: { members: number };
};

const decimalOrNull = (v: { toNumber(): number } | null): number | null => (v === null ? null : v.toNumber());
const text = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
};
const coord = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const include = { _count: { select: { members: true } } } as const;

function serialize(l: LocationRow): LocationDto {
  return {
    id: l.id,
    name: l.name,
    code: l.code,
    address: l.address,
    latitude: decimalOrNull(l.latitude),
    longitude: decimalOrNull(l.longitude),
    managerName: l.managerName,
    phone: l.phone,
    email: l.email,
    imageUrl: l.imageUrl,
    notes: l.notes,
    timezone: l.timezone,
    isActive: l.isActive,
    memberCount: l._count.members,
  };
}

export const locationsModule: CrudModule<LocationDto> = {
  key: "locations",

  async createDefaults(organizationId) {
    const profile = await prisma.companyProfile.findUnique({ where: { organizationId } });
    return {
      address: profile?.address ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
      timezone: "America/Mexico_City",
      isActive: true,
    };
  },

  async list(organizationId, params: ListParams): Promise<CrudListResult<LocationDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";
    const where = {
      organizationId,
      ...(q
        ? { OR: [{ name: { contains: q } }, { address: { contains: q } }, { managerName: { contains: q } }, { phone: { contains: q } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.location.findMany({
        where,
        include,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.location.count({ where }),
    ]);
    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const l = await prisma.location.findFirst({ where: { id, organizationId }, include });
    if (!l) throw new CrudError("Sede no encontrada", 404);
    return serialize(l);
  },

  async create(organizationId, input) {
    await assertSubscriptionCapacity(organizationId, "locations");
    const data = input as Record<string, unknown>;
    const name = text(data.name);
    if (!name) throw new CrudError("El nombre es obligatorio", 400, "name");
    const code = text(data.code)?.toUpperCase() ?? null;
    if (code) {
      const dup = await prisma.location.findFirst({ where: { organizationId, code } });
      if (dup) throw new CrudError("Ese código de sede ya existe", 400, "code");
    }
    const profile = await prisma.companyProfile.findUnique({ where: { organizationId } });
    const created = await prisma.location.create({
      data: {
        organizationId,
        name,
        code,
        address: text(data.address) ?? profile?.address ?? null,
        latitude: coord(data.latitude),
        longitude: coord(data.longitude),
        managerName: text(data.managerName),
        phone: text(data.phone) ?? profile?.phone ?? null,
        email: text(data.email) ?? profile?.email ?? null,
        imageUrl: text(data.imageUrl),
        notes: text(data.notes),
        timezone: text(data.timezone) ?? "America/Mexico_City",
        isActive: data.isActive !== false,
      },
      include,
    });
    return serialize(created);
  },

  async update(organizationId, id, input) {
    const data = input as Record<string, unknown>;
    const existing = await prisma.location.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Sede no encontrada", 404);
    const code = data.code !== undefined ? (text(data.code)?.toUpperCase() ?? null) : undefined;
    if (code) {
      const dup = await prisma.location.findFirst({ where: { organizationId, code, id: { not: id } } });
      if (dup) throw new CrudError("Ese código de sede ya existe", 400, "code");
    }
    const location = await prisma.location.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: text(data.name) ?? existing.name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(data.address !== undefined ? { address: text(data.address) } : {}),
        ...(data.latitude !== undefined ? { latitude: coord(data.latitude) } : {}),
        ...(data.longitude !== undefined ? { longitude: coord(data.longitude) } : {}),
        ...(data.managerName !== undefined ? { managerName: text(data.managerName) } : {}),
        ...(data.phone !== undefined ? { phone: text(data.phone) } : {}),
        ...(data.email !== undefined ? { email: text(data.email) } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: text(data.imageUrl) } : {}),
        ...(data.notes !== undefined ? { notes: text(data.notes) } : {}),
        ...(data.timezone !== undefined ? { timezone: text(data.timezone) ?? "America/Mexico_City" } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive !== false } : {}),
      },
      include,
    });
    return serialize(location);
  },

  async remove(organizationId, id) {
    const l = await prisma.location.findFirst({ where: { id, organizationId } });
    if (!l) throw new CrudError("Sede no encontrada", 404);
    // Se inactiva (no se borra) para conservar el historial.
    await prisma.location.update({ where: { id }, data: { isActive: false } });
  },
};
