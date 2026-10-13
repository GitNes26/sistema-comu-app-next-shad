import nodemailer from "nodemailer";
import { issuePasswordResetToken } from "@/lib/auth/users";
import { prisma } from "@/lib/db";

export interface WelcomeMailContext {
  fullName?: string | null;
  /** Nombre visible de la iglesia en el encabezado del correo. */
  churchName?: string | null;
  logoUrl?: string | null;
  primaryHue?: number;
  accentHue?: number;
  /** Lo que la persona podrá hacer con su cuenta (chips en el correo de bienvenida). */
  capabilities?: string[];
}

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.NEXTAUTH_URL);
}

function appUrl(path: string) {
  const base = process.env.NEXTAUTH_URL;
  if (!base) throw new Error("NEXTAUTH_URL no está configurada");
  return new URL(path, base).toString();
}

function resetUrl(token: string) {
  const url = new URL(appUrl("/auth/reset"));
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function transport() {
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT inválido");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 10000,
  });
}

function mailFrom(churchName?: string | null) {
  const configured = process.env.SMTP_FROM?.trim() ?? "";
  const bracket = configured.match(/<([^>]+)>/);
  const address = (bracket?.[1] ?? configured).trim();
  const safeName = (churchName?.trim() || "COMU-APP").replace(/[\r\n"]/g, " ");
  return `"${safeName}" <${address}>`;
}

/** Iglesia con la que se asocia un correo (la de su primera membresía). */
async function mailChurchContext(email: string): Promise<WelcomeMailContext | undefined> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { memberships: { take: 1, orderBy: { createdAt: "asc" }, select: { organizationId: true } } },
  });
  const organizationId = user?.memberships[0]?.organizationId;
  if (!organizationId) return undefined;
  const [organization, company] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.companyProfile.findUnique({ where: { organizationId }, select: { tradeName: true, legalName: true } }),
  ]);
  return { churchName: company?.tradeName ?? company?.legalName ?? organization?.name };
}

function emailShell(title: string, content: string, context?: WelcomeMailContext) {
  const primary = `hsl(${context?.primaryHue ?? 24} 80% 42%)`;
  const accent = `hsl(${context?.accentHue ?? 190} 65% 38%)`;
  const brand = escapeHtml(context?.churchName ?? "COMU-APP");
  const logo = context?.logoUrl
    ? `<img src="${escapeHtml(context.logoUrl)}" alt="${brand}" style="display:block;max-height:48px;max-width:180px;margin-bottom:14px" />`
    : "";
  return `<div style="background:#f4f6f8;padding:32px 12px;font-family:Arial,sans-serif;color:#20242b"><div style="max-width:580px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden"><div style="height:7px;background:linear-gradient(90deg,${primary},${accent})"></div><div style="padding:24px 30px;background:#f8fafc">${logo}<div style="color:${primary};font-size:19px;font-weight:800">${brand}</div></div><div style="padding:30px"><h1 style="font-size:24px;margin:0 0 16px">${title}</h1>${content}</div></div><p style="text-align:center;color:#6b7280;font-size:12px">Mensaje automático de seguridad · No respondas este correo.</p></div>`;
}

export async function sendPasswordLink(email: string, token: string, kind: "welcome" | "reset", context?: WelcomeMailContext) {
  if (!mailConfigured()) throw new Error("Correo SMTP no configurado");
  const url = resetUrl(token);
  const title = kind === "welcome" ? "Bienvenido: crea tu contraseña" : "Restablece tu contraseña";
  const intro =
    kind === "welcome"
      ? "Tu cuenta ya está registrada. Crea tu contraseña para comenzar."
      : "Recibimos una solicitud para cambiar tu contraseña.";
  const loginUrl = appUrl("/auth/login");
  const identity =
    kind === "welcome"
      ? `<div style="margin:20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc"><div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Datos de acceso</div><p style="margin:10px 0 4px"><strong>Usuario:</strong> ${escapeHtml(email)}</p></div>`
      : "";
  const capabilities = context?.capabilities?.length
    ? `<p style="margin:20px 0 10px;font-weight:700">Desde tu espacio podrás:</p><div>${context.capabilities
        .map((item) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:7px 10px;border-radius:999px;background:#f1f5f9;font-size:13px">${escapeHtml(item)}</span>`)
        .join("")}</div>`
    : "";
  await transport().sendMail({
    from: mailFrom(context?.churchName),
    to: email,
    subject: `${title} · ${context?.churchName ?? "COMU-APP"}`,
    text: `${context?.fullName ? `Hola ${context.fullName}.\n\n` : ""}${intro}\nUsuario: ${email}\n\nEnlace de un solo uso (vence en 1 hora):\n${url}\n\nDespués podrás entrar en: ${loginUrl}\n\nSi no esperabas este correo, ignóralo.`,
    html: emailShell(
      title,
      `<p style="line-height:1.6">${context?.fullName ? `Hola <strong>${escapeHtml(context.fullName)}</strong>, ` : ""}${intro}</p>${capabilities}${identity}<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;background:hsl(${context?.primaryHue ?? 24} 80% 42%);color:white;text-decoration:none;border-radius:11px;font-weight:700">Confirmar mi cuenta</a></p><p style="font-size:13px;color:#626b76;line-height:1.5">Este enlace de un solo uso vence en 1 hora. Después podrás iniciar sesión en <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a>.</p>`,
      context
    ),
  });
}

