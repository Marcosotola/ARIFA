import { useParams, usePathname } from "next/navigation";

// Página que el service worker guarda como molde de cada ruta /[id] del panel (ver next.config.ts).
export const ID_MOLDE_OFFLINE = "_offline";

// El [id] de la ruta actual. Sin conexión el service worker puede servir el molde de la ruta
// (/admin/certificados/_offline) para cualquier id: en ese caso el id real se toma de la URL.
export function useIdRuta(): string {
  const params = useParams();
  const pathname = usePathname();
  const id = params?.id as string;
  if (id !== ID_MOLDE_OFFLINE) return id;
  return decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
}
