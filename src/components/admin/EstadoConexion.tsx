"use client";
import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { escucharEstadoOffline, type EstadoOffline } from "@/lib/offline";

function useEstadoOffline() {
  const [estado, setEstado] = useState<EstadoOffline | null>(null);
  useEffect(() => escucharEstadoOffline(setEstado), []);
  return estado;
}

// Aviso arriba del contenido: sin conexión, o con cambios que todavía no se subieron.
export function AvisoConexion() {
  const e = useEstadoOffline();
  if (!e) return null;
  const pendientes = e.escriturasPendientes || e.archivosPendientes > 0;

  if (!e.online) {
    return (
      <div style={{ ...avisoSt, background: "#fff7ed", borderColor: "#fdba74", color: "#9a3412" }}>
        <CloudOff size={18} style={{ flexShrink: 0 }} />
        <span>
          <b>Sin conexión.</b> Podés seguir trabajando: lo que guardes queda en este dispositivo y se sube solo cuando vuelva la señal.
          {e.archivosPendientes > 0 && ` (${e.archivosPendientes} archivo${e.archivosPendientes !== 1 ? "s" : ""} sin subir)`}
        </span>
      </div>
    );
  }
  if (pendientes) {
    return (
      <div style={{ ...avisoSt, background: "#eff6ff", borderColor: "#93c5fd", color: "#1e40af" }}>
        <RefreshCw size={18} style={{ flexShrink: 0 }} className="arifa-girando" />
        <span>Subiendo los cambios hechos sin conexión… No cierres la app hasta que termine.</span>
        <style>{`@keyframes arifa-girar { to { transform: rotate(360deg); } } .arifa-girando { animation: arifa-girar 1.2s linear infinite; }`}</style>
      </div>
    );
  }
  return null;
}

const avisoSt: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "8px",
  border: "1px solid", fontSize: "0.88rem", lineHeight: 1.4, marginBottom: "20px",
};
