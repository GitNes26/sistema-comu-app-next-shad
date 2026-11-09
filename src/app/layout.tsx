import type { Metadata, Viewport } from "next";
import { getChurchBrand } from "@/lib/brand/server";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/providers";
import { HttpErrorToast } from "@/components/api/http-error-toast";
import { SplashScreen } from "@/components/shared/splash-screen"
import { PwaLinkGuard } from "@/components/shared/pwa-link-guard"

// Tipografías del sistema: Montserrat (títulos), Afacad (subtítulos),
// Poppins (cuerpo) y Space Mono (cifras, códigos y folios).
const montserrat = localFont({
  variable: "--font-montserrat",
  src: [
    { path: "../../assets/fonts/Montserrat-Variable.woff2", style: "normal" },
    { path: "../../assets/fonts/Montserrat-Italic.woff2", style: "italic" },
  ],
  weight: "100 900",
  display: "swap",
});

const afacad = localFont({
  variable: "--font-afacad",
  src: [
    { path: "../../assets/fonts/Afacad-Variable.woff2", style: "normal" },
    { path: "../../assets/fonts/Afacad-Italic.woff2", style: "italic" },
  ],
  weight: "400 700",
  display: "swap",
});

const poppins = localFont({
  variable: "--font-poppins",
  src: [
    { path: "../../assets/fonts/Poppins-Variable.woff2", style: "normal" },
    { path: "../../assets/fonts/Poppins-Italic.woff2", style: "italic" },
  ],
  weight: "100 900",
  display: "swap",
});

const spaceMono = localFont({
  variable: "--font-space-mono",
  src: [
    { path: "../../assets/fonts/SpaceMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../assets/fonts/SpaceMono-Italic.woff2", weight: "400", style: "italic" },
    { path: "../../assets/fonts/SpaceMono-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../assets/fonts/SpaceMono-BoldItalic.woff2", weight: "700", style: "italic" },
  ],
  display: "swap",
});

// Ícono de la pestaña: si la iglesia cargó su logo, ese; si no, el de marca según el tema del
// navegador o del sistema. Convención: «icon» (claro) para tema oscuro y «icon_dark» (oscuro)
// para tema claro. /favicon.ico (public) cubre navegadores y bots que lo piden directo.
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getChurchBrand();
  return {
    title: {
      default: "COMU-APP",
      template: "%s | COMU-APP",
    },
    description: "COMU-APP: gestión integral de la iglesia, ministerios, células, escuela y crecimiento personal.",
    applicationName: "COMU-APP",
    icons: brand.logoUrl
      ? { icon: "/brand-icon", apple: "/brand-icon" }
      : {
          icon: [
            { url: "/icons/icon_dark.ico", type: "image/x-icon", media: "(prefers-color-scheme: light)" },
            { url: "/icons/icon.ico", type: "image/x-icon", media: "(prefers-color-scheme: dark)" },
            { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32", media: "(prefers-color-scheme: light)" },
            { url: "/icons/favicon-32-dark.png", type: "image/png", sizes: "32x32", media: "(prefers-color-scheme: dark)" },
          ],
          shortcut: "/favicon.ico",
          apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
        },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f172a" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const brand = await getChurchBrand();
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${montserrat.variable} ${afacad.variable} ${poppins.variable} ${spaceMono.variable}`}
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        {/* Prevent white flash on PWA cold start */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var c="#0f172a";if(window.matchMedia&&window.matchMedia("(prefers-color-scheme:dark)").matches)c="#0a0a0a";document.documentElement.style.background=c;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",c)})()`,
          }}
        />
        <Providers>
          <SplashScreen logoUrl={brand.logoUrl} name={brand.name} />
          <PwaLinkGuard />
          <HttpErrorToast />
          {children}
        </Providers>
        {/* El service worker (push + caché) solo corre en builds de producción:
          en dev estorba con respuestas cacheadas viejas y jobs de push falsos. */}
        {process.env.NODE_ENV === "production" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
            }}
          />
        )}
      </body>
    </html>
  );
}
