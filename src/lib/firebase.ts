import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isFirebaseConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "";

// En el navegador los datos quedan guardados en el dispositivo (IndexedDB): la app se puede
// usar sin conexión y lo que se guarda offline se sube solo cuando vuelve la señal.
function iniciarFirestore(firebaseApp: any) {
  if (typeof window === "undefined") return getFirestore(firebaseApp);
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      }),
    });
  } catch {
    // Ya inicializado (recarga en caliente en desarrollo).
    return getFirestore(firebaseApp);
  }
}

// Initialize Firebase (Safely)
let auth: any;
let db: any;
let storage: any;
let app: any;

if (isFirebaseConfigured) {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = iniciarFirestore(app);
  storage = getStorage(app);
  // Sin señal no tiene sentido reintentar 10 minutos: a los 60 s la foto pasa a la cola offline.
  storage.maxUploadRetryTime = 60000;
  storage.maxOperationRetryTime = 30000;
} else {
  // Mock objects or handle missing config gracefully
  console.warn("Firebase: API Key missing. Please check your .env.local file.");
  // Provide dummy objects to prevent immediate crashes in components
  auth = { onAuthStateChanged: () => () => {} };
  db = {};
  storage = {};
}

export { app, auth, db, storage, isFirebaseConfigured };
