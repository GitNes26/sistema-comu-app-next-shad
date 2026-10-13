import bcrypt from "bcryptjs"
import type { $Enums } from "../../src/generated/prisma/client"
import { prisma } from "../../src/lib/db/client"

// Seed de demostración (solo desarrollo): una iglesia con un usuario por rol y
// un padrón pequeño. Doble opt-in: SEED_DEMO=true y NODE_ENV != production.
// La contraseña común viene de DEMO_PASSWORD (por defecto, un valor solo de desarrollo).

export function isDemoSeedingEnabled() {
  return process.env.SEED_DEMO === "true" && process.env.NODE_ENV !== "production"
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo123"
const ORG_NAME = "Comunidad Torreón (demo)"

type DemoUser = {
  email: string
  name: string
  level: $Enums.OrgRole
  roleId: string
  hierarchy: $Enums.ChurchHierarchy
  stage: $Enums.VisionStage
}

const USERS: DemoUser[] = [
  { email: "demo.owner@comuapp.test", name: "Pastor Principal", level: "owner", roleId: "system-owner", hierarchy: "pastor", stage: "discipleship" },
  { email: "demo.admin@comuapp.test", name: "Ana Administradora", level: "admin", roleId: "system-admin", hierarchy: "leader", stage: "leadership" },
  { email: "demo.secretaria@comuapp.test", name: "Sofía Secretaría", level: "servant", roleId: "system-secretary", hierarchy: "believer", stage: "school" },
  { email: "demo.tesorero@comuapp.test", name: "Tomás Tesorero", level: "leader", roleId: "system-treasurer", hierarchy: "leader", stage: "leadership" },
  { email: "demo.celula@comuapp.test", name: "Lupita Líder de Célula", level: "leader", roleId: "system-cell-leader", hierarchy: "leader", stage: "leadership" },
  { email: "demo.creyente@comuapp.test", name: "Carlos Creyente", level: "believer", roleId: "system-believer", hierarchy: "believer", stage: "consolidate" },
]

const EXTRA_MEMBERS: { name: string; stage: $Enums.VisionStage; gender: $Enums.Gender; phone: string }[] = [
  { name: "Marta Ríos", stage: "win", gender: "female", phone: "8711000001" },
  { name: "Jesús Herrera", stage: "consolidate", gender: "male", phone: "8711000002" },
  { name: "Elena Cárdenas", stage: "encounter", gender: "female", phone: "8711000003" },
  { name: "Diego Montes", stage: "school", gender: "male", phone: "8711000004" },
  { name: "Ruth Villarreal", stage: "launch", gender: "female", phone: "8711000005" },
  { name: "Samuel Quiroz", stage: "leadership", gender: "male", phone: "8711000006" },
]

export async function seedDemo() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const plan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })

  // Usuarios (idempotente por correo)
  const users = new Map<string, string>()
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { isActive: true, activationRequired: false },
      create: { email: u.email, passwordHash, fullName: u.name, isActive: true, emailVerified: new Date() },
    })
    users.set(u.email, user.id)
  }

  const owner = users.get(USERS[0].email)!
  let org = await prisma.organization.findFirst({ where: { name: ORG_NAME } })
  if (!org) {
    org = await prisma.organization.create({ data: { name: ORG_NAME, ownerId: owner } })
    await prisma.companyProfile.create({ data: { organizationId: org.id, tradeName: ORG_NAME } })
    await prisma.appSettings.create({ data: { organizationId: org.id } })
  }
  if (plan) {
    await prisma.organizationSubscription.upsert({
      where: { organizationId: org.id },
      update: {},
      create: {
        organizationId: org.id,
        planId: plan.id,
        status: "active",
        periodEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    })
  }

  const location =
    (await prisma.location.findFirst({ where: { organizationId: org.id, code: "CENTRO" } })) ??
    (await prisma.location.create({
      data: { organizationId: org.id, name: "Sede Centro", code: "CENTRO", managerName: USERS[0].name },
    }))

  for (const u of USERS) {
    const userId = users.get(u.email)!
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId, organizationId: org.id } },
      update: { role: u.level, roleId: u.roleId },
      create: { userId, organizationId: org.id, role: u.level, roleId: u.roleId },
    })
    const existing = await prisma.member.findFirst({ where: { organizationId: org.id, userId } })
    if (!existing) {
      const m = await prisma.member.create({
        data: {
          organizationId: org.id,
          locationId: location.id,
          userId,
          fullName: u.name,
          email: u.email,
          hierarchy: u.hierarchy,
          visionStage: u.stage,
          baptizedWater: u.stage !== "win" && u.stage !== "consolidate",
        },
      })
      await prisma.memberStageLog.create({ data: { organizationId: org.id, memberId: m.id, stage: u.stage, note: "Demo" } })
    }
  }

  for (const e of EXTRA_MEMBERS) {
    const exists = await prisma.member.findFirst({ where: { organizationId: org.id, fullName: e.name } })
    if (exists) continue
    const m = await prisma.member.create({
      data: {
        organizationId: org.id,
        locationId: location.id,
        fullName: e.name,
        phone: e.phone,
        gender: e.gender,
        visionStage: e.stage,
        firstVisitAt: new Date(),
      },
    })
    await prisma.memberStageLog.create({ data: { organizationId: org.id, memberId: m.id, stage: e.stage, note: "Demo" } })
  }

  const position =
    (await prisma.employeePosition.findFirst({ where: { organizationId: org.id, name: "Secretaria" } })) ??
    (await prisma.employeePosition.create({
      data: { organizationId: org.id, name: "Secretaria", description: "Atención y registro de la iglesia" },
    }))
  const secretary = await prisma.member.findFirst({ where: { organizationId: org.id, email: "demo.secretaria@comuapp.test" } })
  if (secretary && !(await prisma.employee.findUnique({ where: { memberId: secretary.id } }))) {
    await prisma.employee.create({
      data: { organizationId: org.id, memberId: secretary.id, positionId: position.id, locationId: location.id, employeeCode: "EMP-001" },
    })
  }

  // ── Ministerios ───────────────────────────────────────────────────────────
  // Una persona puede estar en varios ministerios con un papel distinto en cada uno.
  const MINISTRIES: { name: string; parent?: string; kind?: string }[] = [
    { name: "Alabanza", kind: "worship" },
    { name: "Producción" },
    { name: "Audio", parent: "Producción" },
    { name: "Iluminación", parent: "Producción" },
    { name: "Proyección", parent: "Producción" },
    { name: "Fotografía", parent: "Producción" },
    { name: "Video", parent: "Producción" },
    { name: "Transmisión", parent: "Producción" },
    { name: "Ujieres" },
    { name: "Hombres de Reino" },
    { name: "Bienvenida" },
    { name: "Consolidación", kind: "consolidation" },
    { name: "Comunidad Kids", kind: "kids" },
    { name: "Arte" },
    { name: "Jóvenes", kind: "youth" },
    { name: "Varones", kind: "group" },
    { name: "Mujeres", kind: "group" },
  ];
  const ministryIds = new Map<string, string>();
  for (const [index, m] of MINISTRIES.entries()) {
    const existing = await prisma.ministry.findFirst({ where: { organizationId: org.id, name: m.name } });
    const row =
      existing ??
      (await prisma.ministry.create({
        data: {
          organizationId: org.id,
          name: m.name,
          kind: m.kind ?? "general",
          sortOrder: index,
          parentId: m.parent ? ministryIds.get(m.parent) ?? null : null,
        },
      }));
    ministryIds.set(m.name, row.id);
  }
  const memberByEmail = async (email: string) =>
    (await prisma.member.findFirst({ where: { organizationId: org.id, email }, select: { id: true } }))?.id;
  const assignments: { email: string; ministry: string; role: "leader" | "assistant" | "servant"; title?: string }[] = [
    { email: "demo.admin@comuapp.test", ministry: "Ujieres", role: "leader" },
    { email: "demo.admin@comuapp.test", ministry: "Bienvenida", role: "leader" },
    { email: "demo.celula@comuapp.test", ministry: "Consolidación", role: "leader" },
    { email: "demo.celula@comuapp.test", ministry: "Ujieres", role: "servant" },
    { email: "demo.creyente@comuapp.test", ministry: "Bienvenida", role: "servant" },
    { email: "demo.creyente@comuapp.test", ministry: "Ujieres", role: "servant" },
    { email: "demo.tesorero@comuapp.test", ministry: "Producción", role: "leader", title: "Coordinador general" },
    { email: "demo.secretaria@comuapp.test", ministry: "Audio", role: "assistant" },
    { email: "demo.celula@comuapp.test", ministry: "Alabanza", role: "leader", title: "Director de alabanza" },
    { email: "demo.tesorero@comuapp.test", ministry: "Jóvenes", role: "leader", title: "Pastor de jóvenes" },
    { email: "demo.creyente@comuapp.test", ministry: "Alabanza", role: "servant" },
    { email: "demo.secretaria@comuapp.test", ministry: "Alabanza", role: "assistant" },
    { email: "demo.admin@comuapp.test", ministry: "Comunidad Kids", role: "leader", title: "Directora de Kids" },
    { email: "demo.celula@comuapp.test", ministry: "Comunidad Kids", role: "servant", title: "Maestra" },
    { email: "demo.secretaria@comuapp.test", ministry: "Comunidad Kids", role: "servant", title: "Apoyo" },
    { email: "demo.secretaria@comuapp.test", ministry: "Consolidación", role: "servant" },
  ];
  for (const a of assignments) {
    const memberId = await memberByEmail(a.email);
    const ministryId = ministryIds.get(a.ministry);
    if (!memberId || !ministryId) continue;
    await prisma.ministryMember.upsert({
      where: { ministryId_memberId: { ministryId, memberId } },
      update: { role: a.role, isActive: true },
      create: { organizationId: org.id, ministryId, memberId, role: a.role, positionTitle: a.title ?? null },
    });
  }

  // ── Alabanza: canciones, programa de la semana, rol y una audición ─────────
  const worshipId = ministryIds.get("Alabanza");
  if (worshipId && (await prisma.song.count({ where: { organizationId: org.id } })) === 0) {
    const songs = await Promise.all(
      [
        { title: "Sublime gracia", artist: "Tradicional", songKey: "G", bpm: 72, lyrics: "Sublime gracia del Señor, que a un infeliz salvó…" },
        { title: "Great Are You Lord", artist: "All Sons & Daughters", songKey: "D", bpm: 68, links: [{ label: "YouTube", url: "https://www.youtube.com/results?search_query=great+are+you+lord" }] },
        { title: "Way Maker", artist: "Sinach", songKey: "E", bpm: 66 },
        { title: "Digno es el Cordero", artist: "Ministerio demo", songKey: "A", bpm: 80 },
      ].map((s) => prisma.song.create({ data: { organizationId: org.id, ...s } })),
    );
    const day = new Date();
    const dow = (day.getUTCDay() + 6) % 7;
    const weekStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - dow));
    const program = await prisma.worshipProgram.create({
      data: { organizationId: org.id, ministryId: worshipId, weekStart, title: "Semana de adoración" },
    });
    for (const [i, song] of songs.slice(0, 3).entries()) {
      await prisma.worshipProgramSong.create({ data: { organizationId: org.id, programId: program.id, songId: song.id, position: i + 1 } });
    }
    const sunday = new Date(weekStart);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    sunday.setUTCHours(16, 0, 0, 0);
    for (const [email, instrument, status] of [
      ["demo.creyente@comuapp.test", "Voz", "pending"],
      ["demo.celula@comuapp.test", "Guitarra", "confirmed"],
    ] as const) {
      const memberId = await memberByEmail(email);
      if (memberId) {
        await prisma.worshipRosterEntry.create({
          data: { organizationId: org.id, ministryId: worshipId, serviceAt: sunday, serviceLabel: "Domingo 10:00", memberId, instrument, status },
        });
      }
    }
    const candidate = await prisma.member.findFirst({
      where: { organizationId: org.id, ministryMemberships: { none: { ministryId: worshipId } }, userId: null },
      select: { id: true },
    });
    if (candidate) {
      const at = new Date(Date.now() + 5 * 86400000);
      at.setHours(19, 0, 0, 0);
      await prisma.worshipAudition.create({
        data: { organizationId: org.id, ministryId: worshipId, memberId: candidate.id, instrument: "Teclado", scheduledAt: at },
      });
    }
  }

  // ── Consolidación: tres personas en distintas etapas del seguimiento ────────
  const consolidationId = ministryIds.get("Consolidación");
  if (consolidationId && (await prisma.consolidationCase.count({ where: { organizationId: org.id } })) === 0) {
    const byName = async (name: string) =>
      (await prisma.member.findFirst({ where: { organizationId: org.id, fullName: name }, select: { id: true } }))?.id;
    const sofia = await memberByEmail("demo.secretaria@comuapp.test");
    const days = (n: number) => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").getTime() - n * 86400000;
    const seeds = [
      { name: "Marta Ríos", ago: 1, accepted: true, status: "received" as const, assigned: null as string | null | undefined },
      { name: "Jesús Herrera", ago: 8, accepted: false, status: "following" as const, assigned: sofia },
      { name: "Elena Cárdenas", ago: 20, accepted: true, status: "channeled" as const, assigned: sofia },
    ];
    for (const c of seeds) {
      const memberId = await byName(c.name);
      if (!memberId) continue;
      const created = await prisma.consolidationCase.create({
        data: {
          organizationId: org.id,
          ministryId: consolidationId,
          memberId,
          visitedAt: new Date(days(c.ago)),
          serviceLabel: "Domingo 10:00",
          acceptedChrist: c.accepted,
          status: c.status,
          assignedMemberId: c.assigned ?? null,
          ...(c.status === "channeled" ? { outcome: "cell" as const, outcomeNote: "Célula de jóvenes, jueves 19:00", closedAt: new Date() } : {}),
        },
      });
      if (c.status !== "received") {
        await prisma.consolidationContact.create({
          data: {
            organizationId: org.id,
            caseId: created.id,
            channel: "call",
            summary: "Platicamos cómo le pareció la reunión; le gustaría seguir asistiendo.",
            interest: "yes",
            madeByMemberId: sofia ?? null,
            contactedAt: new Date(days(c.ago - 1)),
          },
        });
      }
    }
  }

  // ── Kids: salones, dos niños de Carlos y un servicio abierto ───────────────
  const kidsId = ministryIds.get("Comunidad Kids");
  if (kidsId && (await prisma.kidsChild.count({ where: { organizationId: org.id } })) === 0) {
    const { DEFAULT_ROOMS, BABY_CHECKLIST } = await import("../../src/lib/kids/rules");
    const { randomBytes } = await import("node:crypto");
    if ((await prisma.kidsRoom.count({ where: { organizationId: org.id } })) === 0) {
      await prisma.kidsRoom.createMany({ data: DEFAULT_ROOMS.map((r) => ({ ...r, organizationId: org.id })) });
    }
    const carlos = await memberByEmail("demo.creyente@comuapp.test");
    const born = (years: number, months = 0) => {
      const d = new Date();
      d.setUTCFullYear(d.getUTCFullYear() - years);
      d.setUTCMonth(d.getUTCMonth() - months);
      return new Date(d.toISOString().slice(0, 10) + "T00:00:00.000Z");
    };
    const kids = [
      { fullName: "Mateo Creyente", birthDate: born(2, 3), gender: "male" as const, indications: "Alérgico a las nueces." },
      { fullName: "Valeria Creyente", birthDate: born(7, 1), gender: "female" as const, indications: null },
    ];
    const created = [];
    for (const k of kids) {
      created.push(
        await prisma.kidsChild.create({
          data: {
            organizationId: org.id,
            ...k,
            qrToken: randomBytes(18).toString("base64url"),
            ...(carlos ? { guardians: { create: [{ organizationId: org.id, memberId: carlos, relation: "Padre/Madre" }] } } : {}),
          },
        }),
      );
    }
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    const session = await prisma.kidsSession.create({
      data: { organizationId: org.id, ministryId: kidsId, date: today, label: "Domingo 10:00" },
    });
    const baby = await prisma.kidsRoom.findFirst({ where: { organizationId: org.id, section: "baby" } });
    if (baby) {
      await prisma.kidsAttendance.create({
        data: {
          organizationId: org.id,
          sessionId: session.id,
          childId: created[0].id,
          roomId: baby.id,
          checklist: Object.fromEntries(BABY_CHECKLIST.map((i, n) => [i, n < 3])),
        },
      });
    }
  }

  // ── Células: una líder con dos células distintas, una red y cumpleañeros ────
  if ((await prisma.cell.count({ where: { organizationId: org.id } })) === 0) {
    const byName = async (name: string) =>
      (await prisma.member.findFirst({ where: { organizationId: org.id, fullName: name }, select: { id: true } }))?.id;
    const lupita = await memberByEmail("demo.celula@comuapp.test");
    const carlosId = await memberByEmail("demo.creyente@comuapp.test");
    const sofiaId = await memberByEmail("demo.secretaria@comuapp.test");
    const types = await Promise.all(
      ["De mujeres", "De matrimonios", "De jóvenes"].map((name, i) =>
        prisma.cellType.upsert({
          where: { organizationId_name: { organizationId: org.id, name } },
          update: {},
          create: { organizationId: org.id, name, sortOrder: i },
        }),
      ),
    );
    const samuel = await byName("Samuel Quiroz");
    const network = await prisma.cellNetwork.create({
      data: { organizationId: org.id, name: "Red Torreón Norte", description: "A cargo de un discípulo", leaderMemberId: samuel ?? null },
    });
    // Cumpleaños: dos este mes (el festejo es la última reunión) y uno el siguiente.
    const now = new Date();
    const bd = (monthOffset: number, day: number, year: number) =>
      new Date(Date.UTC(year, now.getUTCMonth() + monthOffset, day));
    const birthdays: [string, Date][] = [
      ["Marta Ríos", bd(0, 12, 1992)],
      ["Diego Montes", bd(0, 27, 1999)],
      ["Ruth Villarreal", bd(1, 3, 1988)],
    ];
    for (const [name, date] of birthdays) {
      const id = await byName(name);
      if (id) await prisma.member.update({ where: { id }, data: { birthDate: date } });
    }
    const cells = [
      {
        name: "Hogar de Amor Norte",
        typeId: types[0].id,
        networkId: network.id,
        dayOfWeek: 2,
        startTime: "19:00",
        hostName: "Familia Ríos",
        neighborhood: "Colonia Centro",
        city: "Torreón",
        members: [
          [lupita, "leader"],
          [sofiaId, "support"],
          [await byName("Marta Ríos"), "member"],
          [await byName("Elena Cárdenas"), "member"],
          [await byName("Ruth Villarreal"), "member"],
        ],
      },
      {
        name: "Matrimonios Centro",
        typeId: types[1].id,
        networkId: network.id,
        dayOfWeek: 5,
        startTime: "20:30",
        hostName: "Familia Herrera",
        neighborhood: "Residencial del Norte",
        city: "Torreón",
        members: [
          [lupita, "leader"],
          [carlosId, "member"],
          [await byName("Jesús Herrera"), "member"],
          [await byName("Diego Montes"), "member"],
        ],
      },
    ] as const;
    for (const c of cells) {
      const cell = await prisma.cell.create({
        data: {
          organizationId: org.id,
          name: c.name,
          typeId: c.typeId,
          networkId: c.networkId,
          dayOfWeek: c.dayOfWeek,
          startTime: c.startTime,
          hostName: c.hostName,
          neighborhood: c.neighborhood,
          city: c.city,
        },
      });
      for (const [memberId, role] of c.members) {
        if (!memberId) continue;
        await prisma.cellMember.upsert({
          where: { cellId_memberId: { cellId: cell.id, memberId } },
          update: {},
          create: { organizationId: org.id, cellId: cell.id, memberId, role },
        });
      }
    }
  }

  // ── Reuniones generales: horarios y las últimas reuniones registradas ────────
  if ((await prisma.gatheringSeries.count({ where: { organizationId: org.id } })) === 0) {
    const defs = [
      { name: "Domingo 10:00", kind: "general" as const, dayOfWeek: 0, startTime: "10:00" },
      { name: "Domingo 12:30", kind: "general" as const, dayOfWeek: 0, startTime: "12:30" },
      { name: "Miércoles 19:30", kind: "general" as const, dayOfWeek: 3, startTime: "19:30" },
      { name: "Jóvenes viernes 20:00", kind: "youth" as const, dayOfWeek: 5, startTime: "20:00" },
    ];
    const created = [];
    for (const [i, d] of defs.entries()) {
      created.push(await prisma.gatheringSeries.create({ data: { organizationId: org.id, sortOrder: i, ...d } }));
    }
    const lastDow = (dow: number, weeksBack: number) => {
      const t = new Date();
      const base = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
      const back = (base.getUTCDay() - dow + 7) % 7;
      return new Date(base.getTime() - (back + weeksBack * 7) * 86400000);
    };
    const topics = ["El amor del Padre", "Firmes en la fe", "Una iglesia que ora"];
    const ministriesServing = ["Alabanza", "Audio", "Bienvenida", "Comunidad Kids"]
      .map((n) => ministryIds.get(n))
      .filter((x): x is string => Boolean(x));
    for (let w = 0; w < 3; w++) {
      for (const [idx, series] of [created[0], created[1]].entries()) {
        const g = await prisma.gathering.create({
          data: {
            organizationId: org.id,
            seriesId: series.id,
            kind: "general",
            date: lastDow(0, w),
            startTime: series.startTime,
            topic: topics[w],
            speakerName: idx === 0 ? "Pastor Principal" : "Pastor Principal",
            menCount: 38 + w * 2 + idx * 6,
            womenCount: 52 + w * 3 + idx * 8,
            youthCount: 18 + idx * 5,
            kidsCount: 14 + idx * 4,
            newCount: 2 + w,
          },
        });
        await prisma.gatheringMinistry.createMany({
          data: ministriesServing.map((ministryId) => ({ organizationId: org.id, gatheringId: g.id, ministryId })),
        });
      }
      await prisma.gathering.create({
        data: {
          organizationId: org.id,
          seriesId: created[3].id,
          kind: "youth",
          date: lastDow(5, w),
          startTime: "20:00",
          topic: "Identidad en Cristo",
          speakerName: "Samuel Quiroz",
          menCount: 12,
          womenCount: 15,
          youthCount: 27,
          kidsCount: 0,
          newCount: 3,
        },
      });
    }
  }

  // ── Jóvenes como grupo: sus reuniones llevan su dueño ─────────────────────────
  const youthId = ministryIds.get("Jóvenes");
  if (youthId) {
    await prisma.gatheringSeries.updateMany({ where: { organizationId: org.id, kind: "youth", ministryId: null }, data: { ministryId: youthId } });
    await prisma.gathering.updateMany({ where: { organizationId: org.id, kind: "youth", ministryId: null }, data: { ministryId: youthId } });
  }

  // ── Eventos: áreas con plano, itinerario, material y boletos ──────────────────
  if ((await prisma.event.count({ where: { organizationId: org.id } })) === 0) {
    const { defaultVenueLayouts } = await import("../../src/lib/events/default-venues");
    const { randomBytes } = await import("node:crypto");
    if ((await prisma.venue.count({ where: { organizationId: org.id } })) === 0) {
      for (const [i, v] of defaultVenueLayouts().entries()) {
        await prisma.venue.create({
          data: { organizationId: org.id, name: v.name, description: v.description, kind: v.kind, planWidth: v.planWidth, planHeight: v.planHeight, layout: v.layout as object, sortOrder: i },
        });
      }
    }
    const venue = async (name: string) => prisma.venue.findFirst({ where: { organizationId: org.id, name } });
    const principal = await venue("Auditorio Principal");
    const menor = await venue("Auditorio Menor");
    const inDays = (d: number, hour: number) => {
      const t = new Date();
      t.setDate(t.getDate() + d);
      t.setHours(hour, 0, 0, 0);
      return t;
    };

    // 1) Taller para líderes: asientos del plano, solo líderes, con costo.
    const taller = await prisma.event.create({
      data: {
        organizationId: org.id,
        scope: "internal",
        kind: "Taller",
        name: "Taller de liderazgo",
        topic: "Pastoreo de células",
        description: "Un día de formación para líderes de célula y ministerio.",
        startsAt: inDays(12, 9),
        endsAt: inDays(12, 14),
        venueId: menor?.id ?? null,
        status: "published",
        price: 150,
        audience: "leaders",
        seating: "seats",
        seatSelection: "both",
      },
    });
    const clinic = await prisma.eventItineraryItem.create({
      data: { organizationId: org.id, eventId: taller.id, startsAt: inDays(12, 10), durationMin: 60, kind: "clinic", title: "Clínica: acompañar a un nuevo creyente", speakerName: "Pastor Principal" },
    });
    await prisma.eventItineraryItem.createMany({
      data: [
        { organizationId: org.id, eventId: taller.id, startsAt: inDays(12, 9), durationMin: 30, kind: "activity", title: "Bienvenida y oración" },
        { organizationId: org.id, eventId: taller.id, startsAt: inDays(12, 11), durationMin: 20, kind: "break", title: "Receso" },
      ],
    });
    await prisma.eventChecklistItem.createMany({
      data: [
        { organizationId: org.id, eventId: taller.id, itineraryId: clinic.id, title: "Guías impresas (30)" },
        { organizationId: org.id, eventId: taller.id, itineraryId: clinic.id, title: "Proyector y bocinas" },
        { organizationId: org.id, eventId: taller.id, title: "Gafetes y plumas", isDone: true },
      ],
    });
    const lupita = await memberByEmail("demo.celula@comuapp.test");
    const ana = await memberByEmail("demo.admin@comuapp.test");
    for (const [memberId, seatCode, paid] of [
      [lupita, "A-1", true],
      [ana, "A-2", false],
    ] as const) {
      if (!memberId) continue;
      const ticket = await prisma.eventTicket.create({
        data: { organizationId: org.id, eventId: taller.id, memberId, code: randomBytes(18).toString("base64url"), price: 150, seatCode, status: paid ? "paid" : "reserved" },
      });
      if (paid) await prisma.eventPayment.create({ data: { organizationId: org.id, ticketId: ticket.id, amount: 150, method: "cash" } });
    }

    // 2) Noche de jóvenes: dueño Jóvenes, por secciones con cupo, sin costo.
    const noche = await prisma.event.create({
      data: {
        organizationId: org.id,
        ministryId: youthId ?? null,
        scope: "internal",
        kind: "Otro",
        name: "Noche de jóvenes",
        topic: "Identidad y propósito",
        startsAt: inDays(5, 20),
        venueId: principal?.id ?? null,
        status: "published",
        price: 0,
        seating: "sections",
        sections: {
          create: [
            { organizationId: org.id, name: "General", capacity: 120, sortOrder: 0 },
            { organizationId: org.id, name: "Preferente", capacity: 30, sortOrder: 1 },
          ],
        },
      },
    });
    void noche;

    // 3) Tabernáculos: evento externo con cupo y cuota.
    await prisma.event.create({
      data: {
        organizationId: org.id,
        scope: "external",
        kind: "Tabernáculos",
        name: "Tabernáculos regional",
        topic: "Tiempo de adoración",
        location: "Centro de convenciones, Torreón",
        startsAt: inDays(30, 10),
        endsAt: inDays(32, 14),
        status: "published",
        price: 500,
        capacity: 40,
      },
    });
  }

  // ── Escuela ministerial: programas, libros, material, cuestionarios y un grupo ──
  if ((await prisma.course.count({ where: { organizationId: org.id } })) === 0) {
    const adminMember = await memberByEmail("demo.admin@comuapp.test");
    const lupitaId = await memberByEmail("demo.celula@comuapp.test");
    const sofiaMember = await memberByEmail("demo.secretaria@comuapp.test");
    const carlosMember = await memberByEmail("demo.creyente@comuapp.test");
    const pastorMember = await memberByEmail("demo.owner@comuapp.test");
    const ministry = await prisma.school.upsert({
      where: { organizationId_kind: { organizationId: org.id, kind: "ministry" } },
      update: { directorMemberId: adminMember ?? null, subdirectorMemberId: lupitaId ?? null },
      create: {
        organizationId: org.id,
        kind: "ministry",
        name: "Escuela de ministerio",
        description: "El proceso para formar líderes, libro por libro.",
        directorMemberId: adminMember ?? null,
        subdirectorMemberId: lupitaId ?? null,
        enrollmentFee: 200,
      },
    });
    const university = await prisma.school.upsert({
      where: { organizationId_kind: { organizationId: org.id, kind: "university" } },
      update: {},
      create: { organizationId: org.id, kind: "university", name: "Universidad Teológica", description: "Cursos de teología con el pastor o discípulos.", directorMemberId: pastorMember ?? null, enrollmentFee: 300 },
    });
    const books = ["¿Quién es Jesús?", "Identidad en Cristo", "Vida en el Espíritu", "Llamado y servicio"];
    const courses = [];
    for (const [i, name] of books.entries()) {
      courses.push(
        await prisma.course.create({
          data: {
            organizationId: org.id,
            schoolId: ministry.id,
            name,
            sortOrder: i + 1,
            description: i === 0 ? "El primer paso: conocer a Jesús y lo que hizo por nosotros." : null,
            bookPrice: 120,
            digitalBookUrl: i === 0 ? "https://example.com/libro-1.pdf" : null,
          },
        }),
      );
    }
    const first = courses[0];
    await prisma.courseContent.createMany({
      data: [
        { organizationId: org.id, courseId: first.id, week: 1, title: "Bienvenida al curso", type: "text", body: "En este libro conocerás quién es Jesús, por qué vino y qué cambió en la historia.\n\nLee con calma y subraya lo que más te hable." },
        { organizationId: org.id, courseId: first.id, week: 1, title: "Introducción (video)", type: "video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
        { organizationId: org.id, courseId: first.id, week: 2, title: "Lectura de la semana 2", type: "text", body: "Jesús nació, vivió y murió por nosotros; resucitó al tercer día." },
        { organizationId: org.id, courseId: first.id, week: 3, title: "Guía de estudio (PDF)", type: "pdf", url: "https://example.com/guia-3.pdf" },
      ],
    });
    const tarea = await prisma.assessment.create({
      data: { organizationId: org.id, courseId: first.id, kind: "task", number: 1, week: 1, title: "Conociendo a Jesús", instructions: "Responde con tus propias palabras donde se pida.", maxAttempts: 2, isPublished: true },
    });
    await prisma.question.createMany({
      data: [
        { organizationId: org.id, assessmentId: tarea.id, sortOrder: 0, type: "multiple_choice", prompt: "¿Dónde nació Jesús?", points: 1, config: { options: [{ text: "Nazaret" }, { text: "Belén" }, { text: "Jerusalén" }], correct: 1 } },
        { organizationId: org.id, assessmentId: tarea.id, sortOrder: 1, type: "multiple_select", prompt: "Elige los discípulos de Jesús", points: 2, config: { options: [{ text: "Pedro" }, { text: "Pilato" }, { text: "Juan" }, { text: "Herodes" }], correct: [0, 2] } },
        { organizationId: org.id, assessmentId: tarea.id, sortOrder: 2, type: "true_false", prompt: "Jesús resucitó al tercer día.", points: 1, config: { correct: true } },
        { organizationId: org.id, assessmentId: tarea.id, sortOrder: 3, type: "fill_blank", prompt: "Dios es ___ y Jesús es el ___ del mundo.", points: 2, config: { answers: [["amor"], ["Salvador", "Señor"]] } },
        { organizationId: org.id, assessmentId: tarea.id, sortOrder: 4, type: "matching", prompt: "Relaciona cada persona con su historia", points: 2, config: { pairs: [{ left: "Zaqueo", right: "Subió a un árbol" }, { left: "Lázaro", right: "Fue resucitado" }, { left: "Pedro", right: "Negó a Jesús" }] } },
        { organizationId: org.id, assessmentId: tarea.id, sortOrder: 5, type: "ordering", prompt: "Ordena estos hechos", points: 2, config: { items: ["Nació en Belén", "Fue bautizado", "Murió en la cruz", "Resucitó"] } },
        { organizationId: org.id, assessmentId: tarea.id, sortOrder: 6, type: "open", prompt: "¿Qué significa para ti que Jesús sea tu Salvador?", points: 4, config: {} },
      ],
    });
    const ejercicio = await prisma.assessment.create({
      data: { organizationId: org.id, courseId: first.id, kind: "exercise", number: 1, week: 1, title: "Reafirmación semana 1", maxAttempts: 3, timeLimitMin: 15, isPublished: true },
    });
    await prisma.question.createMany({
      data: [
        { organizationId: org.id, assessmentId: ejercicio.id, sortOrder: 0, type: "true_false", prompt: "Jesús es el único camino al Padre.", points: 1, config: { correct: true } },
        { organizationId: org.id, assessmentId: ejercicio.id, sortOrder: 1, type: "multiple_choice", prompt: "¿Quién bautizó a Jesús?", points: 1, config: { options: [{ text: "Juan el Bautista" }, { text: "Pedro" }, { text: "Pablo" }], correct: 0 } },
      ],
    });

    const day = (n: number) => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").getTime() - n * 86400000;
    const group = await prisma.courseGroup.create({
      data: {
        organizationId: org.id,
        courseId: first.id,
        name: "Grupo martes 7 pm",
        teacherMemberId: lupitaId ?? null,
        assistantMemberId: sofiaMember ?? null,
        startDate: new Date(day(14)),
        endDate: new Date(day(-42)),
        status: "open",
        capacity: 20,
      },
    });
    const byName = async (name: string) => (await prisma.member.findFirst({ where: { organizationId: org.id, fullName: name }, select: { id: true } }))?.id;
    const students: [string | undefined, "enrolled" | "requested"][] = [
      [carlosMember, "enrolled"],
      [await byName("Marta Ríos"), "enrolled"],
      [await byName("Jesús Herrera"), "enrolled"],
      [await byName("Elena Cárdenas"), "requested"],
    ];
    const enrollments = new Map<string, string>();
    for (const [memberId, status] of students) {
      if (!memberId) continue;
      const e = await prisma.enrollment.create({
        data: {
          organizationId: org.id,
          groupId: group.id,
          memberId,
          status,
          fee: 200,
          wantsBook: memberId === carlosMember,
          bookPrice: 120,
          enrolledAt: status === "enrolled" ? new Date(day(14)) : null,
        },
      });
      enrollments.set(memberId, e.id);
    }
    if (carlosMember && enrollments.get(carlosMember)) {
      await prisma.schoolPayment.create({ data: { organizationId: org.id, enrollmentId: enrollments.get(carlosMember)!, concept: "enrollment", amount: 200, method: "cash" } });
    }
    // Dos clases ya impartidas con su asistencia y una calificación capturada.
    for (const week of [1, 2]) {
      const session = await prisma.classSession.create({ data: { organizationId: org.id, groupId: group.id, week, date: new Date(day(14 - (week - 1) * 7)), topic: week === 1 ? "Bienvenida" : "Quién es Jesús" } });
      for (const [memberId, eid] of enrollments) {
        const enrolledOnly = students.find((x) => x[0] === memberId)?.[1] === "enrolled";
        if (!enrolledOnly) continue;
        await prisma.classAttendance.create({
          data: { organizationId: org.id, sessionId: session.id, enrollmentId: eid, status: week === 2 && memberId === (await byName("Jesús Herrera")) ? "absent" : "present" },
        });
      }
    }
    const marta = await byName("Marta Ríos");
    if (marta && enrollments.get(marta)) {
      await prisma.grade.create({ data: { organizationId: org.id, enrollmentId: enrollments.get(marta)!, assessmentId: tarea.id, value: 9, manual: true } });
      await prisma.enrollment.update({ where: { id: enrollments.get(marta)! }, data: { tasksAvg: 1.29, exercisesAvg: 0, finalGrade: 0.64, passed: false } });
    }

    // Universidad Teológica: un curso con grupo impartido por el pastor.
    const teologia = await prisma.course.create({
      data: { organizationId: org.id, schoolId: university.id, name: "Panorama del Antiguo Testamento", sortOrder: 1, weeks: 8, tasksCount: 4, exercisesCount: 4, enrollmentFee: 300, description: "Recorrido por los libros del Antiguo Testamento." },
    });
    await prisma.courseGroup.create({
      data: { organizationId: org.id, courseId: teologia.id, name: "Cohorte otoño", teacherMemberId: pastorMember ?? null, status: "planned", startDate: new Date(day(-10)), capacity: 15 },
    });
  }

  // ── Libro digital de ejemplo: un PDF de 8 páginas seccionado por clase ─────────
  {
    const first = await prisma.course.findFirst({ where: { organizationId: org.id, name: "¿Quién es Jesús?" }, select: { id: true } });
    if (first && (await prisma.courseDocument.count({ where: { courseId: first.id } })) === 0) {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { randomUUID } = await import("node:crypto");
      const path = await import("node:path");
      const { uploadsRoot } = await import("../../src/lib/uploads/storage");
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const chapters = [
        "Bienvenida: este libro te acompañará ocho semanas.",
        "Quién es Jesús: el Hijo de Dios hecho hombre.",
        "Su nacimiento y su infancia.",
        "Su ministerio: enseñó, sanó y perdonó.",
        "Su muerte en la cruz por nosotros.",
        "Su resurrección: la victoria sobre la muerte.",
        "Su regreso y nuestra esperanza.",
        "Tu respuesta: recibirlo como Señor y Salvador.",
      ];
      chapters.forEach((line, i) => {
        const page = pdf.addPage([420, 560]);
        page.drawText("¿Quién es Jesús?", { x: 36, y: 510, size: 20, font: bold, color: rgb(0.2, 0.2, 0.35) });
        page.drawText(`Capítulo ${i + 1}`, { x: 36, y: 480, size: 14, font: bold });
        page.drawText(line, { x: 36, y: 450, size: 12, font });
        for (let k = 0; k < 14; k++) {
          page.drawText("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.", { x: 36, y: 410 - k * 22, size: 10, font });
        }
        page.drawText(`— ${i + 1} —`, { x: 190, y: 24, size: 10, font });
      });
      const bytes = Buffer.from(await pdf.save());
      const fileName = `${randomUUID()}.pdf`;
      const dir = path.join(uploadsRoot(), org.id, "_docs");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, fileName), bytes);
      const doc = await prisma.courseDocument.create({
        data: { organizationId: org.id, courseId: first.id, title: "Libro digital: ¿Quién es Jesús?", kind: "pdf", fileName, mime: "application/pdf", size: bytes.length, pageCount: 8 },
      });
      await prisma.documentSection.createMany({
        data: [
          { organizationId: org.id, documentId: doc.id, week: 1, title: "Bienvenida", fromPage: 1, toPage: 1 },
          { organizationId: org.id, documentId: doc.id, week: 2, title: "Quién es Jesús", fromPage: 2, toPage: 3 },
          { organizationId: org.id, documentId: doc.id, week: 3, title: "Su ministerio", fromPage: 4, toPage: 5 },
          { organizationId: org.id, documentId: doc.id, week: 4, title: "Cruz y resurrección", fromPage: 6, toPage: 8 },
        ],
      });
    }
  }

  // ── Finanzas: cortes, gastos, un donativo por confirmar, vehículos y nómina ─────
  if ((await prisma.income.count({ where: { organizationId: org.id } })) === 0) {
    const recent = await prisma.gathering.findMany({ where: { organizationId: org.id, kind: "general" }, orderBy: { date: "desc" }, take: 4 });
    for (const [i, g] of recent.entries()) {
      await prisma.income.createMany({
        data: [
          { organizationId: org.id, kind: "tithe", source: "cash_cut", amount: 6800 + i * 350, receivedAt: g.date, gatheringId: g.id },
          { organizationId: org.id, kind: "offering", source: "cash_cut", amount: 2100 + i * 120, receivedAt: g.date, gatheringId: g.id },
        ],
      });
    }
    const now = new Date();
    const day = (n: number) => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").getTime() - n * 86400000;
    await prisma.income.create({ data: { organizationId: org.id, kind: "donation", source: "transfer", amount: 1500, receivedAt: new Date(day(3)), concept: "Donativo de familia", reference: "SPEI-4821" } });
    await prisma.expense.createMany({
      data: [
        { organizationId: org.id, category: "renta", concept: "Renta del local", amount: 12000, spentAt: new Date(day(6)), vendor: "Inmobiliaria Torreón" },
        { organizationId: org.id, category: "servicios", concept: "Luz y agua", amount: 2350.5, spentAt: new Date(day(4)) },
        { organizationId: org.id, category: "material", concept: "Papelería y artículos de limpieza", amount: 780, spentAt: new Date(day(2)) },
      ],
    });
    const carlosM = await memberByEmail("demo.creyente@comuapp.test");
    if (carlosM) {
      await prisma.donation.create({ data: { organizationId: org.id, memberId: carlosM, amount: 500, kind: "tithe", reference: "SPEI-9917", notes: "Diezmo de la quincena" } });
    }
    // Empleada con sueldo para que la nómina de ejemplo tenga renglones.
    await prisma.employee.updateMany({ where: { organizationId: org.id, salaryAmount: 0 }, data: { salaryAmount: 4500, salaryType: "monthly", paymentFrequency: "biweekly" } });

    const van = await prisma.vehicle.create({ data: { organizationId: org.id, name: "Camioneta blanca", plate: "TRN-123-A", make: "Toyota", model: "Hiace", year: 2019, kind: "van", capacity: 14, odometer: 84250 } });
    const car = await prisma.vehicle.create({ data: { organizationId: org.id, name: "Sedán administrativo", plate: "TRN-456-B", make: "Nissan", model: "Versa", year: 2021, kind: "auto", capacity: 5, odometer: 41300 } });
    await prisma.vehicleDocument.createMany({
      data: [
        { organizationId: org.id, vehicleId: van.id, kind: "insurance", number: "POL-778812", provider: "Seguros Laguna", issuedAt: new Date(day(340)), expiresAt: new Date(day(-15)), cost: 8900 },
        { organizationId: org.id, vehicleId: van.id, kind: "verification", provider: "Centro de verificación", issuedAt: new Date(day(200)), expiresAt: new Date(day(5)) },
        { organizationId: org.id, vehicleId: car.id, kind: "insurance", number: "POL-110233", provider: "Seguros Laguna", issuedAt: new Date(day(100)), expiresAt: new Date(day(-265)), cost: 5400 },
      ],
    });
    await prisma.vehicleService.create({
      data: { organizationId: org.id, vehicleId: van.id, kind: "service", date: new Date(day(60)), description: "Cambio de aceite y filtros", vendor: "Taller El Pino", cost: 1850, odometer: 80100, nextDueOdometer: 84500 },
    });
    await prisma.vehicleFuel.createMany({
      data: [
        { organizationId: org.id, vehicleId: van.id, date: new Date(day(21)), liters: 42, cost: 1020, odometer: 83100, station: "Gasolinera Centro" },
        { organizationId: org.id, vehicleId: van.id, date: new Date(day(7)), liters: 38, cost: 940, odometer: 83760, station: "Gasolinera Centro" },
      ],
    });
    await prisma.vehicleLog.create({ data: { organizationId: org.id, vehicleId: van.id, date: new Date(day(8)), driverName: "Samuel Quiroz", purpose: "Traslado a retiro de jóvenes", destination: "Campamento Los Pinos", odometerStart: 83300, odometerEnd: 83540 } });
    void now;
  }

  // ── Portal: publicaciones y transmisiones de ejemplo ────────────────────────────
  if ((await prisma.post.count({ where: { organizationId: org.id } })) === 0) {
    const ago = (days: number) => new Date(Date.now() - days * 86400000);
    await prisma.post.createMany({
      data: [
        {
          organizationId: org.id,
          kind: "announcement",
          title: "Encuentro con Jesús: ya hay lugares",
          body: "Abrimos el registro para el próximo Encuentro con Jesús. Aparta tu lugar desde Eventos y avisa a quien quieras invitar.",
          pinned: true,
          publishedAt: ago(1),
        },
        {
          organizationId: org.id,
          kind: "devotional",
          title: "Descansar en su fidelidad",
          body: "«Grande es tu fidelidad». Esta semana te invitamos a anotar cada mañana una muestra concreta de la fidelidad de Dios en tu vida.",
          publishedAt: ago(3),
        },
        {
          organizationId: org.id,
          kind: "news",
          title: "Nueva célula en la colonia Centro",
          body: "Comienza una nueva célula los miércoles. Si vives cerca, búscala en Mis células o pregunta a tu líder.",
          publishedAt: ago(6),
        },
        {
          organizationId: org.id,
          kind: "announcement",
          title: "Reunión solo para líderes",
          body: "Capacitación de liderazgo el próximo sábado. Esta publicación solo la ven los líderes.",
          audience: "leaders",
          publishedAt: ago(2),
        },
      ],
    });
    await prisma.stream.createMany({
      data: [
        {
          organizationId: org.id,
          title: "Servicio del domingo",
          description: "Transmisión en vivo del servicio general.",
          platform: "youtube",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          scheduledAt: new Date(Date.now() + 3 * 86400000),
          status: "scheduled",
        },
        {
          organizationId: org.id,
          title: "Servicio anterior",
          platform: "youtube",
          url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
          scheduledAt: new Date(Date.now() - 4 * 86400000),
          status: "ended",
        },
      ],
    });
  }

  console.log(`ℹ️  Demo: ${USERS.length} usuarios (correo demo.*@comuapp.test, contraseña = DEMO_PASSWORD) en «${ORG_NAME}» (con ministerios de ejemplo).`)
}
