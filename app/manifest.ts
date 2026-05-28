import type { MetadataRoute } from "next"

// PWA manifest — makes the CRM installable on mobile and desktop.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Veloce CRM",
    short_name: "Veloce",
    description: "CRM de Veloce — bandeja, agenda, taller y ventas",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
