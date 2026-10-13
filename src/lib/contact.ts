// Contacto de soporte de la plataforma (para pedir cambio de plan, etc.).
// WhatsApp si hay número configurado; si no, correo de contacto.

export function supportUrl(subject?: string): string {
  const whatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "")
  const text = subject ?? "Hola, necesito ayuda con COMU-APP"
  if (whatsapp) return `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? process.env.LEGAL_CONTACT_EMAIL ?? ""
  return `mailto:${email}?subject=${encodeURIComponent(text)}`
}

export function planSupportUrl(plan: { name: string }): string {
  return supportUrl(`Hola, me interesa el plan ${plan.name} de COMU-APP`)
}
