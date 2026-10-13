import { FileCheck2, ShieldCheck } from "lucide-react";
import { LegalShell } from "@/components/legal/legal-shell";

export const LEGAL_VERSION = "2026-10-12";
const LEGAL_VALUES: Record<string, string> = {
  LEGAL_ENTITY_NAME: process.env.LEGAL_ENTITY_NAME ?? "el proveedor de COMU-APP",
  LEGAL_ADDRESS: process.env.LEGAL_ADDRESS ?? "el domicilio informado por el proveedor",
  LEGAL_CONTACT_EMAIL: process.env.LEGAL_CONTACT_EMAIL ?? "el correo de contacto publicado en el sistema",
  PRIVACY_CONTACT_EMAIL: process.env.PRIVACY_CONTACT_EMAIL ?? process.env.LEGAL_CONTACT_EMAIL ?? "el correo de privacidad publicado en el sistema",
};
const resolveLegalText = (value: string) =>
  Object.entries(LEGAL_VALUES).reduce((text, [token, replacement]) => text.replaceAll(token, replacement), value);

export type LegalDocumentKey = "terminos" | "privacidad" | "cookies";
type Section = { title: string; paragraphs: string[]; bullets?: string[] };

// Base operativa: debe completarse con los datos reales de la iglesia y someterse a
// revisión profesional antes de operar con datos de personas, en especial menores.
export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, { title: string; summary: string; sections: Section[] }> = {
  terminos: {
    title: "Términos de uso de COMU-APP",
    summary: "Reglas generales para utilizar el panel administrativo y el espacio personal de la iglesia.",
    sections: [
      {
        title: "1. Identificación y alcance",
        paragraphs: [
          "Estos términos regulan el uso de COMU-APP por pastores, líderes, servidores, personal administrativo y creyentes. El proveedor de la plataforma se identifica mediante LEGAL_ENTITY_NAME y LEGAL_ADDRESS. Cada iglesia conserva la responsabilidad sobre la información que registra de sus miembros y sobre sus actividades.",
        ],
      },
      {
        title: "2. Cuenta y seguridad",
        paragraphs: [
          "La cuenta es personal. La persona usuaria debe proporcionar información correcta, proteger sus credenciales y avisar de inmediato sobre accesos no autorizados.",
        ],
        bullets: [
          "No compartir contraseñas.",
          "Mantener actualizados correo y teléfono.",
          "Los permisos se asignan según la responsabilidad que se ejerce en la iglesia.",
          "Cerrar sesión en dispositivos compartidos.",
        ],
      },
      {
        title: "3. Uso permitido",
        paragraphs: [
          "COMU-APP debe utilizarse para la gestión de la iglesia y el acompañamiento de sus miembros. Quedan prohibidos el acceso no autorizado, el uso de la información de otras personas para fines ajenos a la iglesia, la interferencia con el servicio y la carga de contenido malicioso.",
        ],
      },
      {
        title: "4. Contacto",
        paragraphs: ["Para dudas o aclaraciones escribe a LEGAL_CONTACT_EMAIL."],
      },
    ],
  },
  privacidad: {
    title: "Aviso de privacidad integral",
    summary: "Cómo se obtienen, utilizan, protegen y comparten los datos personales dentro de COMU-APP.",
    sections: [
      {
        title: "1. Responsable",
        paragraphs: [
          "El responsable de los datos de cada creyente es la iglesia que los registra. El proveedor de COMU-APP actúa como encargado de la plataforma por cuenta de la iglesia. Para ejercer tus derechos escribe a PRIVACY_CONTACT_EMAIL.",
        ],
      },
      {
        title: "2. Datos tratados",
        paragraphs: [
          "Según las funciones utilizadas pueden tratarse datos de identificación, contacto, domicilio, ocupación, asistencia, participación en ministerios, células y escuela, aportaciones y datos técnicos de sesión. Algunos datos, como la etapa de crecimiento espiritual o los bautismos, se relacionan con las creencias religiosas y se consideran sensibles: solo se registran con tu conocimiento y para el seguimiento pastoral.",
        ],
      },
      {
        title: "3. Menores de edad",
        paragraphs: [
          "Los datos de niñas, niños y adolescentes se registran únicamente por su madre, padre o tutor, quienes pueden consultarlos, corregirlos o solicitar su eliminación. El acceso a esa información se limita a quienes cuidan de ellos en la actividad correspondiente.",
        ],
      },
      {
        title: "4. Finalidades",
        paragraphs: [
          "Los datos se usan para dar seguimiento y acompañamiento, organizar ministerios, células, eventos y la escuela, administrar la iglesia y comunicarte avisos. No se venden ni se comparten con terceros ajenos a la iglesia, salvo obligación legal.",
        ],
      },
      {
        title: "5. Derechos ARCO y revocación",
        paragraphs: [
          "Puedes solicitar acceso, rectificación, cancelación u oposición, así como revocar tu consentimiento, escribiendo a PRIVACY_CONTACT_EMAIL con tu nombre, medio de respuesta y el derecho que deseas ejercer. Se podrá solicitar acreditación de identidad.",
        ],
      },
      {
        title: "6. Seguridad",
        paragraphs: [
          "Se aplican controles de acceso por rol y permisos, aislamiento de la información de cada iglesia y cifrado de contraseñas. Ningún sistema es infalible: si detectas un uso indebido, avísanos de inmediato.",
        ],
      },
    ],
  },
  cookies: {
    title: "Política de cookies y almacenamiento local",
    summary: "Qué tecnologías del navegador usa COMU-APP y para qué.",
    sections: [
      {
        title: "1. Tecnologías utilizadas",
        paragraphs: [
          "COMU-APP utiliza cookies de sesión y almacenamiento del navegador para autenticar, proteger formularios y recordar tu iglesia, apariencia y preferencias del dispositivo. También puede usar un service worker para funciones instalables y notificaciones.",
        ],
      },
      {
        title: "2. Finalidad",
        paragraphs: [
          "Estas tecnologías permiten mantener la sesión, aplicar seguridad y conservar configuraciones. No se usan para publicidad.",
        ],
      },
      {
        title: "3. Control",
        paragraphs: [
          "Puedes bloquear o borrar cookies desde el navegador, aunque la autenticación y ciertas preferencias dejarán de funcionar. Los permisos de ubicación y notificaciones se controlan desde el navegador o el dispositivo.",
        ],
      },
    ],
  },
};

export function LegalDocument({ document }: { document: LegalDocumentKey }) {
  const data = LEGAL_DOCUMENTS[document];
  return (
    <LegalShell backHref="/legal" backLabel="Centro legal">
      <article className="mx-auto max-w-3xl animate-rise-in overflow-hidden rounded-3xl border bg-background">
        <header className="border-b bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-10">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {document === "privacidad" ? <ShieldCheck /> : <FileCheck2 />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{data.title}</h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">{data.summary}</p>
          <p className="mt-4 text-xs text-muted-foreground">Versión {LEGAL_VERSION}</p>
        </header>
        <div className="space-y-8 p-6 sm:p-10">
          {data.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                {section.paragraphs.map((p) => (
                  <p key={p}>{resolveLegalText(p)}</p>
                ))}
                {section.bullets && (
                  <ul className="list-disc space-y-1 pl-5">
                    {section.bullets.map((b) => (
                      <li key={b}>{resolveLegalText(b)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </article>
    </LegalShell>
  );
}
