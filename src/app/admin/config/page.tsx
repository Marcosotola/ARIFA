"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { requestNotificationPermission, isPushSupported, isIOS } from "@/lib/firebase-messaging";
import Link from "next/link";

export default function ConfigPage() {
  const [user, setUser] = useState<any>(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cargo, setCargo] = useState("");
  const [rol, setRol] = useState<string | null>(null);
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
          setApellido(data.apellido || "");
          setEmpresa(data.empresa || "");
          setDireccion(data.direccion || "");
          setTelefono(data.telefono || "");
          setCargo(data.cargo || "");
          setRol(data.rol || "cliente");
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
      await updateDoc(doc(db, "usuarios", user.uid), { 
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        empresa: empresa.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim(),
        cargo: cargo.trim(),
        updatedAt: new Date().toISOString()
      });
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
        setNotifMessage("✓ Notificaciones activadas.");
      } else {
        const perm = typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied";
        setNotifStatus(perm as any);
        if (perm === "denied") {
          setNotifMessage("✗ Permiso denegado por el navegador.");
        } else {
          setNotifMessage("✗ No se pudo obtener el permiso.");
        }
      }
    } catch (e) {
      console.error(e);
      setNotifMessage("✗ Error al activar.");
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
      setNotifMessage("✓ Notificaciones desactivadas.");
    } catch (e) {
      setNotifMessage("✗ Error al desactivar.");
    } finally {
      setNotifLoading(false);
      setTimeout(() => setNotifMessage(""), 3000);
    }
  };

  if (loading) return <div style={{ padding: "60px", textAlign: "center", fontStyle: "italic", color: "var(--text-muted)" }}>Cargando perfil...</div>;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <header style={{ marginBottom: "35px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Mi Cuenta</h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Gestioná tus datos personales y preferencias de alertas.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "25px" }}>
        
        {/* Profile Info */}
        <div style={{ background: "#fff", borderRadius: "16px", padding: "30px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "25px", borderBottom: "1px solid #eee", paddingBottom: "15px" }}>
            👤 Datos Personales
          </h3>
          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div className="form-group">
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase" }}>Nombre</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1.5px solid #eee", fontSize: "0.95rem" }} />
              </div>
              <div className="form-group">
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase" }}>Apellido</label>
                <input type="text" value={apellido} onChange={e => setApellido(e.target.value)} required style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1.5px solid #eee", fontSize: "0.95rem" }} />
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase" }}>Empresa</label>
              <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1.5px solid #eee", fontSize: "0.95rem" }} />
            </div>

            <div className="form-group">
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase" }}>Dirección</label>
              <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1.5px solid #eee", fontSize: "0.95rem" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div className="form-group">
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase" }}>Teléfono</label>
                <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)} style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1.5px solid #eee", fontSize: "0.95rem" }} />
              </div>
              <div className="form-group">
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase" }}>Cargo</label>
                <select value={cargo} onChange={e => setCargo(e.target.value)} style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1.5px solid #eee", fontSize: "0.95rem", background: "#fff" }}>
                  <option value="">Seleccionar...</option>
                  {["Propietario", "Gerente", "Responsable de Seguridad", "Encargado", "Administrativo", "Técnico", "Otro"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "15px" }}>
              <button type="submit" className="btn-red" disabled={saving} style={{ padding: "12px 30px", fontSize: "0.9rem" }}>
                {saving ? "Guardando..." : "Actualizar Perfil"}
              </button>
              {message && <span style={{ fontSize: "0.85rem", fontWeight: 700, color: message.startsWith("✓") ? "#2e7d32" : "var(--primary-red)" }}>{message}</span>}
            </div>
          </form>
        </div>

        {/* Preferences / Notifs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          
          <div style={{ background: "#fff", borderRadius: "16px", padding: "30px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "20px", borderBottom: "1px solid #eee", paddingBottom: "15px" }}>
              🔔 Notificaciones Push
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "20px" }}>
              Activá las alertas para recibir avisos de vencimientos y novedades importantes de ARIFA.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <div style={{ 
                flex: 1, padding: "15px", borderRadius: "12px", 
                background: hasToken ? "#e8f5e9" : "#f5f5f5",
                border: `1px solid ${hasToken ? "#c8e6c9" : "#eee"}`,
                textAlign: "center"
              }}>
                <div style={{ fontSize: "1.2rem", marginBottom: "5px" }}>{hasToken ? "✅" : "❌"}</div>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: hasToken ? "#2e7d32" : "#888", textTransform: "uppercase" }}>
                  {hasToken ? "Activadas" : "Desactivadas"}
                </div>
              </div>

              <div style={{ flex: 1.5 }}>
                {hasToken ? (
                  <button onClick={handleDesactivarNotificaciones} disabled={notifLoading} className="btn-white" style={{ width: "100%", border: "1px solid var(--primary-red)", color: "var(--primary-red)" }}>
                    {notifLoading ? "..." : "Desactivar"}
                  </button>
                ) : (
                  <button onClick={handleActivarNotificaciones} disabled={notifLoading || notifStatus === "denied"} className="btn-blue" style={{ width: "100%", opacity: notifStatus === "denied" ? 0.5 : 1 }}>
                    {notifLoading ? "Activando..." : "Activar Ahora"}
                  </button>
                )}
              </div>
            </div>

            {notifMessage && <div style={{ marginTop: "15px", fontSize: "0.85rem", fontWeight: 600, color: notifMessage.startsWith("✓") ? "#2e7d32" : "var(--primary-red)", textAlign: "center" }}>{notifMessage}</div>}

            {notifStatus === "denied" && (
              <p style={{ marginTop: "15px", fontSize: "0.75rem", color: "#666", textAlign: "center" }}>
                ⚠️ Notificaciones bloqueadas en el navegador. Habilitálas desde el candado (🔒) de la barra de direcciones.
              </p>
            )}
          </div>

          <div style={{ background: "#fff", borderRadius: "16px", padding: "30px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px" }}>🔐 Seguridad</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "20px" }}>Para cambiar tu contraseña debés cerrar sesión e iniciar el proceso de recuperación.</p>
            <button onClick={() => auth.signOut()} style={{ background: "none", border: "1px solid #ddd", color: "#666", padding: "10px 15px", borderRadius: "8px", fontWeight: 700, fontSize: "0.8rem", width: "100%", cursor: "pointer" }}>Cerrar Sesión</button>
          </div>

        </div>

      </div>
    </div>
  );
}
