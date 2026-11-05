"use client";
import { useEffect, useRef, useState } from "react";
import { X, Keyboard } from "lucide-react";

// Lector de códigos de barras con la cámara del celular.
// Usa el lector que trae el navegador (Chrome en Android) y, si no hay (iPhone, Firefox),
// carga ZXing, que viene incluido en la app y funciona sin conexión.

const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar", "qr_code"];

// Saca espacios y pasa a mayúsculas, para comparar códigos cargados a mano con los escaneados.
export const normalizarCodigo = (c?: string | null) => (c || "").replace(/\s+/g, "").toUpperCase();

type Lector = (video: HTMLVideoElement) => Promise<string | null>;

async function crearLector(): Promise<Lector> {
  const BD = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
  if (BD) {
    try {
      const soportados: string[] = await BD.getSupportedFormats();
      const formatos = FORMATOS.filter(f => soportados.includes(f));
      if (formatos.length) {
        const detector = new BD({ formats: formatos });
        return async (video) => {
          const res = await detector.detect(video);
          return res[0]?.rawValue || null;
        };
      }
    } catch { /* se usa ZXing */ }
  }
  const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
    import("@zxing/browser"), import("@zxing/library"),
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.ITF,
    BarcodeFormat.CODABAR, BarcodeFormat.QR_CODE,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints);
  return async (video) => {
    try { return reader.decode(video).getText() || null; }
    catch { return null; } // no encontró código en este cuadro
  };
}

function mensajeError(e: unknown): string {
  const nombre = (e as { name?: string })?.name;
  if (nombre === "NotAllowedError" || nombre === "SecurityError") return "No hay permiso para usar la cámara. Habilitalo en la configuración del navegador para este sitio.";
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") return "No se encontró una cámara en este dispositivo.";
  if (nombre === "NotReadableError") return "La cámara está siendo usada por otra aplicación.";
  return "No se pudo abrir la cámara.";
}

export default function EscanerCodigo({ titulo = "Escanear código", onDetectado, onCerrar }: {
  titulo?: string;
  onDetectado: (codigo: string) => void;
  onCerrar: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [manual, setManual] = useState(false);
  const [codigoManual, setCodigoManual] = useState("");
  const onDetectadoRef = useRef(onDetectado);
  useEffect(() => { onDetectadoRef.current = onDetectado; }, [onDetectado]);

  useEffect(() => {
    let activo = true;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar la cámara (la app tiene que abrirse con https).");
        setManual(true);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!activo) { stream.getTracks().forEach(t => t.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        const leer = await crearLector();
        if (!activo) return;
        setListo(true);
        const ciclo = async () => {
          if (!activo) return;
          let codigo: string | null = null;
          if (video.readyState >= 2) codigo = await leer(video).catch(() => null);
          if (!activo) return;
          if (codigo) {
            activo = false;
            try { navigator.vibrate?.(80); } catch { /* ok */ }
            stream?.getTracks().forEach(t => t.stop());
            onDetectadoRef.current(codigo.trim());
            return;
          }
          timer = setTimeout(ciclo, 150);
        };
        ciclo();
      } catch (e) {
        console.error(e);
        if (activo) { setError(mensajeError(e)); setManual(true); }
      }
    })();

    return () => {
      activo = false;
      clearTimeout(timer);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const enviarManual = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // que no envíe el formulario de abajo
    const c = codigoManual.trim();
    if (c) onDetectado(c);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "460px", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--primary-blue)" }}>{titulo}</h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}><X size={22} /></button>
        </div>

        {!error && (
          <div style={{ position: "relative", background: "#000", aspectRatio: "4/3" }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", left: "10%", right: "10%", top: "32%", bottom: "32%", border: "3px solid rgba(255,255,255,0.9)", borderRadius: "10px", boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: "2px", background: "#ef4444" }} />
            </div>
            {!listo && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>Abriendo cámara...</div>}
          </div>
        )}

        <div style={{ padding: "14px 18px 18px" }}>
          {error ? (
            <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "12px", borderRadius: "10px", fontSize: "0.85rem", fontWeight: 600, marginBottom: "12px" }}>{error}</div>
          ) : (
            <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "#666", textAlign: "center" }}>Poné el código de barras dentro del recuadro. Se lee solo.</p>
          )}
          {manual ? (
            <form onSubmit={enviarManual} style={{ display: "flex", gap: "8px" }}>
              <input autoFocus value={codigoManual} onChange={e => setCodigoManual(e.target.value)} placeholder="Escribí el código"
                style={{ flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1.5px solid #ddd", fontSize: "0.95rem", outline: "none", minWidth: 0 }} />
              <button type="submit" className="btn-blue" style={{ padding: "10px 16px", borderRadius: "8px" }}>OK</button>
            </form>
          ) : (
            <button type="button" onClick={() => setManual(true)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <Keyboard size={16} /> Escribir el código a mano
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
