import type { $Enums } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { assertSubscriptionCapacity } from "@/lib/billing/subscriptions";
import { CrudError, type CrudModule, type ListParams, type CrudListResult } from "../types";

export interface MemberDto {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  gender: $Enums.Gender | null;
  birthDate: string | null;
  maritalStatus: $Enums.MaritalStatus | null;
  occupation: string | null;
  contactSchedule: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationId: string | null;
  visionStage: $Enums.VisionStage;
  hierarchy: $Enums.ChurchHierarchy;
  discipleOfId: string | null;
  firstVisitAt: string | null;
  invitedByName: string | null;
  baptizedWater: boolean;
  baptizedWaterAt: string | null;
  /** Marcas del camino (solo lectura): se ponen al finalizar el evento. */
  encounterAt: string | null;
  launchAt: string | null;
  baptizedFire: boolean;
  baptizedFireAt: string | null;
  imageUrl: string | null;
  notes: string | null;
  memberCode: string | null;
  hasAccess: boolean;
  isActive: boolean;
}

const GENDERS = ["male", "female"] as const;
const MARITAL = ["single", "married", "free_union", "separated", "divorced", "widowed"] as const;
const STAGES = ["win", "consolidate", "encounter", "school", "launch", "leadership", "discipleship"] as const;
const HIERARCHIES = ["believer", "disciple", "servant", "leader", "network_leader", "pastor", "senior_pastor"] as const;

const text = (v: unknown, max = 255): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};
const coord = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
function pick<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}
function dateOrNull(v: unknown, field: string): Date | null {
  if (v === undefined || v === null || v === "") return null;
  const raw = String(v);
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw);
  if (Number.isNaN(d.getTime())) throw new CrudError("Fecha inválida", 400, field);
  return d;
}
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

type MemberRow = Awaited<ReturnType<typeof prisma.member.findFirstOrThrow>>;

function serialize(m: MemberRow): MemberDto {
  const address = [m.street, m.streetNumber, m.neighborhood, m.city].filter(Boolean).join(", ");
  return {
    id: m.id,
    fullName: m.fullName,
    phone: m.phone,
    email: m.email,
    gender: m.gender,
    birthDate: iso(m.birthDate),
    maritalStatus: m.maritalStatus,
    occupation: m.occupation,
    contactSchedule: m.contactSchedule,
    address: address || null,
    latitude: m.latitude === null ? null : m.latitude.toNumber(),
    longitude: m.longitude === null ? null : m.longitude.toNumber(),
    locationId: m.locationId,
    visionStage: m.visionStage,
    hierarchy: m.hierarchy,
    discipleOfId: m.discipleOfId,
    firstVisitAt: iso(m.firstVisitAt),
    invitedByName: m.invitedByName,
    baptizedWater: m.baptizedWater,
    baptizedWaterAt: iso(m.baptizedWaterAt),
    encounterAt: iso(m.encounterAt),
    launchAt: iso(m.launchAt),
    baptizedFire: m.baptizedFire,
    baptizedFireAt: iso(m.baptizedFireAt),
    imageUrl: m.imageUrl,
    notes: m.notes,
    memberCode: m.memberCode,
    hasAccess: m.userId !== null,
    isActive: m.isActive,
  };
}

