"use client";
import { useState, useCallback, useEffect, useRef } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({ message: "", type: "info", visible: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type, visible: true });
    timerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { toast, showToast };
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "#f0fdf4", border: "#16a34a", icon: "✓" },
  error:   { bg: "#fff1f2", border: "#dc2626", icon: "✕" },
  info:    { bg: "#eff6ff", border: "#2563eb", icon: "ℹ" },
};

export function Toast({ message, type, visible }: ToastState) {
  const c = COLORS[type];
  return (
    <div style={{
      position: "fixed", bottom: "28px", right: "28px", zIndex: 9999,
      display: "flex", alignItems: "center", gap: "12px",
      background: c.bg, border: `1.5px solid ${c.border}`,
      borderRadius: "10px", padding: "14px 20px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.13)",
      maxWidth: "380px", minWidth: "220px",
      fontSize: "0.92rem", fontWeight: 600, color: "#1a1a1a",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(16px)",
      pointerEvents: visible ? "auto" : "none",
      transition: "opacity 0.22s ease, transform 0.22s ease",
    }}>
      <span style={{
        width: "24px", height: "24px", borderRadius: "50%",
        background: c.border, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.8rem", fontWeight: 900, flexShrink: 0,
      }}>{c.icon}</span>
      {message}
    </div>
  );
}
