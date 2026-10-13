import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Next regenera AGENTS.md con su bloque genérico; las reglas del proyecto viven en nuestro AGENTS.md.
  agentRules: false,
  // sharp usa binarios nativos: se mantiene fuera del empaquetado.
  serverExternalPackages: ["sharp"],
  // En Windows, antivirus o extensiones que vigilan la carpeta pueden bloquear los archivos que
  // Turbopack reescribe (EPERM en .next/dev). NEXT_DEV_FS_CACHE=off apaga su caché en disco.
  experimental: { turbopackFileSystemCacheForDev: process.env.NEXT_DEV_FS_CACHE !== "off" },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
    ],
  },
  async rewrites() {
    // Los registros anteriores guardaron /uploads/...; en standalone los archivos
    // agregados después del build se sirven de forma fiable por la ruta dinámica.
    return [{ source: "/uploads/:organizationId/:fileName", destination: "/api/media/:organizationId/:fileName" }]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        source: "/api/sse/:path*",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-transform" },
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
    ]
  },
}

export default nextConfig
