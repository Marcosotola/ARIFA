import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ARIFA | Seguridad e Higiene Laboral",
    short_name: "ARIFA",
    description:
      "Servicios integrales de seguridad e higiene laboral, protección contra incendios y capacitación.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1628",
    theme_color: "#1a3a6b",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/logos/192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logos/192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/logos/180x180.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [],
    prefer_related_applications: false,
  };
}
