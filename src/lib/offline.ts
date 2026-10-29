// Modo sin conexión: estado de sincronización y cola de archivos (fotos, PDFs) pendientes de subir.
//
// Firestore ya guarda los datos y las escrituras en el dispositivo (ver firebase.ts). Storage no:
// una foto sacada sin señal se guarda acá (IndexedDB) y la app usa una URL provisoria
// `/offline-file/<id>` que el service worker sirve desde el dispositivo. Al volver la señal se sube
// a Storage y se reemplaza la URL provisoria en los documentos de Firestore que la guardaron.
import { auth, db, storage } from "./firebase";
import { doc, getDoc, updateDoc, waitForPendingWrites } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

export const PREFIJO_ARCHIVO_OFFLINE = "/offline-file/";
// Debe coincidir con CACHE_ARCHIVOS de public/firebase-messaging-sw.js
const CACHE_ARCHIVOS = "arifa-archivos-v2";
// Después de subido, el registro (sin la foto) se guarda un tiempo por si un formulario abierto
// vuelve a guardar la URL provisoria: así se la sigue reemplazando.
const RETENCION_MS = 30 * 24 * 60 * 60 * 1000;

interface ArchivoPendiente {
  id: string;
  ruta: string;
  blob: Blob | null;
  tipo: string;
  creado: number;
  url: string | null;
  docs: string[];
}

interface BorradoPendiente {
  id: string;
  url: string;
}

// ── Estado (para el indicador de conexión) ─────────────────────────────────

export interface EstadoOffline {
  online: boolean;
  escriturasPendientes: boolean;
  archivosPendientes: number;
  sincronizandoArchivos: boolean;
}

let estado: EstadoOffline = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  escriturasPendientes: false,
  archivosPendientes: 0,
  sincronizandoArchivos: false,
};
const oyentes = new Set<(e: EstadoOffline) => void>();

function actualizar(cambios: Partial<EstadoOffline>) {
  estado = { ...estado, ...cambios };
  oyentes.forEach(fn => fn(estado));
}

export function escucharEstadoOffline(fn: (e: EstadoOffline) => void) {
  oyentes.add(fn);
  fn(estado);
  return () => { oyentes.delete(fn); };
}

export function estaOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

let generacionEscrituras = 0;
// Se llama después de cada escritura: el indicador muestra "sin subir" hasta que el servidor confirma todo.
export function anotarEscritura() {
  if (!db || typeof window === "undefined") return;
  const gen = ++generacionEscrituras;
  actualizar({ escriturasPendientes: true });
  waitForPendingWrites(db)
    .then(() => { if (gen === generacionEscrituras) actualizar({ escriturasPendientes: false }); })
    .catch(() => {});
}

// ── IndexedDB ───────────────────────────────────────────────────────────────

const NOMBRE_DB = "arifa-offline";
let dbPromesa: Promise<IDBDatabase> | null = null;

function abrirDB(): Promise<IDBDatabase> {
  if (!dbPromesa) {
    dbPromesa = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOMBRE_DB, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("archivos")) d.createObjectStore("archivos", { keyPath: "id" });
        if (!d.objectStoreNames.contains("borrados")) d.createObjectStore("borrados", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromesa = null; reject(req.error); };
    });
  }
  return dbPromesa;
}

