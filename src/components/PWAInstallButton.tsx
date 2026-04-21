"use client";
import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "@/lib/firebase-messaging";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWAInstallButton
 *
 * Behavior:
 * - Already installed (standalone) → hidden
 * - iOS → always shows button → clicking opens iOS instructions modal
 * - Android/Windows + prompt captured → shows button, clicking triggers native prompt
 * - Android/Windows + prompt NOT captured yet (dev / delay) → shows button with hint
 *   to use the browser's address bar install icon
 * - Firefox / unsupported → hidden
 */

function canInstallPWA(): boolean {
  if (typeof window === "undefined") return false;
  // Chrome, Edge, Samsung Browser, Opera, Brave — all support PWA installs
  const ua = navigator.userAgent;
  const isChromium =
    /Chrome\//.test(ua) && !/Edg\//.test(ua)
      ? true
      : /Edg\//.test(ua)
      ? true
      : /SamsungBrowser/.test(ua)
      ? true
      : /OPR\//.test(ua)
      ? true
      : false;
  return isChromium || isIOS();
}

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showButton, setShowButton] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    // Check if user previously dismissed the banner
    const wasDismissed = sessionStorage.getItem("pwa-banner-dismissed");
    if (wasDismissed) {
      setDismissed(true);
    }

    const iosDevice = isIOS();
    setIos(iosDevice);

    if (iosDevice) {
      // iOS always shows the button (no native prompt available)
      setShowButton(true);
      // Show floating banner after 3s
      setTimeout(() => {
        if (!wasDismissed) setShowBanner(true);
      }, 3000);
      return;
    }

    // For Chromium-based browsers: listen for the prompt
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

    // Fallback: if browser supports PWA but prompt hasn't fired in 2s
    // (common in dev or when criteria aren't fully met yet)
    const fallbackTimer = setTimeout(() => {
      if (canInstallPWA() && !isStandalone()) {
        setShowButton(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (ios) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) {
      // Prompt not available: guide user to use browser's address bar icon
      alert(
        "Para instalar ARIFA:\n\n" +
          "• Chrome: hacé clic en el ícono ⊕ o ⬇️ que aparece al final de la barra de direcciones\n" +
          "• Edge: hacé clic en el ícono ⊕ al final de la barra de direcciones\n\n" +
          "Si no ves el ícono, intentá recargar la página o accedé desde tu teléfono."
      );
      return;
    }

    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
      setShowButton(false);
      setShowBanner(false);
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

  return (
    <>
      {/* ── Inline button (in Header) ── */}
      <button
        id="pwa-install-btn"
        onClick={handleInstall}
        title="Instalar la app ARIFA"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "linear-gradient(135deg, #1a3a6b 0%, #2563eb 100%)",
          color: "#fff",
          border: "none",
          borderRadius: "50px",
          padding: "10px 20px",
          fontSize: "0.85rem",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 15px rgba(37,99,235,0.4)",
          transition: "transform 0.2s, box-shadow 0.2s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform =
            "translateY(-2px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 6px 20px rgba(37,99,235,0.5)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform =
            "translateY(0)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 4px 15px rgba(37,99,235,0.4)";
        }}
      >
        <svg
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        {installing ? "Instalando..." : "Instalar App"}
      </button>

      {/* ── Floating bottom banner ── */}
      {showBanner && !dismissed && (
        <div
          id="pwa-install-banner"
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9000,
            background: "linear-gradient(135deg, #0f2447 0%, #1a3a6b 100%)",
            color: "#fff",
            borderRadius: "16px",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
            maxWidth: "420px",
            width: "calc(100vw - 40px)",
            animation: "bannerSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/192x192.png"
            alt="ARIFA"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              flexShrink: 0,
              objectFit: "contain",
              background: "#fff",
              padding: "4px",
            }}
          />

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontWeight: 800,
                fontSize: "0.9rem",
                lineHeight: 1.3,
              }}
            >
              Instalar ARIFA
            </p>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: "0.75rem",
                opacity: 0.75,
                lineHeight: 1.3,
              }}
            >
              {ios
                ? "Agregá la app a tu pantalla de inicio"
                : "Acceso rápido y uso sin conexión"}
            </p>
          </div>

          {/* Install button */}
          <button
            onClick={handleInstall}
            style={{
              background: "#fff",
              color: "#1a3a6b",
              border: "none",
              borderRadius: "10px",
              padding: "9px 16px",
              fontWeight: 800,
              fontSize: "0.82rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {ios ? "Ver cómo" : "Instalar"}
          </button>

          {/* Dismiss */}
          <button
            onClick={handleDismissBanner}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              fontSize: "1.2rem",
              cursor: "pointer",
              lineHeight: 1,
              padding: "4px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
            }}
            title="Cerrar"
          >
            ×
          </button>
        </div>
      )}

      {/* ── iOS Instructions Modal ── */}
      {showIOSModal && (
        <div
          id="ios-install-modal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowIOSModal(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px",
              padding: "30px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
              animation: "slideUp 0.3s ease",
              position: "relative",
            }}
          >
            {/* Close */}
            <button
              onClick={() => setShowIOSModal(false)}
              style={{
                position: "absolute",
                top: "15px",
                right: "20px",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#666",
              }}
            >
              ×
            </button>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "25px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/192x192.png"
                alt="ARIFA"
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "14px",
                  marginBottom: "12px",
                  objectFit: "contain",
                }}
              />
              <h2
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  color: "#1a3a6b",
                  margin: 0,
                }}
              >
                Instalar ARIFA en iPhone
              </h2>
              <p
                style={{ color: "#666", fontSize: "0.85rem", marginTop: "6px" }}
              >
                Seguí estos pasos para agregar la app a tu pantalla de inicio
              </p>
            </div>

            {/* Steps */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {[
                {
                  step: "1",
                  emoji: "⬆️",
                  text: (
                    <>
                      Tocá el botón <strong>Compartir</strong> en la barra
                      inferior del Safari
                    </>
                  ),
                },
                {
                  step: "2",
                  emoji: "➕",
                  text: (
                    <>
                      Desplazá hacia abajo y tocá{" "}
                      <strong>&quot;Agregar a pantalla de inicio&quot;</strong>
                    </>
                  ),
                },
                {
                  step: "3",
                  emoji: "✅",
                  text: (
                    <>
                      Tocá <strong>&quot;Agregar&quot;</strong> en la esquina
                      superior derecha. ¡Listo!
                    </>
                  ),
                },
              ].map(({ step, emoji, text }) => (
                <div
                  key={step}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    background: "#f0f4ff",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      minWidth: "32px",
                      borderRadius: "50%",
                      background: "#1a3a6b",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "0.9rem",
                    }}
                  >
                    {step}
                  </div>
                  <span style={{ fontSize: "1.3rem" }}>{emoji}</span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.88rem",
                      color: "#333",
                      lineHeight: 1.5,
                    }}
                  >
                    {text}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              style={{
                marginTop: "20px",
                width: "100%",
                padding: "14px",
                background: "linear-gradient(135deg, #1a3a6b, #2563eb)",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(60px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes bannerSlideUp {
          from { transform: translateX(-50%) translateY(80px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
