import { db } from "./firebase";
import { doc, runTransaction } from "firebase/firestore";

interface FilaConTarjeta {
  nroTarjeta: string;
  tarjetaAuto?: boolean;
}

// Reasigna en orden correlativo (desde `desde`) las filas marcadas como automáticas, salteando los números tipeados a mano.
export function renumerarAuto<T extends FilaConTarjeta>(filas: T[], desde: number): T[] {
  const manuales = new Set(filas.filter(f => !f.tarjetaAuto).map(f => f.nroTarjeta.trim()).filter(Boolean));
  let n = desde;
  return filas.map(f => {
    if (!f.tarjetaAuto) return f;
    while (manuales.has(String(n))) n++;
    return { ...f, nroTarjeta: String(n++) };
  });
}

// Reserva los números automáticos contra el contador real de Firestore y lo deja actualizado.
export async function reservarTarjetas<T extends FilaConTarjeta>(filas: T[]): Promise<{ filas: T[]; reasignadas: boolean }> {
  const ref = doc(db, "configuracion", "matafuegos");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const actual: number = snap.exists() ? (snap.data().proximaTarjeta || 1) : 1;
    const resultado = renumerarAuto(filas, actual);
    const usados = resultado.map(f => parseInt(f.nroTarjeta)).filter(n => !isNaN(n));
    const siguiente = Math.max(actual, ...usados.map(n => n + 1));
    tx.set(ref, { proximaTarjeta: siguiente }, { merge: true });
    const reasignadas = resultado.some((f, i) => f.tarjetaAuto && f.nroTarjeta !== filas[i].nroTarjeta);
    return { filas: resultado, reasignadas };
  });
}
