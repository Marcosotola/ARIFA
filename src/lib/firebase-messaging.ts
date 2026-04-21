import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { app } from "./firebase";

// VAPID key from Firebase Console > Project Settings > Cloud Messaging
// You need to generate this in Firebase Console
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

export async function getMessagingInstance() {
  if (typeof window === "undefined") return null;

  const supported = await isSupported();
  if (!supported) return null;

  if (!messagingInstance && app) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission denied");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });

    return token;
  } catch (error) {
    console.error("Error getting notification token:", error);
    return null;
  }
}

export async function onForegroundMessage(callback: (payload: any) => void) {
  const messaging = await getMessagingInstance();
  if (!messaging) return;
  onMessage(messaging, callback);
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}
