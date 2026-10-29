"use client";
import { useEffect } from "react";

export default function PWAProvider() {
  useEffect(() => {
    // Register the Firebase Messaging Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        // En desarrollo los archivos de Next cambian sin cambiar de nombre: el SW no guarda nada.
        .register(process.env.NODE_ENV === "development" ? "/firebase-messaging-sw.js?dev=1" : "/firebase-messaging-sw.js", { scope: "/" })
        .then((registration) => {
          console.log("[PWA] Service Worker registered:", registration.scope);
        })
        .catch((err) => {
          console.error("[PWA] Service Worker registration failed:", err);
        });
    }
  }, []);

  return null;
}
