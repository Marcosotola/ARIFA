"use client";
import { useState } from "react";
import { Share2, QrCode, X, Download, Copy, Check } from "lucide-react";

const APP_URL = "https://arifa.com.ar";

interface Props {
  variant?: "sidebar" | "mobile";
}

export default function ShareAppButton({ variant = "sidebar" }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const openModal = async () => {
    setShowModal(true);
    setQrDataUrl(null);
    const QRCode = (await import("qrcode")).default;
    const dataUrl = await QRCode.toDataURL(APP_URL, { width: 300, margin: 2, errorCorrectionLevel: "H", color: { dark: "#002244", light: "#ffffff" } });
    setQrDataUrl(dataUrl);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(APP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "arifa-qr.png";
    a.click();
  };

  const buttonStyle: React.CSSProperties = variant === "sidebar" ? {
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "10px",
    padding: "12px 20px",
    fontSize: "0.85rem",
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    marginTop: "8px",
    transition: "0.2s"
  } : {
    background: "#f1f5f9",
    color: "#1a3a6b",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "12px 20px",
    fontSize: "0.85rem",
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    marginTop: "10px",
    transition: "0.2s"
  };

  return (
    <>
      <button onClick={openModal} style={buttonStyle}>
        <Share2 size={16} />
        <span>Compartir Aplicación</span>
      </button>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "380px", overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ background: "var(--primary-blue)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <QrCode size={22} color="#fff" />
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: "1rem" }}>Compartir ARIFA</div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>Escaneá para acceder</div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "24px", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "290px", background: "#f8fafc", borderRadius: "12px", border: "2px dashed #e2e8f0", marginBottom: "16px" }}>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code ARIFA" style={{ width: "260px", height: "260px" }} />
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Generando QR...</div>
                )}
              </div>

              <div style={{ background: "#f1f5f9", borderRadius: "8px", padding: "10px 14px", marginBottom: "20px", fontSize: "0.8rem", color: "#64748b", fontFamily: "monospace" }}>
                {APP_URL}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={handleDownload} disabled={!qrDataUrl} className="btn-blue"
                  style={{ flex: 1, padding: "12px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontWeight: 700, opacity: qrDataUrl ? 1 : 0.5, border: "none", cursor: qrDataUrl ? "pointer" : "default" }}>
                  <Download size={18} /> Descargar PNG
                </button>
                <button onClick={handleCopy}
                  style={{ padding: "12px 16px", borderRadius: "8px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  title="Copiar link">
                  {copied ? <Check size={18} color="#16a34a" /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
