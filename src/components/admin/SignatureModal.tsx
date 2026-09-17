"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { X, RotateCcw, Check } from "lucide-react";

const SignatureCanvas = dynamic(() => import("react-signature-canvas"), { ssr: false }) as any;

interface SignatureModalProps {
  open: boolean;
  title?: string;
  penColor?: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

export default function SignatureModal({ open, title = "Firma", penColor = "#002244", onClose, onSave }: SignatureModalProps) {
  const sigRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    const resetSignatureState = () => setIsEmpty(true);
    resetSignatureState();

    const updateSize = () => {
      if (containerRef.current) {
        setCanvasSize({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      window.removeEventListener("resize", updateSize);
    };
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 2000, display: "flex", flexDirection: "column", touchAction: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)" }}>{title}</h3>
        <button
          type="button"
          onClick={onClose}
          style={{ background: "#f1f5f9", border: "none", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
        >
          <X size={18} />
        </button>
      </div>

      <p style={{ margin: "10px 20px 0", fontSize: "0.75rem", color: "#999", flexShrink: 0 }}>Firmá con el dedo o lápiz táctil en el recuadro.</p>

      <div
        ref={containerRef}
        style={{ flex: 1, margin: "12px 20px", border: "2px dashed #ddd", borderRadius: "12px", background: "#fcfcfc", overflow: "hidden", touchAction: "none" }}
      >
        {canvasSize.width > 0 && (
          <SignatureCanvas
            ref={sigRef}
            penColor={penColor}
            onEnd={() => setIsEmpty(false)}
            canvasProps={{
              width: canvasSize.width,
              height: canvasSize.height,
              style: { display: "block", touchAction: "none" }
            }}
          />
        )}
      </div>

      <div style={{ display: "flex", gap: "10px", padding: "16px 20px", borderTop: "1px solid #eee", flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => { sigRef.current?.clear(); setIsEmpty(true); }}
          style={{ flex: 1, padding: "16px", borderRadius: "12px", border: "1px solid #ddd", background: "#fff", color: "#ef4444", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          <RotateCcw size={16} /> Borrar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isEmpty}
          className="btn-red"
          style={{ flex: 2, padding: "16px", borderRadius: "12px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", textTransform: "uppercase", opacity: isEmpty ? 0.5 : 1, cursor: isEmpty ? "not-allowed" : "pointer" }}
        >
          <Check size={18} /> Confirmar firma
        </button>
      </div>
    </div>
  );
}
