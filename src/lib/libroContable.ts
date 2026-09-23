export const MEDIOS_PAGO = ["Efectivo", "Transferencia", "QR", "Débito", "Crédito"];
export const CATEGORIAS_INGRESO = ["Venta", "Recarga", "Prueba hidráulica", "Servicio", "Producto", "Otro"];
export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export interface Movimiento {
  id: string;
  fecha: string; // YYYY-MM-DD
  tipo: "ingreso" | "egreso";
  monto: number;
  medioPago: string;
  cliente: string;
  telefono: string;
  concepto: string;
  categorias: string[];
  productoId?: string;
  productoNombre?: string;
  cantidadVendida?: number;
  creadoPorId?: string;
  creadoPorNombre?: string;
}

export const fmtPeso = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export const fmtFecha = (f: string) => (f ? f.split("-").reverse().join("/") : "");

// mes: "" (todo el año) o "01".."12"
export function rangoPeriodo(anio: number, mes: string) {
  if (!mes) return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
  return { desde: `${anio}-${mes}-01`, hasta: `${anio}-${mes}-31` };
}

export function totales(movs: Movimiento[]) {
  const ingresos = movs.filter(m => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
  const egresos = movs.filter(m => m.tipo === "egreso").reduce((a, m) => a + m.monto, 0);
  return { ingresos, egresos, saldo: ingresos - egresos };
}

export function porMedioPago(movs: Movimiento[]) {
  const medios = Array.from(new Set([...MEDIOS_PAGO, ...movs.map(m => m.medioPago).filter(Boolean)]));
  return medios
    .map(medio => {
      const t = totales(movs.filter(m => m.medioPago === medio));
      return { medio, ingresos: t.ingresos, egresos: t.egresos, neto: t.saldo };
    })
    .filter(r => r.ingresos || r.egresos);
}

// Un cobro puede mezclar rubros (ej. recarga + PH), y el importe no se puede repartir: se agrupa por combinación.
export function porCategoria(movs: Movimiento[]) {
  const grupos = new Map<string, { total: number; cantidad: number }>();
  movs.filter(m => m.tipo === "ingreso").forEach(m => {
    const clave = m.categorias?.length ? m.categorias.join(" + ") : "Sin categoría";
    const g = grupos.get(clave) || { total: 0, cantidad: 0 };
    g.total += m.monto; g.cantidad += 1;
    grupos.set(clave, g);
  });
  return Array.from(grupos.entries()).map(([categoria, g]) => ({ categoria, ...g })).sort((a, b) => b.total - a.total);
}

export function porMes(movs: Movimiento[]) {
  const meses = new Map<string, Movimiento[]>();
  movs.forEach(m => {
    const k = m.fecha.slice(0, 7);
    meses.set(k, [...(meses.get(k) || []), m]);
  });
  return Array.from(meses.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, lista]) => ({ mes, ...totales(lista) }));
}

const celda = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const num = (n: number) => String(n).replace(".", ",");

// CSV con ";" y BOM para que Excel en español lo abra con las columnas y los acentos bien.
export function movimientosCsv(movs: Movimiento[]) {
  const filas = [["Fecha", "Tipo", "Cliente / Quién", "Teléfono", "Concepto", "Categorías", "Ingreso", "Egreso", "Medio de pago", "Cargado por"]];
  movs.forEach(m => filas.push([
    fmtFecha(m.fecha), m.tipo === "ingreso" ? "Ingreso" : "Egreso", m.cliente || "", m.telefono || "", m.concepto || "",
    (m.categorias || []).join(" + "), m.tipo === "ingreso" ? num(m.monto) : "", m.tipo === "egreso" ? num(m.monto) : "",
    m.medioPago || "", m.creadoPorNombre || "",
  ]));
  return "﻿" + filas.map(f => f.map(celda).join(";")).join("\r\n");
}
