import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catálogo de Productos | ARIFA",
  description:
    "Catálogo online de productos de seguridad contra incendios: matafuegos, detectores de humo, señalización, rociadores, mangueras y más. ARIFA – Córdoba.",
};

export default function CatalogoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
