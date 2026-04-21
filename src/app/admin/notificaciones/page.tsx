"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  query,
  limit,
} from "firebase/firestore";

interface Usuario {
  uid: string;
  email: string;
  nombre?: string;
  rol?: string;
  fcmToken?: string;
}

interface NotificacionEnviada {
  id: string;
  titulo: string;
  cuerpo: string;
  tipo: "general" | "usuario";
  destinatarioEmail?: string;
  destinatarioUid?: string;
  estado: "enviada" | "error" | "pendiente";
  creadaEn: any;
}

export default function NotificacionesPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [historial, setHistorial] = useState<NotificacionEnviada[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [tab, setTab] = useState<"general" | "usuario">("general");
  const [mensaje, setMensaje] = useState({ titulo: "", cuerpo: "", url: "" });
  const [destinatario, setDestinatario] = useState<Usuario | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Load users with FCM tokens
        const usersSnap = await getDocs(collection(db, "usuarios"));
        const list: Usuario[] = [];
        usersSnap.forEach((d) => {
          list.push({ uid: d.id, ...d.data() } as Usuario);
        });
        setUsuarios(list);

        // Load notification history
        const histSnap = await getDocs(
          query(
            collection(db, "notificaciones_enviadas"),
            orderBy("creadaEn", "desc"),
            limit(50)
          )
        );
        const hist: NotificacionEnviada[] = [];
        histSnap.forEach((d) => {
          hist.push({ id: d.id, ...d.data() } as NotificacionEnviada);
        });
        setHistorial(hist);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleEnviar = async () => {
    if (!mensaje.titulo.trim() || !mensaje.cuerpo.trim()) {
      setFeedback({ tipo: "error", texto: "El título y el cuerpo son obligatorios." });
      return;
    }
    if (tab === "usuario" && !destinatario) {
      setFeedback({ tipo: "error", texto: "Seleccioná un usuario destinatario." });
      return;
    }

    setEnviando(true);
    setFeedback(null);

    try {
      // Save to Firestore — the backend (Cloud Function) picks this up and sends via FCM
      const notifData: any = {
        titulo: mensaje.titulo.trim(),
        cuerpo: mensaje.cuerpo.trim(),
        tipo: tab,
        actionUrl: mensaje.url.trim() || "/admin",
        estado: "pendiente",
        creadaEn: serverTimestamp(),
      };

      if (tab === "usuario" && destinatario) {
        notifData.destinatarioUid = destinatario.uid;
        notifData.destinatarioEmail = destinatario.email;
        notifData.fcmToken = destinatario.fcmToken || null;
      }

      const docRef = await addDoc(collection(db, "notificaciones_enviadas"), notifData);

      // If there's a direct FCM token for individual user, call our API
      if (tab === "usuario" && destinatario?.fcmToken) {
        const res = await fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: destinatario.fcmToken,
            title: mensaje.titulo,
            body: mensaje.cuerpo,
            data: { actionUrl: mensaje.url || "/admin", notifId: docRef.id },
          }),
        });
        if (!res.ok) throw new Error("API error");
      } else if (tab === "general") {
        // For general: call API to send to all tokens (topic or multicast)
        await fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: "general",
            title: mensaje.titulo,
            body: mensaje.cuerpo,
            data: { actionUrl: mensaje.url || "/", notifId: docRef.id },
          }),
        });
      }

      setFeedback({ tipo: "ok", texto: "✓ Notificación enviada correctamente." });
      setMensaje({ titulo: "", cuerpo: "", url: "" });
      setDestinatario(null);

      // Refresh history
      const histSnap = await getDocs(
        query(
          collection(db, "notificaciones_enviadas"),
          orderBy("creadaEn", "desc"),
          limit(50)
        )
      );
      const hist: NotificacionEnviada[] = [];
      histSnap.forEach((d) => {
        hist.push({ id: d.id, ...d.data() } as NotificacionEnviada);
      });
      setHistorial(hist);
    } catch (e) {
      console.error(e);
      setFeedback({ tipo: "error", texto: "✗ Error al enviar la notificación. Revisá la consola." });
    } finally {
      setEnviando(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  if (loading) return (
    <div style={{ padding: "40px", textAlign: "center", fontStyle: "italic", color: "var(--text-muted)" }}>
      Cargando panel de notificaciones...
    </div>
  );

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      {/* Header */}
      <header style={{ marginBottom: "35px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>
          🔔 Notificaciones Push
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px", fontSize: "0.95rem" }}>
          Enviá notificaciones generales a todos los usuarios o mensajes directos a un usuario específico.
        </p>
      </header>

      {/* Compose Card */}
      <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", border: "1px solid #eee", marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "20px" }}>
          Redactar Notificación
        </h2>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {([
            { key: "general", icon: "📢", label: "General (todos los usuarios)" },
            { key: "usuario", icon: "👤", label: "Usuario específico" },
          ] as const).map(({ key, icon, label }) => (
            <button
              key={key}
              id={`notif-tab-${key}`}
              onClick={() => setTab(key)}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: tab === key ? "2px solid var(--primary-blue)" : "2px solid #e5e7eb",
                background: tab === key ? "var(--primary-blue)" : "#fff",
                color: tab === key ? "#fff" : "#555",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s",
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* User Selector (only for "usuario" tab) */}
        {tab === "usuario" && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--primary-blue)", textTransform: "uppercase", marginBottom: "8px" }}>
              Seleccionar Usuario
            </label>
            <select
              id="notif-destinatario"
              value={destinatario?.uid || ""}
              onChange={(e) => {
                const u = usuarios.find((u) => u.uid === e.target.value) || null;
                setDestinatario(u);
              }}
              style={{ width: "100%", padding: "12px 15px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.95rem", color: "#333" }}
            >
              <option value="">-- Elegí un usuario --</option>
              {usuarios.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.nombre || u.email} ({u.rol || "sin rol"}){u.fcmToken ? " 🔔" : " (sin token)"}
                </option>
              ))}
            </select>
            {destinatario && !destinatario.fcmToken && (
              <p style={{ color: "#e67e22", fontSize: "0.8rem", marginTop: "6px", fontWeight: 600 }}>
                ⚠️ Este usuario no tiene notificaciones activadas (sin token FCM).
              </p>
            )}
          </div>
        )}

        {/* Título */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--primary-blue)", textTransform: "uppercase", marginBottom: "8px" }}>
            Título
          </label>
          <input
            id="notif-titulo"
            type="text"
            placeholder="Ej: Nuevo servicio disponible"
            value={mensaje.titulo}
            maxLength={100}
            onChange={(e) => setMensaje({ ...mensaje, titulo: e.target.value })}
            style={{ width: "100%", padding: "12px 15px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.95rem" }}
          />
        </div>

        {/* Cuerpo */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--primary-blue)", textTransform: "uppercase", marginBottom: "8px" }}>
            Mensaje
          </label>
          <textarea
            id="notif-cuerpo"
            placeholder="Escribí el contenido de la notificación..."
            value={mensaje.cuerpo}
            maxLength={300}
            rows={3}
            onChange={(e) => setMensaje({ ...mensaje, cuerpo: e.target.value })}
            style={{ width: "100%", padding: "12px 15px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.95rem", resize: "vertical", fontFamily: "inherit" }}
          />
          <div style={{ textAlign: "right", fontSize: "0.75rem", color: "#999" }}>
            {mensaje.cuerpo.length}/300
          </div>
        </div>

        {/* URL de acción (opcional) */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--primary-blue)", textTransform: "uppercase", marginBottom: "8px" }}>
            URL de Acción <span style={{ opacity: 0.5, fontWeight: 400 }}>(opcional)</span>
          </label>
          <input
            id="notif-url"
            type="text"
            placeholder="Ej: /admin/consultas o https://arifa.com.ar/servicios"
            value={mensaje.url}
            onChange={(e) => setMensaje({ ...mensaje, url: e.target.value })}
            style={{ width: "100%", padding: "12px 15px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.95rem" }}
          />
        </div>

        {/* Preview */}
        {(mensaje.titulo || mensaje.cuerpo) && (
          <div style={{ background: "#f8faff", border: "1px solid #d0daf5", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary-blue)", textTransform: "uppercase", marginBottom: "10px" }}>
              Vista previa
            </p>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/favicon.png" alt="ARIFA" style={{ width: "36px", height: "36px", borderRadius: "8px" }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1a1a1a", margin: 0 }}>
                  {mensaje.titulo || "ARIFA"}
                </p>
                <p style={{ fontSize: "0.85rem", color: "#555", margin: "4px 0 0" }}>
                  {mensaje.cuerpo || "Cuerpo de la notificación..."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Send Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            id="notif-enviar-btn"
            onClick={handleEnviar}
            disabled={enviando}
            className="btn-red"
            style={{ padding: "14px 40px", fontSize: "0.9rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}
          >
            {enviando ? (
              <>⏳ Enviando...</>
            ) : (
              <>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {tab === "general" ? "Enviar a Todos" : "Enviar al Usuario"}
              </>
            )}
          </button>

          {feedback && (
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: feedback.tipo === "ok" ? "#2e7d32" : "var(--primary-red)" }}>
              {feedback.texto}
            </span>
          )}
        </div>
      </div>

      {/* History */}
      <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", border: "1px solid #eee" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "20px" }}>
          Historial de Notificaciones
        </h2>

        {historial.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
            No hay notificaciones enviadas aún.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {historial.map((n) => (
              <div key={n.id} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
                padding: "14px 16px",
                borderRadius: "10px",
                background: "#f9fafb",
                border: "1px solid #eef0f5"
              }}>
                <span style={{ fontSize: "1.3rem", marginTop: "2px" }}>
                  {n.tipo === "general" ? "📢" : "👤"}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "0.9rem", color: "#1a1a1a" }}>{n.titulo}</strong>
                    <span style={{
                      fontSize: "0.7rem",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontWeight: 700,
                      background: n.estado === "enviada" ? "#e8f5e9" : n.estado === "error" ? "#ffebee" : "#fff3e0",
                      color: n.estado === "enviada" ? "#2e7d32" : n.estado === "error" ? "#c62828" : "#e65100",
                    }}>
                      {n.estado}
                    </span>
                    {n.tipo === "usuario" && n.destinatarioEmail && (
                      <span style={{ fontSize: "0.75rem", color: "#666" }}>→ {n.destinatarioEmail}</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>{n.cuerpo}</p>
                </div>
                <span style={{ fontSize: "0.75rem", color: "#999", whiteSpace: "nowrap" }}>
                  {n.creadaEn?.toDate
                    ? n.creadaEn.toDate().toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
