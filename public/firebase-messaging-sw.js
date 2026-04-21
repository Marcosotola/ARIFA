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

// PWA Cache Strategy (Offline support)
const CACHE_NAME = 'arifa-v1';
const OFFLINE_URL = '/';

// Cache essential assets on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/logos/192x192.png',
        '/logos/favicon.png',
      ]);
    })
  );
  self.skipWaiting();
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy for pages, cache-first for static assets
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Firebase and external requests
  const url = new URL(event.request.url);
  if (!url.origin.includes(self.location.origin)) return;

  // Skip API routes
  if (url.pathname.startsWith('/api/')) return;

  // For navigation requests, use network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // For static assets, use cache-first
  if (
    url.pathname.startsWith('/logos/') ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
