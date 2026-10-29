"use client";
import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2, DownloadCloud } from "lucide-react";
import { escucharEstadoOffline, type EstadoOffline } from "@/lib/offline";
import { prepararModoOffline } from "@/lib/precargaOffline";

function useEstadoOffline() {
  const [estado, setEstado] = useState<EstadoOffline | null>(null);
  useEffect(() => escucharEstadoOffline(setEstado), []);
  return estado;
}

const formatoFecha = (ms: number) =>
  new Date(ms).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

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

// Bloque del menú lateral: cuándo se descargó la app para usar sin conexión y botón para actualizar.
export function ModoOfflineSidebar({ datos }: { datos: boolean }) {
  const e = useEstadoOffline();
  if (!e) return null;
  const listo = !!e.preparadoEn;

  return (
    <div style={{ padding: "10px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", marginBottom: "10px", fontSize: "0.78rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, marginBottom: "4px" }}>
        {e.online
          ? (listo ? <CheckCircle2 size={16} color="#4ade80" /> : <DownloadCloud size={16} color="#fbbf24" />)
          : <CloudOff size={16} color="#fb923c" />}
        {e.online ? "Uso sin conexión" : "Sin conexión"}
      </div>
      <div style={{ opacity: 0.7, marginBottom: e.online ? "8px" : 0 }}>
        {e.preparando
          ? `${e.preparando}…`
          : listo
            ? `Datos descargados: ${formatoFecha(e.preparadoEn!)}`
            : "Todavía no se descargaron los datos en este dispositivo."}
      </div>
      {e.online && (
        <button
          type="button"
          disabled={!!e.preparando}
          onClick={() => prepararModoOffline({ forzar: true, datos })}
          style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#fff", fontWeight: 600, fontSize: "0.78rem", cursor: e.preparando ? "default" : "pointer", opacity: e.preparando ? 0.6 : 1 }}
        >
          {e.preparando ? "Descargando…" : "Actualizar datos ahora"}
        </button>
      )}
    </div>
  );
}

const avisoSt: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "8px",
  border: "1px solid", fontSize: "0.88rem", lineHeight: 1.4, marginBottom: "20px",
};
