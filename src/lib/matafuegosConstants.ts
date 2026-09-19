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

export const AGENTES_NOMBRE: Record<string, string> = {
  ABC: "Polvo químico seco ABC",
  CO2: "Co2 BC",
  Agua: "Agua A",
  Espuma: "Espuma AFFF AB",
  K: "Acetato de potasio K",
  HCFC: "HCFC ABC",
};

// Datos fijos impresos en la tarjeta de control (oblea). La inscripción municipal puede pisarse desde configuracion/matafuegos.
export const OBLEA_EMISOR = {
  titular: "FACUNDO GERMAN PEDRAZA",
  cuil: "20-35108395-7",
  inscripcionMunicipal: "22389/25",
  directorTitulo: "Ing. Mecanico",
  directorMatricula: "M.P.: 14797400",
  empresa: "INGENIERIA EN SEGURIDAD CONTRA INCENDIOS",
  responsables: ["Lic. En higiene y seguridad laboral ARIEL PEREZ", "Lic. En higiene y seguridad laboral FACUNDO PEDRAZA"],
  email: "arifa.seguridadcontraincendios@gmail.com",
  direccion: "Lorenzo Barcala 727 B° Ducasse, Cordoba",
  telefonos: "351 2 794 498 / 351 2 449 504",
};
