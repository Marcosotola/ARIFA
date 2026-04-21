"use client";
import { useEffect } from "react";

export default function PWAProvider() {
  useEffect(() => {
    // Register the Firebase Messaging Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js", { scope: "/" })
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