export async function sendPasswordChangeCode(email: string, code: string) {
  if (!mailConfigured()) throw new Error("Correo SMTP no configurado");
  const context = await mailChurchContext(email);
  await transport().sendMail({
    from: mailFrom(context?.churchName),
    to: email,
    subject: `Código para cambiar tu contraseña · ${context?.churchName ?? "COMU-APP"}`,
    text: `Tu código de verificación es ${code}. Vence en 10 minutos.`,
    html: emailShell(
      "Confirma que eres tú",
      `<p>Usa este código para autorizar el cambio de contraseña:</p><div style="font-size:30px;letter-spacing:8px;font-weight:700;text-align:center;background:#f3f4f6;border-radius:12px;padding:18px;margin:20px 0">${escapeHtml(code)}</div><p style="font-size:13px;color:#626b76">Vence en 10 minutos. Si no lo solicitaste, conserva tu contraseña actual.</p>`,
      context
    ),
  });
}

export async function sendWelcomeLink(email: string, context?: WelcomeMailContext) {
  const result = await issuePasswordResetToken(email);
  if (!result.token) throw new Error("No se pudo crear el enlace de acceso");
  await sendPasswordLink(email, result.token, "welcome", context);
}

/** Bienvenida con la marca de la iglesia (nombre, logo y colores de su apariencia). */
export async function sendOrganizationWelcomeLink(email: string, organizationId: string, context: WelcomeMailContext = {}) {
  const [organization, company, settings] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.companyProfile.findUnique({ where: { organizationId }, select: { tradeName: true, legalName: true, logoUrl: true } }),
    prisma.appSettings.findUnique({ where: { organizationId }, select: { primaryHue: true, accentHue: true } }),
  ]);
  return sendWelcomeLink(email, {
    capabilities: ["Ver tu crecimiento", "Conocer tus ministerios", "Ver contenido y avisos"],
    ...context,
    churchName: company?.tradeName ?? company?.legalName ?? organization?.name,
    logoUrl: company?.logoUrl
      ? company.logoUrl.startsWith("http")
        ? company.logoUrl
        : new URL(company.logoUrl, process.env.NEXTAUTH_URL).toString()
      : null,
    primaryHue: settings?.primaryHue,
    accentHue: settings?.accentHue,
  });
}

/** Correo de la iglesia (p. ej. recibo) con el diseño de su marca. */
export async function sendChurchMail(to: string, subject: string, title: string, contentHtml: string, churchName?: string | null) {
  if (!mailConfigured()) throw new Error("El correo no está configurado en el servidor (SMTP)");
  const html = emailShell(escapeHtml(title), contentHtml, { churchName }).replace(
    "Mensaje automático de seguridad · No respondas este correo.",
    "Mensaje automático · Guarda este correo como comprobante."
  );
  await transport().sendMail({ from: mailFrom(churchName), to, subject, html });
}

/** Reporte programado: correo con la marca de la iglesia y el PDF (y CSV) adjuntos. */
export async function sendReportMail(input: {
  to: string[]
  churchName?: string | null
  subject: string
  title: string
  html: string
  attachments: { filename: string; content: Buffer; contentType: string }[]
}) {
  if (!mailConfigured()) throw new Error("El correo no está configurado en el servidor (SMTP)")
  const html = emailShell(escapeHtml(input.title), input.html, { churchName: input.churchName }).replace(
    "Mensaje automático de seguridad · No respondas este correo.",
    "Reporte programado · Mensaje automático, no respondas este correo."
  )
  await transport().sendMail({
    from: mailFrom(input.churchName),
    // Cada destinatario recibe su propio mensaje: nadie ve los correos de los demás.
    bcc: input.to,
    to: mailFrom(input.churchName),
    subject: input.subject,
    html,
    attachments: input.attachments,
  })
}
