import type { MetadataRoute } from "next";

// Manifest PWA (instalable).

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "COMU-APP",
    short_name: "COMU-APP",
    description: "Gestión integral de la iglesia: ministerios, células, escuela y crecimiento personal.",
    lang: "es",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    // Chrome: un enlace a la app abre su ventana ya instalada en lugar del navegador.
    ...({ launch_handler: { client_mode: ["navigate-existing", "auto"] } } as object),
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      { src: "/brand-icon", sizes: "192x192", type: "image/png" },
      { src: "/brand-icon", sizes: "512x512", type: "image/png" },
      { src: "/brand-icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