/** Valida y normaliza el cuerpo. Las relaciones se comprueban contra la iglesia. */
async function parse(organizationId: string, data: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || data.fullName !== undefined) {
    const name = text(data.fullName, 150);
    if (!name) throw new CrudError("El nombre es obligatorio", 400, "fullName");
    out.fullName = name;
  }
  const set = (key: string, value: unknown) => {
    if (!partial || data[key] !== undefined) out[key] = value;
  };
  set("phone", text(data.phone, 30));
  set("email", text(data.email, 190)?.toLowerCase() ?? null);
  set("gender", pick(data.gender, GENDERS));
  set("maritalStatus", pick(data.maritalStatus, MARITAL));
  set("occupation", text(data.occupation, 100));
  set("contactSchedule", text(data.contactSchedule, 100));
  set("invitedByName", text(data.invitedByName, 150));
  set("imageUrl", text(data.imageUrl, 500));
  set("notes", text(data.notes, 1000));
  set("latitude", coord(data.latitude));
  set("longitude", coord(data.longitude));
  if (!partial || data.address !== undefined) {
    // El domicilio se captura como una sola línea; se conserva en `street`.
    out.street = text(data.address, 255);
    out.streetNumber = null;
    out.neighborhood = null;
    out.city = null;
  }
  if (!partial || data.birthDate !== undefined) out.birthDate = dateOrNull(data.birthDate, "birthDate");
  if (!partial || data.firstVisitAt !== undefined) out.firstVisitAt = dateOrNull(data.firstVisitAt, "firstVisitAt");
  if (!partial || data.baptizedWater !== undefined) {
    out.baptizedWater = data.baptizedWater === true;
    out.baptizedWaterAt = out.baptizedWater ? dateOrNull(data.baptizedWaterAt, "baptizedWaterAt") : null;
  }
  if (!partial || data.baptizedFire !== undefined) {
    out.baptizedFire = data.baptizedFire === true;
    out.baptizedFireAt = out.baptizedFire ? dateOrNull(data.baptizedFireAt, "baptizedFireAt") : null;
  }
  if (!partial || data.visionStage !== undefined) {
    const stage = pick(data.visionStage, STAGES);
    if (data.visionStage !== undefined && data.visionStage !== "" && !stage)
      throw new CrudError("Etapa inválida", 400, "visionStage");
    if (stage) out.visionStage = stage;
  }
  if (!partial || data.hierarchy !== undefined) {
    const h = pick(data.hierarchy, HIERARCHIES);
    if (data.hierarchy !== undefined && data.hierarchy !== "" && !h)
      throw new CrudError("Jerarquía inválida", 400, "hierarchy");
    if (h) out.hierarchy = h;
  }
  if (!partial || data.isActive !== undefined) out.isActive = data.isActive !== false;

  // Relaciones: siempre dentro de la misma iglesia.
  if (!partial || data.locationId !== undefined) {
    const id = text(data.locationId, 40);
    if (id) {
      const loc = await prisma.location.findFirst({ where: { id, organizationId }, select: { id: true } });
      if (!loc) throw new CrudError("Sede no válida", 400, "locationId");
    }
    out.locationId = id;
  }
  if (!partial || data.discipleOfId !== undefined) {
    const id = text(data.discipleOfId, 40);
    if (id) {
      const mentor = await prisma.member.findFirst({ where: { id, organizationId }, select: { id: true } });
      if (!mentor) throw new CrudError("La persona que discipula no existe en esta iglesia", 400, "discipleOfId");
    }
    out.discipleOfId = id;
  }
  return out;
}

export const membersModule: CrudModule<MemberDto> = {
  key: "members",

  async createDefaults() {
    return { visionStage: "win", hierarchy: "believer", isActive: true };
  },

  async list(organizationId, params: ListParams): Promise<CrudListResult<MemberDto>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 20);
    const q = params.q?.trim() ?? "";
    const stage = pick(params.stage, STAGES);
    const hierarchy = pick(params.hierarchy, HIERARCHIES);
    const where = {
      organizationId,
      ...(stage ? { visionStage: stage } : {}),
      ...(hierarchy ? { hierarchy } : {}),
      ...(q
        ? { OR: [{ fullName: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }, { memberCode: { contains: q } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.member.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.member.count({ where }),
    ]);
    return { rows: rows.map(serialize), total };
  },

  async get(organizationId, id) {
    const m = await prisma.member.findFirst({ where: { id, organizationId } });
    if (!m) throw new CrudError("Creyente no encontrado", 404);
    return serialize(m);
  },

  async create(organizationId, input, ctx) {
    await assertSubscriptionCapacity(organizationId, "employees");
    const data = await parse(organizationId, input as Record<string, unknown>, false);
    const created = await prisma.$transaction(async (tx) => {
      const m = await tx.member.create({
        data: { organizationId, ...data } as Parameters<typeof tx.member.create>[0]["data"],
      });
      await tx.memberStageLog.create({
        data: { organizationId, memberId: m.id, stage: m.visionStage, changedById: ctx.userId, note: "Alta" },
      });
      return m;
    });
    return serialize(created);
  },

  async update(organizationId, id, input, ctx) {
    const existing = await prisma.member.findFirst({ where: { id, organizationId } });
    if (!existing) throw new CrudError("Creyente no encontrado", 404);
    const data = await parse(organizationId, input as Record<string, unknown>, true);
    if (data.discipleOfId === id) throw new CrudError("Una persona no puede discipularse a sí misma", 400, "discipleOfId");
    const updated = await prisma.$transaction(async (tx) => {
      const m = await tx.member.update({ where: { id }, data: data as Parameters<typeof tx.member.update>[0]["data"] });
      if (data.visionStage && data.visionStage !== existing.visionStage) {
        await tx.memberStageLog.create({
          data: { organizationId, memberId: id, stage: m.visionStage, changedById: ctx.userId },
        });
      }
      return m;
    });
    return serialize(updated);
  },

  async remove(organizationId, id) {
    const m = await prisma.member.findFirst({ where: { id, organizationId } });
    if (!m) throw new CrudError("Creyente no encontrado", 404);
    // Se inactiva (no se borra): el historial y las relaciones se conservan.
    await prisma.member.update({ where: { id }, data: { isActive: false } });
  },
};
