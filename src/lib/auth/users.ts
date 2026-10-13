import bcrypt from "bcryptjs";
import { createHash, createHmac } from "node:crypto";
import { prisma } from "@/lib/db";
import { $Enums } from "@/generated/prisma/client";

// Utilidades de credenciales y creación de cuentas de acceso.

const BCRYPT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

function requireAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET no está configurado");
  return secret;
}

export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

type NewUserInput = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  isActive?: boolean;
};

/**
 * Crea (o reutiliza por correo) la cuenta de acceso de un creyente y la liga a su
 * registro (Member.userId). El creyente existe con o sin usuario: esta función solo
 * agrega la cuenta. Devuelve el usuario y el creyente actualizado.
 */
export async function createMemberUser({
  organizationId,
  memberId,
  ...user
}: NewUserInput & {
  organizationId: string;
  memberId: string;
}) {
  const member = await prisma.member.findFirst({ where: { id: memberId, organizationId } });
  if (!member) throw new Error("Creyente no encontrado en esta iglesia");
  const passwordHash = await hashPassword(user.password);
  const dbUser = await prisma.user.upsert({
    where: { email: user.email },
    update: { fullName: user.fullName, phone: user.phone, isActive: user.isActive ?? true },
    create: {
      email: user.email,
      passwordHash,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive ?? true,
    },
  });
  const updated = await prisma.member.update({
    where: { id: member.id },
    data: { userId: dbUser.id },
  });
  return { user: dbUser, member: updated };
}

/** Asigna (upsert) la membresía de un usuario a la organización. */
export async function setMembership(
  userId: string,
  organizationId: string,
  role: $Enums.OrgRole
) {
  return prisma.membership.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    update: { role },
    create: { userId, organizationId, role },
  });
}

/** Cambio de contraseña (FASE 2.13). Verifica la anterior y actualiza. */
export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Usuario no encontrado" };

  const valid = await verifyPassword(oldPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "La contraseña actual es incorrecta" };
  const codeHash = createHash("sha256").update(code.trim()).digest("hex");
  if (!user.passwordChangeCodeHash || user.passwordChangeCodeHash !== codeHash || !user.passwordChangeCodeExpires || user.passwordChangeCodeExpires < new Date())
    return { ok: false, error: "El código es inválido o expiró" };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), passwordChangeCodeHash: null, passwordChangeCodeExpires: null, authVersion: { increment: 1 } },
  });
  return { ok: true };
}

/** Genera y guarda un token de reset (guardado hasheado con SHA-256). */
export async function issuePasswordResetToken(
  email: string
): Promise<{ token?: string; sent: boolean }> {
  const user = await prisma.user.findUnique({ where: { email: normalizeIdentifier(email) } });
  if (!user || !user.isActive) return { sent: false };

  // El token se deriva (HMAC) del usuario y su vencimiento: pedir el enlace varias veces
  // (doble clic, reintento, «olvidé mi contraseña») entrega SIEMPRE el mismo enlace válido, en
  // lugar de invalidar el del correo anterior.
  const derive = (expiresMs: number) =>
    createHmac("sha256", requireAuthSecret())
      .update(`${user.id}:${expiresMs}`)
      .digest("hex");
  const now = Date.now();
  if (user.passwordResetToken && user.passwordResetExpires && user.passwordResetExpires.getTime() > now + 2 * 60 * 1000) {
    const current = derive(user.passwordResetExpires.getTime());
    if (createHash("sha256").update(current).digest("hex") === user.passwordResetToken) return { token: current, sent: true };
  }
  const expires = new Date(now + 60 * 60 * 1000); // 1 hora
  const token = derive(expires.getTime());
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: tokenHash, passwordResetExpires: expires },
  });

  return { token, sent: true };
}

/** Aplica un token de reset: resetea la contraseña si es válido. */
export async function applyPasswordResetToken(
  token: string,
  newPassword: string,
  acceptedLegal = false
): Promise<{ ok: boolean; error?: string }> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findUnique({ where: { passwordResetToken: tokenHash } });
  if (!user) return { ok: false, error: "Enlace inválido" };
  if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    return { ok: false, error: "El enlace expiró. Solicita uno nuevo." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      emailVerified: user.emailVerified ?? new Date(),
      activationRequired: false,
      ...(acceptedLegal ? { legalAcceptedAt: new Date(), legalVersion: "2026-09-25" } : {}),
      passwordResetToken: null,
      passwordResetExpires: null,
      authVersion: { increment: 1 },
    },
  });
  return { ok: true };
}

export async function issuePasswordChangeCode(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true } });
  if (!user?.isActive) return null;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordChangeCodeHash: createHash("sha256").update(code).digest("hex"),
      passwordChangeCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return { email: user.email, code };
}
