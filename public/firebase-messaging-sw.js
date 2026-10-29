// Firebase Cloud Messaging Service Worker for ARIFA
// This file handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

// Firebase config - these are public keys (safe to expose)
const firebaseConfig = {
  apiKey: "AIzaSyBjbYC1KMINPD8TqL4z0QcR9ctrKQR7gyU",
  authDomain: "arifa-b5c14.firebaseapp.com",
  projectId: "arifa-b5c14",
  storageBucket: "arifa-b5c14.firebasestorage.app",
  messagingSenderId: "19697046147",
  appId: "1:219697046147:web:3f954d5597d181dd04b1b6",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages (when app is not in foreground)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || 'ARIFA';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/logos/192x192.png',
    badge: '/logos/favicon.png',
    tag: payload.data?.tag || 'arifa-notification',
    data: payload.data,
    requireInteraction: false,
    actions: payload.data?.actionUrl ? [
      { action: 'open', title: 'Ver más' }
    ] : [],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const actionUrl = event.notification.data?.actionUrl || '/admin';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(actionUrl);
          return;
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(actionUrl);
      }
    })
  );
});
// ─── Modo sin conexión ───────────────────────────────────────────────────────
// - Páginas: primero la red; sin señal, la copia guardada. Las rutas /admin con [id] usan un molde
//   (/admin/certificados/_offline) que sirve para cualquier id (ver src/hooks/useIdRuta.ts).
// - Archivos de Next (/_next/static): guardados para siempre (el nombre cambia con cada versión).
// - Fotos de Firebase Storage y /api/proxy-image: se guardan al verlas para tenerlas sin señal.
// - /offline-file/<id>: fotos sacadas sin conexión que todavía no se subieron (src/lib/offline.ts).
// La app pide la descarga completa de páginas con el mensaje ARIFA_PRECARGAR (src/lib/precargaOffline.ts).

const MODO_DEV = new URL(self.location.href).searchParams.has('dev');
const CACHE_PAGINAS = 'arifa-paginas-v2';
const CACHE_ESTATICOS = 'arifa-estaticos-v2';
const CACHE_ARCHIVOS = 'arifa-archivos-v2'; // Debe coincidir con CACHE_ARCHIVOS de src/lib/offline.ts
const CACHE_META = 'arifa-meta-v2';
const CACHES_VALIDOS = [CACHE_PAGINAS, CACHE_ESTATICOS, CACHE_ARCHIVOS, CACHE_META];
const MAX_PAGINAS = 300;
const MAX_ARCHIVOS = 400;
const ESPERA_RED_MS = 5000;
const PREFIJO_ARCHIVO_OFFLINE = '/offline-file/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_ESTATICOS)
      .then((cache) => cache.addAll(['/logos/192x192.png', '/logos/favicon.png']))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => !CACHES_VALIDOS.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (MODO_DEV) return;
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith(PREFIJO_ARCHIVO_OFFLINE)) {
      event.respondWith(servirArchivoOffline(idArchivoOffline(url.pathname), req));
      return;
    }
    if (url.pathname === '/api/proxy-image') { event.respondWith(proxyImagen(url)); return; }
    if (url.pathname.startsWith('/api/certificado/')) { event.respondWith(redPrimero(req, CACHE_ARCHIVOS)); return; }
    if (url.pathname.startsWith('/api/')) return;
    if (req.mode === 'navigate') { event.respondWith(navegar(req, url)); return; }
    // Pedidos internos del router de Next (RSC): sin señal fallan y Next recarga la página
    // completa, que sale de la caché de páginas.
    if (req.headers.get('RSC') || url.searchParams.has('_rsc')) return;
    if (url.pathname.startsWith('/_next/static/')) { event.respondWith(cachePrimero(req, CACHE_ESTATICOS)); return; }
    if (url.pathname.startsWith('/_next/') && !url.pathname.startsWith('/_next/image')) return;
    event.respondWith(guardadoYActualizar(req, CACHE_ESTATICOS));
    return;
  }

  // Fotos de Firebase Storage mostradas en <img>
  if (url.hostname === 'firebasestorage.googleapis.com' && req.mode === 'no-cors') {
    event.respondWith(cachePrimero(req, CACHE_ARCHIVOS, MAX_ARCHIVOS));
  }
});

