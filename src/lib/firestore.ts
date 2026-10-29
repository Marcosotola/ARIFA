// Igual que "firebase/firestore", pero las escrituras no se quedan esperando al servidor.
//
// Con la caché local activada (ver firebase.ts) Firestore guarda cada escritura en el dispositivo al
// instante, pero la promesa de setDoc/addDoc/updateDoc recién se resuelve cuando el servidor confirma:
// sin señal, el "Guardando..." quedaría trabado para siempre. Acá se resuelve apenas queda guardado
// localmente (sin conexión) o a los pocos segundos (señal lenta); Firestore lo sube solo después.
// Importar siempre desde "@/lib/firestore" en lugar de "firebase/firestore".
import * as fs from "firebase/firestore";
import { anotarEscritura, estaOffline, vincularArchivosOffline } from "./offline";

export * from "firebase/firestore";

const ESPERA_MAXIMA_MS = 6000;

function sinEsperarServidor<T>(escritura: Promise<unknown>, valor: T): Promise<T> {
  anotarEscritura();
  if (estaOffline()) {
    escritura.catch(e => console.error("[offline] escritura rechazada por el servidor", e));
    return Promise.resolve(valor);
  }
  // Con señal, un error (p. ej. permisos) sigue llegando a quien llamó.
  return Promise.race([
    escritura.then(() => valor),
    new Promise<T>(resolve => setTimeout(() => {
      escritura.catch(e => console.error("[offline] escritura rechazada por el servidor", e));
      resolve(valor);
    }, ESPERA_MAXIMA_MS)),
  ]);
}

export const addDoc = ((reference: fs.CollectionReference, data: any) => {
  const nuevo = fs.doc(reference);
  const escritura = fs.setDoc(nuevo, data);
  vincularArchivosOffline(nuevo.path, data);
  return sinEsperarServidor(escritura, nuevo);
}) as typeof fs.addDoc;

export const setDoc = ((reference: fs.DocumentReference, data: any, options?: fs.SetOptions) => {
  const escritura = options ? fs.setDoc(reference, data, options) : fs.setDoc(reference, data);
  vincularArchivosOffline(reference.path, data);
  return sinEsperarServidor(escritura, undefined);
}) as typeof fs.setDoc;

export const updateDoc = ((reference: fs.DocumentReference, ...args: any[]) => {
  const escritura = (fs.updateDoc as any)(reference, ...args);
  vincularArchivosOffline(reference.path, args);
  return sinEsperarServidor(escritura, undefined);
}) as typeof fs.updateDoc;

export const deleteDoc = ((reference: fs.DocumentReference) =>
  sinEsperarServidor(fs.deleteDoc(reference), undefined)) as typeof fs.deleteDoc;

export const writeBatch = ((firestore: fs.Firestore) => {
  const batch = fs.writeBatch(firestore);
  const commit = batch.commit.bind(batch);
  batch.commit = () => sinEsperarServidor(commit(), undefined);
  return batch;
}) as typeof fs.writeBatch;

// Sin conexión cuenta con los documentos guardados en el dispositivo.
export const getCountFromServer = (async (q: fs.Query) => {
  try {
    if (estaOffline()) throw new Error("offline");
    return await fs.getCountFromServer(q);
  } catch {
    const snap = await fs.getDocsFromCache(q);
    return { data: () => ({ count: snap.size }) };
  }
}) as unknown as typeof fs.getCountFromServer;
