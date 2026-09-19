export const MARCAS_DISPONIBLES = ["Melisam", "Horizonte", "Drago", "Yukon", "Cassaro", "Fadesa", "Centurion", "GEORGIA", "Otro"];

export const CAPACIDADES_DISPONIBLES = ["1kg", "2kg", "2.5kg", "3kg", "3.5kg", "4kg", "5kg", "10kg", "16kg", "25kg", "50kg", "9lts", "10lts", "Otro"];

export const MANTENIMIENTO_ARIFA = "ARIFA";
export const MANTENIMIENTO_OTRA = "Otra empresa";

// Lista para un <select>: conserva el valor ya guardado aunque no figure en el listado (datos históricos o cargados con "Otro").
export function opcionesConValor(lista: string[], valor?: string): string[] {
  const base = lista.filter(o => o !== "Otro");
  const extra = valor && valor !== "Otro" && !base.includes(valor) ? [valor] : [];
  return [...base, ...extra, "Otro"];
}

// Si eligieron "Otro", el valor real es lo que escribieron.
export function resolverOtro(valor: string, otro?: string): string {
  return valor === "Otro" ? (otro || "").trim() : valor;
}
