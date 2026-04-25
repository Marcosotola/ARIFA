"use client";
import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "@/lib/firebase-messaging";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Props {
  variant?: "header" | "sidebar" | "mobile";
}

export default function PWAInstallButton({ variant = "header" }: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showButton, setShowButton] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    const wasDismissed = sessionStorage.getItem("pwa-banner-dismissed");
    if (wasDismissed) setDismissed(true);

    const iosDevice = isIOS();
    setIos(iosDevice);

    if (iosDevice) {
      setShowButton(true);
      setTimeout(() => { if (!wasDismissed) setShowBanner(true); }, 3000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
      if (!wasDismissed) setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowButton(false);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    const fallbackTimer = setTimeout(() => {
      if (!isStandalone()) setShowButton(true);
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (ios) { setShowIOSModal(true); return; }

    if (!deferredPrompt) {
      alert("Para instalar ARIFA:\n\nChrome/Edge: Buscá el ícono de instalación (⊕) en la barra de direcciones.");
      return;
    }

    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setShowButton(false);
      setShowBanner(false);
      
      const { requestNotificationPermission } = await import("@/lib/firebase-messaging");
      const token = await requestNotificationPermission();
      if (token) {
        const { auth, db } = await import("@/lib/firebase");
        if (auth.currentUser) {
          const { updateDoc, doc } = await import("firebase/firestore");
          await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { fcmToken: token });
        }
      }
    }
    setInstalling(false);
    setDeferredPrompt(null);
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-banner-dismissed", "true");
  };

  if (isInstalled || !showButton) return null;

  // Variant Styles
  const isTopBar = variant === "header";
  
  const buttonStyle: React.CSSProperties = isTopBar ? {
    background: "rgba(255,255,255,0.15)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "0.7rem",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "0.2s"
  } : {
    background: "linear-gradient(135deg, #1a3a6b 0%, #2563eb 100%)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "12px 20px",
    fontSize: "0.85rem",
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 4px 15px rgba(37,99,235,0.3)",
    width: "100%",
    transition: "0.2s"
  };

  return (
    <>
      <button onClick={handleInstall} style={buttonStyle} className="pwa-trigger">
        <svg width={isTopBar ? "12" : "16"} height={isTopBar ? "12" : "16"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>{installing ? "..." : isTopBar ? "INSTALAR APP" : "Instalar Aplicación"}</span>
      </button>

      {/* Floating Banner */}
      {showBanner && !dismissed && (
        <div style={{
          position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", zIndex: 9000,
          background: "linear-gradient(135deg, #0f2447 0%, #1a3a6b 100%)", color: "#fff", borderRadius: "16px",
          padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          maxWidth: "420px", width: "calc(100vw - 40px)", animation: "bannerSlideUp 0.4s ease"
        }}>
          <img src="/logos/192x192.png" alt="ARIFA" style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#fff", padding: "4px" }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: "0.9rem" }}>Instalar ARIFA</p>
            <p style={{ margin: "3px 0 0", fontSize: "0.75rem", opacity: 0.75 }}>Acceso rápido y uso sin conexión</p>
          </div>
          <button onClick={handleInstall} style={{ background: "#fff", color: "#1a3a6b", border: "none", borderRadius: "10px", padding: "9px 16px", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer" }}>
            {ios ? "Ver cómo" : "Instalar"}
          </button>
          <button onClick={handleDismissBanner} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "1.2rem", cursor: "pointer" }}>×</button>
        </div>
      )}

      {/* iOS Modal */}
      {showIOSModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "20px" }} onClick={(e) => e.target === e.currentTarget && setShowIOSModal(false)}>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "30px", maxWidth: "420px", width: "100%", boxShadow: "0 -10px 40px rgba(0,0,0,0.3)", position: "relative" }}>
            <button onClick={() => setShowIOSModal(false)} style={{ position: "absolute", top: "15px", right: "20px", background: "none", border: "none", fontSize: "1.5rem", color: "#666" }}>×</button>
            <div style={{ textAlign: "center", marginBottom: "25px" }}>
              <img src="/logos/192x192.png" alt="ARIFA" style={{ width: "64px", height: "64px", borderRadius: "14px", marginBottom: "12px" }} />
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1a3a6b", margin: 0 }}>Instalar ARIFA en iPhone</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[ { s: "1", e: "⬆️", t: "Tocá 'Compartir' en Safari" }, { s: "2", e: "➕", t: "Tocá 'Agregar a pantalla de inicio'" }, { s: "3", e: "✅", t: "Tocá 'Agregar'. ¡Listo!" } ].map(x => (
                <div key={x.s} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f0f4ff", borderRadius: "12px", padding: "12px" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#1a3a6b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.75rem" }}>{x.s}</div>
                  <span style={{ fontSize: "1.1rem" }}>{x.e}</span>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#333" }}>{x.t}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowIOSModal(false)} style={{ marginTop: "20px", width: "100%", padding: "14px", background: "linear-gradient(135deg, #1a3a6b, #2563eb)", color: "#fff", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer" }}>Entendido</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .pwa-trigger:hover { transform: translateY(-1px); filter: brightness(1.1); }
        @keyframes bannerSlideUp { from { transform: translateX(-50%) translateY(80px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
      `}</style>
    </>
  );
}
