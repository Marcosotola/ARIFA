"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { requestNotificationPermission, isPushSupported, isIOS } from "@/lib/firebase-messaging";
import styles from "./page.module.css";

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

  if (loading) return <div className={styles.loading}>Cargando perfil...</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mi Cuenta</h1>
        <p className={styles.subtitle}>Gestioná tus datos personales y preferencias de alertas.</p>
      </header>

      <div className={styles.grid}>

        {/* Profile Info */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>👤 Datos Personales</h3>
          <form onSubmit={handleUpdate} className={styles.form}>
            <div className={styles.twoCol}>
              <div className="form-group">
                <label htmlFor="nombre-input" className={styles.fieldLabel}>Nombre</label>
                <input
                  id="nombre-input"
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  required
                  placeholder="Tu nombre"
                  title="Nombre"
                  className={styles.input}
                />
              </div>
              <div className="form-group">
                <label htmlFor="apellido-input" className={styles.fieldLabel}>Apellido</label>
                <input
                  id="apellido-input"
                  type="text"
                  value={apellido}
                  onChange={e => setApellido(e.target.value)}
                  required
                  placeholder="Tu apellido"
                  title="Apellido"
                  className={styles.input}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="empresa-input" className={styles.fieldLabel}>Empresa</label>
              <input
                id="empresa-input"
                type="text"
                value={empresa}
                onChange={e => setEmpresa(e.target.value)}
                placeholder="Nombre de la empresa"
                title="Empresa"
                className={styles.input}
              />
            </div>

            <div className="form-group">
              <label htmlFor="direccion-input" className={styles.fieldLabel}>Dirección</label>
              <input
                id="direccion-input"
                type="text"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Dirección"
                title="Dirección"
                className={styles.input}
              />
            </div>

            <div className={styles.twoCol}>
              <div className="form-group">
                <label htmlFor="telefono-input" className={styles.fieldLabel}>Teléfono</label>
                <input
                  id="telefono-input"
                  type="text"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  placeholder="Ej: +54 11 1234-5678"
                  title="Teléfono"
                  className={styles.input}
                />
              </div>
              <div className="form-group">
                <label htmlFor="cargo-select" className={styles.fieldLabel}>Cargo</label>
                <select
                  id="cargo-select"
                  value={cargo}
                  onChange={e => setCargo(e.target.value)}
                  title="Cargo"
                  className={styles.select}
                >
                  <option value="">Seleccionar...</option>
                  {["Propietario", "Gerente", "Responsable de Seguridad", "Encargado", "Administrativo", "Técnico", "Otro"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={`btn-red ${styles.submitBtn}`} disabled={saving}>
                {saving ? "Guardando..." : "Actualizar Perfil"}
              </button>
              {message && (
                <span className={`${styles.saveMessage} ${message.startsWith("✓") ? styles.saveMessageSuccess : styles.saveMessageError}`}>
                  {message}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Preferences / Notifs */}
        <div className={styles.rightColumn}>

          <div className={styles.notifCard}>
            <h3 className={styles.notifCardTitle}>🔔 Notificaciones Push</h3>
            <p className={styles.notifDescription}>
              Activá las alertas para recibir avisos de vencimientos y novedades importantes de ARIFA.
            </p>

            <div className={styles.notifRow}>
              <div className={`${styles.notifStatus} ${hasToken ? styles.notifStatusActive : styles.notifStatusInactive}`}>
                <div className={styles.notifStatusIcon}>{hasToken ? "✅" : "❌"}</div>
                <div className={`${styles.notifStatusLabel} ${hasToken ? styles.notifStatusLabelActive : styles.notifStatusLabelInactive}`}>
                  {hasToken ? "Activadas" : "Desactivadas"}
                </div>
              </div>

              <div className={styles.notifActions}>
                {hasToken ? (
                  <button
                    onClick={handleDesactivarNotificaciones}
                    disabled={notifLoading}
                    className={`btn-white ${styles.notifDeactivateBtn}`}
                  >
                    {notifLoading ? "..." : "Desactivar"}
                  </button>
                ) : (
                  <button
                    onClick={handleActivarNotificaciones}
                    disabled={notifLoading || notifStatus === "denied"}
                    className={`btn-blue ${styles.notifActivateBtn} ${notifStatus === "denied" ? styles.notifActivateBtnDisabled : ""}`}
                  >
                    {notifLoading ? "Activando..." : "Activar Ahora"}
                  </button>
                )}
              </div>
            </div>

            {notifMessage && (
              <div className={`${styles.notifMessage} ${notifMessage.startsWith("✓") ? styles.notifMessageSuccess : styles.notifMessageError}`}>
                {notifMessage}
              </div>
            )}

            {notifStatus === "denied" && (
              <p className={styles.notifDeniedNote}>
                ⚠️ Notificaciones bloqueadas en el navegador. Habilitálas desde el candado (🔒) de la barra de direcciones.
              </p>
            )}
          </div>

          <div className={styles.securityCard}>
            <h3 className={styles.securityTitle}>🔐 Seguridad</h3>
            <p className={styles.securityNote}>Para cambiar tu contraseña debés cerrar sesión e iniciar el proceso de recuperación.</p>
            <button onClick={() => auth.signOut()} className={styles.signOutBtn}>Cerrar Sesión</button>
          </div>

        </div>

      </div>
    </div>
  );
}
