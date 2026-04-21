"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { requestNotificationPermission, isPushSupported, isIOS } from "@/lib/firebase-messaging";

export default function ConfigPage() {
  const [user, setUser] = useState<any>(null);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Notification states
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifIOS, setNotifIOS] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"granted" | "denied" | "default" | "unknown">("unknown");
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifMessage, setNotifMessage] = useState("");
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDoc = await getDoc(doc(db, "usuarios", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setNombre(data.nombre || "");
          setHasToken(!!data.fcmToken);
        }
        setLoading(false);
      }
    });

    // Check notification support
    setNotifSupported(isPushSupported());
    setNotifIOS(isIOS());
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifStatus(Notification.permission as any);
    }

    return () => unsub();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await updateDoc(doc(db, "usuarios", user.uid), { nombre });
      setMessage("✓ Perfil actualizado con éxito.");
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("✗ Error al actualizar.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleActivarNotificaciones = async () => {
    setNotifLoading(true);
    setNotifMessage("");
    try {
      const token = await requestNotificationPermission();
      if (token) {
        await updateDoc(doc(db, "usuarios", user.uid), { fcmToken: token });
        setHasToken(true);
        setNotifStatus("granted");
        setNotifMessage("✓ Notificaciones activadas correctamente.");
      } else {
        const perm =
          typeof window !== "undefined" && "Notification" in window
            ? Notification.permission
            : "denied";
        setNotifStatus(perm as any);
        if (perm === "denied") {
          setNotifMessage("✗ Bloqueaste las notificaciones. Habilitálas desde la configuración del navegador.");
        } else {
          setNotifMessage("✗ No se pudo obtener el permiso. Intentá de nuevo.");
        }
      }
    } catch (e) {
      console.error(e);
      setNotifMessage("✗ Error al activar notificaciones.");
    } finally {
      setNotifLoading(false);
      setTimeout(() => setNotifMessage(""), 5000);
    }
  };

  const handleDesactivarNotificaciones = async () => {
    setNotifLoading(true);
    try {
      await updateDoc(doc(db, "usuarios", user.uid), { fcmToken: null });
      setHasToken(false);
      setNotifMessage("Notificaciones desactivadas. Ya no recibirás alertas push.");
    } catch (e) {
      setNotifMessage("✗ Error al desactivar.");
    } finally {
      setNotifLoading(false);
      setTimeout(() => setNotifMessage(""), 3000);
    }
  };

  if (loading)
    return (
      <div style={{ padding: "40px", textAlign: "center", fontStyle: "italic", color: "var(--text-muted)" }}>
        Cargando perfil...
      </div>
    );

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ marginBottom: "35px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>
          Configuración de Perfil
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px", fontSize: "0.95rem" }}>
          Administra tus datos personales y preferencias de cuenta.
        </p>
      </header>

      {/* Profile form */}
      <div style={{ background: "#fff", borderRadius: "12px", padding: "35px", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", border: "1px solid #eee" }}>
        <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            <div className="form-group">
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--primary-blue)", textTransform: "uppercase", marginBottom: "8px" }}>
                Nombre Completo
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Tu nombre"
                style={{ width: "100%", padding: "12px 15px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "1rem" }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--primary-blue)", opacity: 0.6, textTransform: "uppercase", marginBottom: "8px" }}>
                Email (No editable)
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ""}
                style={{ width: "100%", padding: "12px 15px", borderRadius: "8px", border: "1px solid #eee", fontSize: "1rem", color: "#999", background: "#fafafa" }}
              />
            </div>
          </div>

          <div style={{ marginTop: "10px" }}>
            <button
              type="submit"
              className="btn-red"
              disabled={saving}
              style={{ padding: "14px 40px", fontSize: "0.9rem", fontWeight: 800 }}
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
            {message && (
              <span style={{
                marginLeft: "15px",
                fontSize: "0.9rem",
                fontWeight: 700,
                color: message.startsWith("✓") ? "#2e7d32" : "var(--primary-red)",
                transition: "0.3s",
              }}>
                {message}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* NOTIFICATIONS SECTION */}
      <div style={{ marginTop: "30px", background: "#fff", borderRadius: "12px", padding: "30px", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", border: "1px solid #eee" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
          🔔 Notificaciones Push
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px", lineHeight: 1.6 }}>
          Recibí alertas importantes sobre vencimientos, consultas y novedades de ARIFA directamente en tu dispositivo.
        </p>

        {notifIOS && (
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#92400e", lineHeight: 1.6 }}>
              <strong>⚠️ iOS / Safari:</strong> Las notificaciones push en iPhone/iPad requieren que la app esté instalada
              en tu pantalla de inicio. Una vez instalada, tocá el botón <strong>&quot;Activar Notificaciones&quot;</strong> desde esta sección.
            </p>
          </div>
        )}

        {!notifSupported && !notifIOS && (
          <div style={{ background: "#f3f4f6", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#666" }}>
              Tu navegador no soporta notificaciones push. Te recomendamos usar Chrome, Edge o Firefox.
            </p>
          </div>
        )}

        {(notifSupported || notifIOS) && (
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "8px",
              background: hasToken ? "#e8f5e9" : "#f3f4f6",
              border: `1px solid ${hasToken ? "#c8e6c9" : "#e5e7eb"}`,
            }}>
              <span style={{ fontSize: "0.8rem" }}>{hasToken ? "🟢" : "⚪"}</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: hasToken ? "#2e7d32" : "#555" }}>
                {hasToken ? "Activadas" : "Desactivadas"}
              </span>
            </div>

            {!hasToken ? (
              <button
                id="config-activar-notificaciones"
                onClick={handleActivarNotificaciones}
                disabled={notifLoading || notifStatus === "denied"}
                style={{
                  padding: "12px 24px",
                  background: notifStatus === "denied" ? "#9ca3af" : "linear-gradient(135deg, #1a3a6b, #2563eb)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: notifStatus === "denied" ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                🔔 {notifLoading ? "Activando..." : notifStatus === "denied" ? "Bloqueado en el navegador" : "Activar Notificaciones"}
              </button>
            ) : (
              <button
                id="config-desactivar-notificaciones"
                onClick={handleDesactivarNotificaciones}
                disabled={notifLoading}
                style={{
                  padding: "12px 24px",
                  background: "#fff",
                  color: "var(--primary-red)",
                  border: "1px solid var(--primary-red)",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                {notifLoading ? "..." : "Desactivar"}
              </button>
            )}

            {notifMessage && (
              <span style={{
                fontSize: "0.88rem",
                fontWeight: 600,
                color: notifMessage.startsWith("✓") ? "#2e7d32" : notifMessage.startsWith("✗") ? "var(--primary-red)" : "#555",
              }}>
                {notifMessage}
              </span>
            )}
          </div>
        )}

        {notifStatus === "denied" && (
          <p style={{ marginTop: "12px", fontSize: "0.82rem", color: "#666", lineHeight: 1.6 }}>
            Las notificaciones están bloqueadas en tu navegador. Para habilitarlas, andá a{" "}
            <strong>Configuración del sitio</strong> (🔒 en la barra de direcciones) y cambiá los permisos de notificación a <strong>Permitir</strong>.
          </p>
        )}
      </div>

      {/* Security */}
      <div style={{ marginTop: "30px", padding: "30px", background: "var(--bg-light)", borderRadius: "12px", border: "1px solid #ddd" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px" }}>
          Seguridad de la cuenta
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px", lineHeight: 1.6 }}>
          Para cambiar tu contraseña, debés cerrar sesión e iniciar el proceso de recuperación de contraseña en el panel de ingreso.
        </p>
        <button
          onClick={() => auth.signOut()}
          style={{ background: "none", border: "1px solid var(--primary-red)", color: "var(--primary-red)", padding: "10px 20px", borderRadius: "6px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
        >
          Cerrar Sesión para Cambiar Contraseña
        </button>
      </div>
    </div>
  );
}