async function idb<T>(store: string, modo: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = op(d.transaction(store, modo).objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

const leerTodos = <T>(store: string) => idb<T[]>(store, "readonly", s => s.getAll());
const leer = <T>(store: string, id: string) => idb<T | undefined>(store, "readonly", s => s.get(id));
const guardar = (store: string, valor: unknown) => idb(store, "readwrite", s => s.put(valor));
const borrar = (store: string, id: string) => idb(store, "readwrite", s => s.delete(id));

function nuevoId() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

// ── Archivos ────────────────────────────────────────────────────────────────

export function esArchivoOffline(url: unknown): url is string {
  return typeof url === "string" && url.includes(PREFIJO_ARCHIVO_OFFLINE);
}

function idDeArchivoOffline(url: string) {
  return url.split(PREFIJO_ARCHIVO_OFFLINE)[1]?.split(/[?#/]/)[0] || "";
}

// Deja la foto también en la caché del proxy de imágenes: así los PDFs la pueden usar sin conexión.
async function guardarEnCacheDeImagenes(url: string, blob: Blob) {
  try {
    const cache = await caches.open(CACHE_ARCHIVOS);
    await cache.put(`/api/proxy-image?url=${encodeURIComponent(url)}`, new Response(blob, {
      headers: { "Content-Type": blob.type || "application/octet-stream" },
    }));
  } catch { /* ok */ }
}

function esErrorDeRed(e: any) {
  return estaOffline() || ["storage/retry-limit-exceeded", "storage/unknown"].includes(e?.code);
}

// Sube un archivo a Storage y devuelve su URL. Sin conexión lo guarda en el dispositivo y devuelve
// una URL provisoria que se reemplaza sola en Firestore cuando el archivo se sube.
export async function subirArchivo(ruta: string, archivo: Blob): Promise<string> {
  if (!estaOffline()) {
    try {
      const r = ref(storage, ruta);
      await uploadBytes(r, archivo, archivo.type ? { contentType: archivo.type } : undefined);
      const url = await getDownloadURL(r);
      guardarEnCacheDeImagenes(url, archivo);
      return url;
    } catch (e) {
      if (!esErrorDeRed(e)) throw e;
    }
  }
  const id = nuevoId();
  const registro: ArchivoPendiente = { id, ruta, blob: archivo, tipo: archivo.type, creado: Date.now(), url: null, docs: [] };
  await guardar("archivos", registro);
  contarPendientes();
  return `${PREFIJO_ARCHIVO_OFFLINE}${id}`;
}

// Borra un archivo de Storage. Sin conexión queda anotado y se borra al volver la señal.
export async function borrarArchivo(url: string) {
  if (!url) return;
  if (esArchivoOffline(url)) {
    const registro = await leer<ArchivoPendiente>("archivos", idDeArchivoOffline(url));
    if (registro) {
      await borrar("archivos", registro.id);
      if (registro.url) await borrarArchivo(registro.url);
    }
    contarPendientes();
    return;
  }
  if (!estaOffline()) {
    try {
      await deleteObject(ref(storage, url));
      return;
    } catch (e: any) {
      if (e?.code === "storage/object-not-found" || !esErrorDeRed(e)) throw e;
    }
  }
  await guardar("borrados", { id: nuevoId(), url } satisfies BorradoPendiente);
}

// Lo llama el wrapper de Firestore al guardar: anota qué documentos usan URLs provisorias.
export function vincularArchivosOffline(rutaDoc: string, datos: unknown) {
  const ids = new Set<string>();
  const recorrer = (v: unknown) => {
    if (typeof v === "string") {
      for (const parte of v.split(PREFIJO_ARCHIVO_OFFLINE).slice(1)) ids.add(parte.split(/[?#/"'\s]/)[0]);
    } else if (Array.isArray(v)) v.forEach(recorrer);
    else if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) Object.values(v).forEach(recorrer);
  };
  recorrer(datos);
  if (!ids.size) return;
  (async () => {
    for (const id of ids) {
      const registro = await leer<ArchivoPendiente>("archivos", id);
      if (registro && !registro.docs.includes(rutaDoc)) {
        registro.docs.push(rutaDoc);
        await guardar("archivos", registro);
      }
    }
    sincronizarArchivos();
  })().catch(e => console.warn("[offline] no se pudo vincular archivos", e));
}

function reemplazar(valor: any, buscar: string, por: string): any {
  if (typeof valor === "string") return valor.split(buscar).join(por);
  if (Array.isArray(valor)) return valor.map(v => reemplazar(v, buscar, por));
  if (valor && typeof valor === "object" && Object.getPrototypeOf(valor) === Object.prototype) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, reemplazar(v, buscar, por)]));
  }
  return valor;
}

async function reemplazarEnDoc(rutaDoc: string, buscar: string, por: string) {
  const docRef = doc(db, rutaDoc);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  const cambios: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(snap.data())) {
    const nuevo = reemplazar(valor, buscar, por);
    if (JSON.stringify(nuevo) !== JSON.stringify(valor)) cambios[campo] = nuevo;
  }
  if (Object.keys(cambios).length) {
    // No se espera la confirmación del servidor: si la señal se corta, queda en la cola de Firestore.
    updateDoc(docRef, cambios).catch(e => console.error("[offline] no se pudo actualizar", rutaDoc, e));
    anotarEscritura();
  }
}

async function contarPendientes() {
  try {
    const archivos = await leerTodos<ArchivoPendiente>("archivos");
    actualizar({ archivosPendientes: archivos.filter(a => !a.url || a.docs.length).length });
  } catch { /* ok */ }
}

let sincronizando = false;
let repetir = false;

// Sube las fotos pendientes, reemplaza las URLs provisorias y borra lo que quedó anotado.
export async function sincronizarArchivos(): Promise<void> {
  if (typeof window === "undefined" || estaOffline() || !auth?.currentUser) return;
  if (sincronizando) { repetir = true; return; }
  sincronizando = true;
  actualizar({ sincronizandoArchivos: true });
  try {
    const trabajo = async () => {
      for (const a of await leerTodos<ArchivoPendiente>("archivos")) {
        if (!a.url && a.blob) {
          const r = ref(storage, a.ruta);
          await uploadBytes(r, a.blob, a.tipo ? { contentType: a.tipo } : undefined);
          a.url = await getDownloadURL(r);
          await guardarEnCacheDeImagenes(a.url, a.blob);
          a.blob = null;
          await guardar("archivos", a);
        }
        if (!a.url) continue;
        for (const rutaDoc of [...a.docs]) {
          await reemplazarEnDoc(rutaDoc, `${PREFIJO_ARCHIVO_OFFLINE}${a.id}`, a.url);
          a.docs = a.docs.filter(d => d !== rutaDoc);
          await guardar("archivos", a);
        }
        if (!a.docs.length && Date.now() - a.creado > RETENCION_MS) await borrar("archivos", a.id);
      }
      for (const b of await leerTodos<BorradoPendiente>("borrados")) {
        try { await deleteObject(ref(storage, b.url)); }
        catch (e: any) { if (e?.code !== "storage/object-not-found" && esErrorDeRed(e)) throw e; }
        await borrar("borrados", b.id);
      }
    };
    // Con varias pestañas abiertas, una sola sube (si el navegador lo permite).
    const locks = (navigator as any).locks;
    if (locks?.request) await locks.request("arifa-sincronizar-archivos", { ifAvailable: true }, (lock: unknown) => lock ? trabajo() : undefined);
    else await trabajo();
  } catch (e) {
    console.warn("[offline] sincronización de archivos incompleta", e);
  } finally {
    sincronizando = false;
    actualizar({ sincronizandoArchivos: false });
    contarPendientes();
    if (repetir) { repetir = false; sincronizarArchivos(); }
  }
}

let iniciado = false;
// Se llama una vez desde el panel: escucha la conexión y sincroniza al volver la señal.
export function iniciarModoOffline() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  const alCambiar = () => {
    actualizar({ online: navigator.onLine });
    if (navigator.onLine) { anotarEscritura(); sincronizarArchivos(); }
  };
  window.addEventListener("online", alCambiar);
  window.addEventListener("offline", alCambiar);
  auth?.onAuthStateChanged?.((u: unknown) => { if (u) sincronizarArchivos(); });
  anotarEscritura();
  contarPendientes();
  // Por si el evento "online" no llega (pasa en algunos celulares).
  setInterval(() => { if (navigator.onLine) sincronizarArchivos(); }, 5 * 60 * 1000);
}
