import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

// Páginas que el service worker descarga para que la app funcione sin conexión. Se arma solo a
// partir de src/app, así una página nueva queda incluida sin tocar nada.
// Las rutas /admin con [id] se guardan una sola vez como molde (/admin/certificados/_offline) que
// sirve para cualquier id (ver src/hooks/useIdRuta.ts). Las páginas públicas con [id] se guardan
// recién cuando se visitan.
function rutasOffline() {
  const rutas: string[] = [];
  const moldes: { patron: string; url: string }[] = [];
  const recorrer = (dir: string, segmentos: string[]) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entrada.isDirectory()) {
        if (entrada.name !== "page.tsx") continue;
        const ruta = "/" + segmentos.filter(s => !/^\(.*\)$/.test(s)).join("/");
        if (!ruta.includes("[")) rutas.push(ruta);
        else if (ruta.startsWith("/admin/")) {
          const patron = ruta.split("/").map(s => (s.startsWith("[") ? "[^/]+" : s.replace(/[.*+?^${}()|\\]/g, "\\$&"))).join("/");
          moldes.push({ patron: `^${patron}/?$`, url: ruta.replace(/\[[^\]]+\]/g, "_offline") });
        }
        continue;
      }
      if (entrada.name === "api" || entrada.name.startsWith("_")) continue;
      recorrer(path.join(dir, entrada.name), [...segmentos, entrada.name]);
    }
  };
  recorrer(path.join(process.cwd(), "src/app"), []);
  return { rutas: rutas.sort(), moldes, version: String(Date.now()) };
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_RUTAS_OFFLINE: JSON.stringify(rutasOffline()),
  },
};

export default nextConfig;
