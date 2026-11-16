import { db } from "./firebase";
import { doc, setDoc, arrayUnion } from "@/lib/firestore";
import { AGENTES_NOMBRE } from "./matafuegosConstants";

// Tipos de agente fijos (se guardan por código: "ABC", "CO2", ...). Los cargados a mano se guardan con el texto escrito.
const CODIGOS = Object.keys(AGENTES_NOMBRE);

export const normalizarAgente = (a?: string) => (a || "").trim().replace(/\s+/g, " ");

// true si el texto ya es uno de los fijos (por código o por nombre), sin importar mayúsculas.
function esFijo(a: string): boolean {
  const t = a.toLowerCase();
  return CODIGOS.some(c => c.toLowerCase() === t || AGENTES_NOMBRE[c].toLowerCase() === t);
}

// Valor final a guardar: si eligieron "Otro" es lo escrito; si lo escrito coincide con un fijo, se guarda su código.
export function resolverAgente(valor: string, otro?: string): string {
  if (valor !== "Otro") return valor;
  const t = normalizarAgente(otro);
  const fijo = CODIGOS.find(c => c.toLowerCase() === t.toLowerCase() || AGENTES_NOMBRE[c].toLowerCase() === t.toLowerCase());
  return fijo || t;
}

// Opciones del <select> de Tipo: fijos + los que se fueron cargando + el valor actual si no figura + "Otro".
export function opcionesAgente(extras: string[] = [], valor?: string): { value: string; label: string }[] {
  const fijos = CODIGOS.map(c => ({ value: c, label: AGENTES_NOMBRE[c] }));
  const vistos = new Set<string>();
  const cargados = [...extras, valor || ""]
    .map(normalizarAgente)
    .filter(a => a && a !== "Otro" && !esFijo(a))
    .filter(a => { const k = a.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .sort((a, b) => a.localeCompare(b))
    .map(a => ({ value: a, label: a }));
  return [...fijos, ...cargados, { value: "Otro", label: "Otro (escribir)" }];
}

// Guarda en la configuración los tipos nuevos para ofrecerlos la próxima vez.
export async function registrarAgentes(agentes: (string | undefined)[]) {
  const nuevos = Array.from(new Set(agentes.map(normalizarAgente).filter(a => a && a !== "Otro" && !esFijo(a))));
  if (nuevos.length === 0) return;
  await setDoc(doc(db, "configuracion", "matafuegos"), { agentes: arrayUnion(...nuevos) }, { merge: true });
}
