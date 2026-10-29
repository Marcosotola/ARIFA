// Prepara la app para usarla sin conexión: descarga las páginas (las guarda el service worker) y
// las listas que necesitan los formularios para arrancar sin señal (clientes, plantillas).
// No descarga los registros: los que se abren con señal quedan guardados solos, y lo que se carga
// sin señal se sube cuando vuelve la conexión.
import { auth, db } from "./firebase";
import { collection, getDocs } from "./firestore";
import { estaOffline } from "./offline";

// Lo mínimo para empezar una planilla, inspección o certificado sin señal. Las que el rol no
// puede leer se saltean solas.
const LISTAS_FORMULARIOS = [
  "usuarios", "configuracion", "plantillas_inspeccion", "plantillas_cliente", "textos_memoria", "certificadores",
];

const INTERVALO_LISTAS_MS = 24 * 60 * 60 * 1000;

interface RutasOffline {
  rutas: string[];
  moldes: { patron: string; url: string }[];
  version: string;
}

function rutasOffline(): RutasOffline {
  try { return JSON.parse(process.env.NEXT_PUBLIC_RUTAS_OFFLINE || ""); }
  catch { return { rutas: [], moldes: [], version: "" }; }
}

const leerLocal = (clave: string) => { try { return localStorage.getItem(clave); } catch { return null; } };
const guardarLocal = (clave: string, valor: string) => { try { localStorage.setItem(clave, valor); } catch { /* ok */ } };

async function precargarListas(uid: string) {
  const clave = `arifa_offline_listas_${uid}`;
  if (Date.now() - Number(leerLocal(clave) || 0) < INTERVALO_LISTAS_MS) return;
  for (const nombre of LISTAS_FORMULARIOS) {
    try { await getDocs(collection(db, nombre)); } catch { /* sin permiso para este rol */ }
    if (estaOffline()) return;
  }
  guardarLocal(clave, String(Date.now()));
}

// Le pide al service worker que descargue todas las páginas y sus archivos (JS, CSS, fuentes).
// Solo la primera vez y después de cada actualización de la app.
async function precargarPaginas() {
  if (!("serviceWorker" in navigator)) return;
  const { rutas, moldes, version } = rutasOffline();
  if (!rutas.length) return;
  const clave = "arifa_offline_paginas";
  if (leerLocal(clave) === version) return;
  const registro = await navigator.serviceWorker.ready;
  const sw = registro.active;
  if (!sw) return;
  // Además de los moldes, las altas nuevas que usan la ruta [id] con un id fijo.
  const extra = ["/admin/certificados/nuevo", "/admin/planillas/deteccion/nueva"];
  const ok = await new Promise<boolean>(resolve => {
    const canal = new MessageChannel();
    canal.port1.onmessage = (e) => { if (e.data?.terminado) resolve(!e.data.error); };
    sw.postMessage({ tipo: "ARIFA_PRECARGAR", rutas: [...rutas, ...extra], moldes }, [canal.port2]);
    // Si el service worker se reinicia en el medio, no queda esperando para siempre.
    setTimeout(() => resolve(false), 10 * 60 * 1000);
  });
  if (ok) guardarLocal(clave, version);
}

let enCurso: Promise<void> | null = null;

// `listas: false` para los clientes: no cargan formularios.
export function prepararModoOffline({ listas = true } = {}): Promise<void> {
  if (typeof window === "undefined" || estaOffline() || !auth?.currentUser) return Promise.resolve();
  if (enCurso) return enCurso;
  const uid = auth.currentUser.uid;
  enCurso = (async () => {
    try {
      await precargarPaginas();
      if (listas) await precargarListas(uid);
    } catch (e) {
      console.warn("[offline] preparación incompleta", e);
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}
