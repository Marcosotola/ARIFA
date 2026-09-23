// Importador del histórico del libro contable desde el CSV que exporta el Excel/Google Sheets del local.
// Columnas esperadas (en cualquier orden, detectadas por encabezado):
// FECHA, CLIENTE, TELEFONO, PRODUCTO, SERVICIO, VENTA, RECARGA, PRUEBA HIDRAULICA, INGRESO, EGRESO, MEDIO DE PAGO

export interface FilaImportada {
  fila: number; // número de línea en el CSV, para que el usuario pueda ubicarla
  fecha: string; // ISO, o "" si no se pudo interpretar
  fechaOriginal: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  medioPago: string;
  cliente: string;
  telefono: string;
  concepto: string;
  categorias: string[];
  advertencias: string[];
}

const MEDIOS_CONOCIDOS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tranferencia: "Transferencia",
  tranbferencia: "Transferencia",
  qr: "QR",
  "qr nave": "QR",
  debito: "Débito",
  "débito": "Débito",
  credito: "Crédito",
  "crédito": "Crédito",
};

export function parseCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let entreComillas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (entreComillas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') entreComillas = false;
      else campo += ch;
    } else if (ch === '"') {
      entreComillas = true;
    } else if (ch === ",") {
      fila.push(campo); campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo); filas.push(fila); fila = []; campo = "";
    } else {
      campo += ch;
    }
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

function normalizarNumero(s: string): number {
  const n = Number(String(s || "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// Interpreta dd/mm/aa, dd/mm/aaaa y variantes con errores de tipeo comunes en el Excel original (año pegado sin barra, año con dígito de más/menos).
function normalizarFecha(raw: string): { iso: string; advertencia?: string } {
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    const [, d, mo, yRaw] = m;
    const y = yRaw.length === 2 ? "20" + yRaw : yRaw;
    if (y.length === 4 && (y[0] !== "2" || Number(y) < 2020 || Number(y) > 2035)) {
      // Año con dígitos de más/menos o corrido (ej. "0202"): no se adivina, se deja para corregir a mano.
      return { iso: "", advertencia: `El año "${yRaw}" en la fecha "${raw}" no parece válido. Corregí la fecha antes de importar esta fila.` };
    }
    return { iso: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}` };
  }
  // Formato "dd/mmaaaa" (falta una barra), ej. "26/082026"
  m = s.match(/^(\d{1,2})\/(\d{2})(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return { iso: `${y}-${mo}-${d.padStart(2, "0")}`, advertencia: `Fecha "${raw}" tenía una barra faltante, se interpretó como ${d}/${mo}/${y}. Confirmalo.` };
  }
  return { iso: "", advertencia: `No se pudo interpretar la fecha "${raw}". Corregila antes de importar.` };
}

export function parseLibroCsv(texto: string): { filas: FilaImportada[]; columnasFaltantes: string[] } {
  const tabla = parseCsv(texto);
  const idxHeader = tabla.findIndex(r => (r[0] || "").trim().toUpperCase() === "FECHA");
  if (idxHeader === -1) {
    return { filas: [], columnasFaltantes: ["No se encontró la fila de encabezados (una columna 'FECHA')."] };
  }
  const header = tabla[idxHeader].map(h => h.trim().toUpperCase());
  const col = (nombre: string) => header.indexOf(nombre);
  const iFecha = col("FECHA"), iCliente = col("CLIENTE"), iTel = col("TELEFONO"),
    iProd = col("PRODUCTO"), iServ = col("SERVICIO"), iVenta = col("VENTA"), iRecarga = col("RECARGA"),
    iPH = col("PRUEBA HIDRAULICA"), iIngreso = col("INGRESO"), iEgreso = col("EGRESO"), iMedio = col("MEDIO DE PAGO");

  const columnasFaltantes: string[] = [];
  if (iIngreso === -1 && iEgreso === -1) columnasFaltantes.push("No se encontraron las columnas INGRESO ni EGRESO.");

  const filas: FilaImportada[] = [];
  for (let f = idxHeader + 1; f < tabla.length; f++) {
    const r = tabla[f];
    if (!r.some(c => (c || "").trim())) continue; // fila vacía
    const get = (i: number) => (i >= 0 ? (r[i] || "").trim() : "");

    const fechaRaw = get(iFecha);
    const { iso: fecha, advertencia: advFecha } = fechaRaw ? normalizarFecha(fechaRaw) : { iso: "", advertencia: "Falta la fecha." };

    const ingreso = Math.abs(normalizarNumero(get(iIngreso)));
    const egreso = Math.abs(normalizarNumero(get(iEgreso)));
    const advertencias: string[] = [];
    if (advFecha) advertencias.push(advFecha);

    let tipo: "ingreso" | "egreso" = "ingreso";
    let monto = 0;
    if (ingreso && !egreso) { tipo = "ingreso"; monto = ingreso; }
    else if (egreso && !ingreso) { tipo = "egreso"; monto = egreso; }
    else if (ingreso && egreso) { tipo = "ingreso"; monto = ingreso; advertencias.push("Tiene monto en INGRESO y EGRESO a la vez; se tomó como ingreso. Revisala."); }
    else { advertencias.push("No tiene monto en INGRESO ni en EGRESO."); }

    if (tipo === "ingreso" && /extrac|retiro de caja/i.test(get(iProd) + get(iServ))) {
      advertencias.push('El concepto menciona "extracción/retiro de caja" pero está cargado como ingreso. Probablemente sea un egreso: revisalo.');
    }

    const medioRaw = get(iMedio);
    const medioPago = MEDIOS_CONOCIDOS[medioRaw.toLowerCase()] || "";
    if (!medioPago) advertencias.push(medioRaw ? `Medio de pago "${medioRaw}" no reconocido.` : "Falta el medio de pago.");

    const categorias: string[] = [];
    if (get(iVenta)) categorias.push("Venta");
    if (get(iRecarga)) categorias.push("Recarga");
    if (get(iPH)) categorias.push("Prueba hidráulica");
    if (categorias.length === 0 && get(iServ)) categorias.push("Servicio");
    if (categorias.length === 0 && get(iProd)) categorias.push("Producto");

    const concepto = [get(iProd), get(iServ), get(iVenta), get(iRecarga), get(iPH)].filter(Boolean).join(" — ");

    filas.push({
      fila: f + 1,
      fecha, fechaOriginal: fechaRaw,
      tipo, monto, medioPago,
      cliente: get(iCliente), telefono: get(iTel), concepto,
      categorias, advertencias,
    });
  }
  return { filas, columnasFaltantes };
}
