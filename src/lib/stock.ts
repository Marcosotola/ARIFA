import { db } from "./firebase";
import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from "./firestore";
import { estaOffline } from "./offline";

// Suma delta (puede ser negativo) al stock del producto, sin bajar de 0. No falla si el producto ya no existe.
export async function ajustarStock(productoId: string, delta: number) {
  if (!productoId || !delta) return;
  const ref = doc(db, "productos", productoId);
  // Sin conexión no hay transacciones: se ajusta sobre el stock guardado en el dispositivo.
  if (estaOffline()) {
    const snap = await getDoc(ref).catch(() => null);
    if (!snap?.exists()) return;
    const actual = Number(snap.data().stock) || 0;
    await updateDoc(ref, { stock: Math.max(0, actual + delta), updatedAt: serverTimestamp() });
    return;
  }
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const actual = Number(snap.data().stock) || 0;
    tx.update(ref, { stock: Math.max(0, actual + delta), updatedAt: serverTimestamp() });
  });
}