// ── Estrategias ──

function conTiempo(promesa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promesa.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function guardarEnCache(nombre, clave, resp, maximo) {
  try {
    const cache = await caches.open(nombre);
    await cache.put(clave, resp);
    if (maximo) recortar(cache, maximo);
  } catch { /* sin espacio u otra falla: no es grave */ }
}

// Borra las entradas más viejas (las primeras en guardarse) cuando la caché pasa el máximo.
async function recortar(cache, maximo) {
  const claves = await cache.keys();
  for (const clave of claves.slice(0, Math.max(0, claves.length - maximo))) await cache.delete(clave);
}

async function cachePrimero(req, nombre, maximo) {
  const guardada = await caches.match(req, { cacheName: nombre, ignoreVary: true });
  if (guardada) return guardada;
  const resp = await fetch(req);
  if (resp.ok || resp.type === 'opaque') guardarEnCache(nombre, req, resp.clone(), maximo);
  return resp;
}

async function redPrimero(req, nombre) {
  try {
    const resp = await fetch(req);
    if (resp.ok) guardarEnCache(nombre, req, resp.clone(), MAX_ARCHIVOS);
    return resp;
  } catch (e) {
    const guardada = await caches.match(req, { cacheName: nombre, ignoreVary: true });
    if (guardada) return guardada;
    throw e;
  }
}

async function guardadoYActualizar(req, nombre) {
  const guardada = await caches.match(req, { cacheName: nombre, ignoreVary: true });
  const red = fetch(req).then((resp) => {
    if (resp.ok) guardarEnCache(nombre, req, resp.clone());
    return resp;
  });
  if (guardada) { red.catch(() => {}); return guardada; }
  return red;
}

// ── Páginas ──

function esHTML(resp) {
  return (resp.headers.get('content-type') || '').includes('text/html');
}

let moldesEnMemoria = null;

async function leerMoldes() {
  if (moldesEnMemoria) return moldesEnMemoria;
  try {
    const resp = await caches.match('/__arifa/moldes.json', { cacheName: CACHE_META });
    moldesEnMemoria = resp ? await resp.json() : [];
  } catch { moldesEnMemoria = []; }
  return moldesEnMemoria;
}

async function paginaGuardada(url) {
  const cache = await caches.open(CACHE_PAGINAS);
  const exacta = await cache.match(url.origin + url.pathname, { ignoreVary: true });
  if (exacta) return exacta;
  const sinBarra = url.pathname.replace(/\/$/, '');
  if (sinBarra && sinBarra !== url.pathname) {
    const r = await cache.match(url.origin + sinBarra, { ignoreVary: true });
    if (r) return r;
  }
  for (const molde of await leerMoldes()) {
    if (new RegExp(molde.patron).test(url.pathname)) {
      const r = await cache.match(url.origin + molde.url, { ignoreVary: true });
      if (r) return r;
    }
  }
  return null;
}

async function navegar(req, url) {
  const red = fetch(req).then((resp) => {
    if (resp.ok && esHTML(resp)) guardarEnCache(CACHE_PAGINAS, url.origin + url.pathname, resp.clone(), MAX_PAGINAS);
    return resp;
  });
  try {
    // Con señal lenta no se espera de más si ya hay una copia guardada.
    return await conTiempo(red, ESPERA_RED_MS);
  } catch {
    const guardada = await paginaGuardada(url);
    if (guardada) { red.catch(() => {}); return guardada; }
    try { return await red; } catch { return paginaSinConexion(url); }
  }
}

function paginaSinConexion(url) {
  const volver = url.pathname.startsWith('/admin') ? '/admin' : '/';
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión | ARIFA</title><style>body{font-family:system-ui,sans-serif;background:#f8f9fa;color:#002244;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box;text-align:center}
a{display:inline-block;margin-top:20px;padding:10px 22px;background:#002244;color:#fff;border-radius:8px;text-decoration:none;font-weight:700}p{color:#64748b;max-width:420px;line-height:1.5}</style></head>
<body><div><h1>Sin conexión</h1><p>Esta página todavía no se descargó en este dispositivo. Abrila una vez con internet para poder usarla sin conexión.</p><a href="${volver}">Volver al inicio</a></div></body></html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ── Descarga completa para usar sin conexión ──

const RE_ESTATICOS = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[^"'`\s\\)(,;]+/g;

// Imágenes de /public (logos, banners) que usan las páginas.
const RE_PUBLICOS = /["'(]\/(?!_next\/|api\/)[A-Za-z0-9_\-.\/~%]+\.(?:png|jpe?g|svg|webp|gif|ico)(?=["')?])/g;

function extraerPublicos(texto) {
  return new Set([...texto.matchAll(RE_PUBLICOS)].map((m) => m[0].slice(1)));
}

const RE_URL_CSS = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;

// `base`: ruta del CSS que se está leyendo, para resolver sus url(../media/...) relativas.
function extraerEstaticos(texto, base) {
  const encontrados = new Set();
  if (base && base.endsWith('.css')) {
    for (const m of texto.matchAll(RE_URL_CSS)) {
      if (m[1].startsWith('data:')) continue;
      const ruta = new URL(m[1], self.location.origin + base).pathname;
      if (ruta.startsWith('/_next/static/')) encontrados.add(ruta);
    }
  }
  for (const m of texto.matchAll(RE_ESTATICOS)) {
    let ruta = m[0].replace(/^\/_next\//, '');
    ruta = '/_next/' + ruta.replace(/[.]+$/, '');
    if (/\.(js|css|woff2?|ttf|otf|png|jpe?g|svg|gif|webp|ico)$/.test(ruta)) encontrados.add(ruta);
  }
  return encontrados;
}

async function precargar({ rutas, moldes }, avisar) {
  moldesEnMemoria = moldes || [];
  const meta = await caches.open(CACHE_META);
  await meta.put('/__arifa/moldes.json', new Response(JSON.stringify(moldesEnMemoria), { headers: { 'Content-Type': 'application/json' } }));

  const cachePaginas = await caches.open(CACHE_PAGINAS);
  const cacheEstaticos = await caches.open(CACHE_ESTATICOS);
  const urls = [...new Set([...(rutas || []), ...moldesEnMemoria.map((m) => m.url)])];
  const pendientes = new Set();
  const publicos = new Set();
  let hechas = 0;
  let fallas = 0;
  const total = () => urls.length + pendientes.size;

  // Páginas
  await enParalelo(urls, 4, async (ruta) => {
    try {
      const resp = await fetch(ruta, { credentials: 'same-origin', cache: 'no-store' });
      if (resp.ok && esHTML(resp)) {
        const texto = await resp.clone().text();
        await cachePaginas.put(self.location.origin + ruta, resp);
        extraerEstaticos(texto).forEach((r) => pendientes.add(r));
        extraerPublicos(texto).forEach((r) => publicos.add(r));
      } else fallas++;
    } catch { fallas++; }
    avisar({ hechas: ++hechas, total: total() });
  });

  // Archivos de Next que usan esas páginas, y los que cargan esos archivos (imports dinámicos,
  // fuentes del CSS, etc.).
  const vistos = new Set();
  while (pendientes.size) {
    const lote = [...pendientes].filter((r) => !vistos.has(r));
    pendientes.clear();
    lote.forEach((r) => vistos.add(r));
    await enParalelo(lote, 6, async (ruta) => {
      try {
        let resp = await cacheEstaticos.match(ruta);
        if (!resp) {
          const red = await fetch(ruta);
          if (!red.ok) { fallas++; return; }
          await cacheEstaticos.put(ruta, red.clone());
          resp = red;
        }
        if (/\.(js|css)$/.test(ruta)) {
          const texto = await resp.text();
          extraerEstaticos(texto, ruta).forEach((r) => { if (!vistos.has(r)) pendientes.add(r); });
          extraerPublicos(texto).forEach((r) => publicos.add(r));
        }
      } catch { fallas++; }
      avisar({ hechas: ++hechas, total: urls.length + vistos.size + pendientes.size });
    });
  }

  await enParalelo([...publicos], 6, async (ruta) => {
    try {
      const resp = await fetch(ruta);
      if (resp.ok) await cacheEstaticos.put(ruta, resp);
    } catch { /* una imagen que falta no impide usar la app */ }
  });

  // Los archivos de versiones anteriores que ya no usa ninguna página se borran.
  if (!fallas) {
    for (const req of await cacheEstaticos.keys()) {
      const ruta = new URL(req.url).pathname;
      if (ruta.startsWith('/_next/static/') && !vistos.has(ruta)) await cacheEstaticos.delete(req);
    }
  }
  return fallas;
}

async function enParalelo(items, cantidad, fn) {
  let i = 0;
  const trabajador = async () => { while (i < items.length) await fn(items[i++]); };
  await Promise.all(Array.from({ length: Math.min(cantidad, items.length) }, trabajador));
}

self.addEventListener('message', (event) => {
  const datos = event.data || {};
  if (datos.tipo !== 'ARIFA_PRECARGAR' || MODO_DEV) return;
  const puerto = event.ports && event.ports[0];
  const avisar = (m) => { try { puerto && puerto.postMessage(m); } catch { /* ok */ } };
  event.waitUntil(
    precargar(datos, avisar)
      .then((fallas) => avisar({ terminado: true, error: fallas > 0 }))
      .catch(() => avisar({ terminado: true, error: true }))
  );
});

// ── Fotos sacadas sin conexión (IndexedDB "arifa-offline", ver src/lib/offline.ts) ──

function idArchivoOffline(texto) {
  return (texto.split(PREFIJO_ARCHIVO_OFFLINE)[1] || '').split(/[?#/]/)[0];
}

function leerArchivoOffline(id) {
  return new Promise((resolve) => {
    const abrir = indexedDB.open('arifa-offline', 1);
    abrir.onupgradeneeded = () => {
      const d = abrir.result;
      if (!d.objectStoreNames.contains('archivos')) d.createObjectStore('archivos', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('borrados')) d.createObjectStore('borrados', { keyPath: 'id' });
    };
    abrir.onerror = () => resolve(null);
    abrir.onsuccess = () => {
      try {
        const get = abrir.result.transaction('archivos', 'readonly').objectStore('archivos').get(id);
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => resolve(null);
      } catch { resolve(null); }
    };
  });
}

async function servirArchivoOffline(id, req) {
  const registro = await leerArchivoOffline(id);
  if (registro && registro.blob) {
    return new Response(registro.blob, { headers: { 'Content-Type': registro.tipo || 'application/octet-stream' } });
  }
  if (registro && registro.url) {
    if (req && req.mode === 'no-cors') return Response.redirect(registro.url, 302);
    return proxyImagen(new URL('/api/proxy-image?url=' + encodeURIComponent(registro.url), self.location.origin));
  }
  return new Response('Archivo no disponible', { status: 404 });
}

async function proxyImagen(url) {
  const original = url.searchParams.get('url') || '';
  if (original.includes(PREFIJO_ARCHIVO_OFFLINE)) return servirArchivoOffline(idArchivoOffline(original));
  const req = new Request(url.toString());
  try {
    return await redPrimero(req, CACHE_ARCHIVOS);
  } catch {
    return new Response('Sin conexión', { status: 504 });
  }
}
