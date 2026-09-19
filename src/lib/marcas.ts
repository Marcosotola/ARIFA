import { db } from "./firebase";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { MARCAS_DISPONIBLES } from "./matafuegosConstants";

// La marca se guarda siempre en mayúsculas y sin espacios de más, para que "Georgia" y "GEORGIA " no sean dos marcas.
export const normalizarMarca = (m?: string) => (m || "").trim().replace(/\s+/g, " ").toUpperCase();

// Marcas iniciales + las que ya se usaron, sin repetir y ordenadas.
export function sugerenciasMarcas(usadas: (string | undefined)[] = []): string[] {
  const todas = [...MARCAS_DISPONIBLES, ...usadas.map(normalizarMarca)].filter(Boolean);
  return Array.from(new Set(todas)).sort();
}

// Guarda en la configuración las marcas nuevas para sugerirlas la próxima vez.
export async function registrarMarcas(marcas: string[]) {
  const nuevas = Array.from(new Set(marcas.map(normalizarMarca).filter(Boolean)));
  if (nuevas.length === 0) return;
  await setDoc(doc(db, "configuracion", "matafuegos"), { marcas: arrayUnion(...nuevas) }, { merge: true });
}
