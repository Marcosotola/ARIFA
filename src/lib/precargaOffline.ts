// Descarga lo necesario para usar la app sin conexión: las páginas (las guarda el service worker)
// y los datos de Firestore (quedan en la caché local). Corre sola cada tanto con señal, o a mano
// desde el indicador de conexión del panel.
import { auth, db } from "./firebase";
import { collection, getDocs } from "./firestore";
import { actualizar as actualizarEstado, estaOffline } from "./offline";

// Colecciones con las que se trabaja en el panel. Las que el rol no puede leer se saltean solas.
const COLECCIONES = [
  "usuarios", "configuracion", "ordenes_trabajo", "certificados", "certificadores", "textos_memoria",
  "plantillas_inspeccion", "plantillas_cliente", "plan_accion", "hys_documentos",
  "remitos_matafuegos", "mantenimiento_matafuegos", "matafuegos_activos",
  "presupuestos", "recibos", "remitos_doc", "cuenta_corriente", "libro_contable", "productos",
  "consultas", "capacitaciones_temas", "capacitaciones_preguntas", "capacitaciones_personal",
];

// Cada cuánto se vuelven a bajar los datos completos (cada descarga son lecturas de Firestore).
const INTERVALO_DATOS_MS = 12 * 60 * 60 * 1000;

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

async function precargarDatos(uid: string, forzar: boolean) {
  const clave = `arifa_offline_datos_${uid}`;
  if (!forzar && Date.now() - Number(leerLocal(clave) || 0) < INTERVALO_DATOS_MS) return;
  let i = 0;
  for (const nombre of COLECCIONES) {
    actualizarEstado({ preparando: `Descargando datos (${++i}/${COLECCIONES.length})` });
    try { await getDocs(collection(db, nombre)); } catch { /* sin permiso para este rol */ }
    if (estaOffline()) return;
  }
  guardarLocal(clave, String(Date.now()));
}

// Le pide al service worker que descargue todas las páginas y sus archivos (JS, CSS, fuentes).
async function precargarPaginas(forzar: boolean) {
  if (!("serviceWorker" in navigator)) return;
  const { rutas, moldes, version } = rutasOffline();
  if (!rutas.length) return;
  const clave = "arifa_offline_paginas";
  if (!forzar && leerLocal(clave) === version) return;
  const registro = await navigator.serviceWorker.ready;
  const sw = registro.active;
  if (!sw) return;
  // Además de los moldes, las altas nuevas que usan la ruta [id] con un id fijo.
  const extra = ["/admin/certificados/nuevo", "/admin/planillas/deteccion/nueva"];
  const ok = await new Promise<boolean>(resolve => {
    const canal = new MessageChannel();
    canal.port1.onmessage = (e) => {
      const { hechas, total, terminado, error } = e.data || {};
      if (terminado) resolve(!error);
      else actualizarEstado({ preparando: `Descargando páginas (${hechas}/${total})` });
    };
    sw.postMessage({ tipo: "ARIFA_PRECARGAR", rutas: [...rutas, ...extra], moldes }, [canal.port2]);
    // Si el service worker se reinicia en el medio, no queda esperando para siempre.
    setTimeout(() => resolve(false), 10 * 60 * 1000);
  });
  if (ok) guardarLocal(clave, version);
}

let enCurso: Promise<void> | null = null;

// `datos: false` para los clientes: solo pueden leer lo suyo, que ya queda guardado al verlo.
export function prepararModoOffline({ forzar = false, datos = true } = {}): Promise<void> {
  if (typeof window === "undefined" || estaOffline() || !auth?.currentUser) return Promise.resolve();
  if (enCurso) return enCurso;
  const uid = auth.currentUser.uid;
  enCurso = (async () => {
    try {
      await precargarPaginas(forzar);
      if (datos) await precargarDatos(uid, forzar);
    } catch (e) {
      console.warn("[offline] preparación incompleta", e);
    } finally {
      const fecha = Number(leerLocal(`arifa_offline_datos_${uid}`) || 0) || null;
      actualizarEstado({ preparando: null, preparadoEn: fecha });
      enCurso = null;
    }
  })();
  return enCurso;
}

export function fechaPreparacion(uid: string): number | null {
  return Number(leerLocal(`arifa_offline_datos_${uid}`) || 0) || null;
}
