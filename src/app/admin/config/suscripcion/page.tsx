"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, onSnapshot, setDoc, Timestamp, collection, query, orderBy, limit } from "firebase/firestore";
import styles from "./page.module.css";

export default function SuscripcionPage() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pagos, setPagos] = useState<any[]>([]);
  const [showMpEmailModal, setShowMpEmailModal] = useState(false);
  const [mpEmail, setMpEmail] = useState("");

  // Superadmin editable fields
  const [costo, setCosto] = useState(120000);
  const [estado, setEstado] = useState("activo");
  const [vencimientoStr, setVencimientoStr] = useState("");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDoc = await getDoc(doc(db, "usuarios", u.uid));
        if (userDoc.exists()) {
          setRole(userDoc.data().rol);
        }
      }
    });

    const unsubSub = onSnapshot(doc(db, "configuracion", "suscripcion"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSubscription(data);
        setCosto(data.costo || 120000);
        setEstado(data.estado || "activo");
        if (data.vencimiento) {
          try {
            const date = typeof data.vencimiento.toDate === 'function' ? data.vencimiento.toDate() : new Date(data.vencimiento);
            setVencimientoStr(date.toISOString().split('T')[0]);
          } catch (e) {
            console.error("Error parsing date:", e);
          }
        }
      } else {
        const initial = {
          costo: 120000,
          estado: "activo",
          vencimiento: null
        };
        setSubscription(initial);
        setDoc(doc(db, "configuracion", "suscripcion"), initial);
      }
      setLoading(false);
    });

    const q = query(collection(db, "pagos_suscripcion"), orderBy("fecha", "desc"), limit(10));
    const unsubPagos = onSnapshot(q, (snap) => {
      setPagos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubAuth();
      unsubSub();
      unsubPagos();
    };
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    setMessage("");
    try {
      const updatedData = {
        costo: Number(costo),
        estado,
        vencimiento: vencimientoStr ? Timestamp.fromDate(new Date(vencimientoStr + "T23:59:59")) : null,
        updatedAt: Timestamp.now()
      };
      await updateDoc(doc(db, "configuracion", "suscripcion"), updatedData);
      setMessage("✓ Configuración guardada con éxito.");
    } catch (error) {
      console.error(error);
      setMessage("✗ Error al guardar.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleOpenPayment = () => {
    setMpEmail(user.email || "");
    setShowMpEmailModal(true);
  };

  const handlePayment = async () => {
    if (!mpEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mpEmail)) {
      alert("Ingresá un correo electrónico válido.");
      return;
    }
    setShowMpEmailModal(false);
    setSaving(true);
    try {
      const res = await fetch("/api/mercadopago/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costo: subscription.costo,
          email: mpEmail
        })
      });
      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        const errorMsg = data.details || data.error || "Error desconocido";
        alert(`Error al generar el link de pago: ${errorMsg}. Verificá la configuración de Mercado Pago.`);
      }
    } catch (error) {
      console.error(error);
      alert("Error al procesar el pago.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.loading}>Cargando datos de suscripción...</div>;

  const isSuperAdmin = role === "superadmin";
  const isExpired = subscription?.estado === "vencido" || (subscription?.vencimiento && subscription.vencimiento.toDate() < new Date());
  const isMaintenance = subscription?.estado === "mantenimiento";

  const statusDotClass = isMaintenance
    ? styles.statusDotMaintenance
    : isExpired
    ? styles.statusDotExpired
    : styles.statusDotActive;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Gestión de Suscripción</h1>
        <p className={styles.subtitle}>Estado actual y configuración de pagos recurrentes.</p>
      </header>

      <div className={styles.grid}>

        {/* Status Card */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Estado del Servicio</h3>

          <div className={styles.statusRow}>
            <div className={`${styles.statusDot} ${statusDotClass}`} />
            <span className={styles.statusLabel}>
              {isMaintenance ? "Mantenimiento" : (isExpired ? "Expirado" : "Activo")}
            </span>
          </div>

          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Vencimiento:</span>
              <span className={styles.infoValue}>
                {(() => {
                  if (!subscription?.vencimiento) return "Sin fecha";
                  try {
                    const date = typeof subscription.vencimiento.toDate === 'function' ? subscription.vencimiento.toDate() : new Date(subscription.vencimiento);
                    return date.toLocaleDateString('es-AR');
                  } catch (e) {
                    return "Formato inválido";
                  }
                })()}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Costo Mensual:</span>
              <span className={styles.infoValue}>${subscription?.costo?.toLocaleString('es-AR')}</span>
            </div>
          </div>

          {!isSuperAdmin && (
            <div className={styles.paymentSection}>
              <button
                className={`btn-red ${styles.fullWidthBtn}`}
                onClick={handleOpenPayment}
                disabled={saving}
              >
                {saving ? "Procesando..." : (isExpired ? "Renovar Suscripción" : "Pagar Próximo Mes")}
              </button>
              <p className={styles.paymentNote}>
                El pago se procesa de forma segura a través de Mercado Pago.
              </p>
            </div>
          )}
        </div>

        {/* Superadmin Config Card */}
        {isSuperAdmin && (
          <div className={styles.card}>
            <h3 className={styles.cardTitleRed}>Configuración Superadmin</h3>

            <div className={styles.formGroup}>
              <div>
                <label htmlFor="costo-input" className={styles.fieldLabel}>
                  Costo de Suscripción (ARS)
                </label>
                <input
                  id="costo-input"
                  type="number"
                  value={costo}
                  onChange={(e) => setCosto(Number(e.target.value))}
                  className={styles.input}
                  title="Costo de suscripción en ARS"
                  placeholder="120000"
                />
              </div>

              <div>
                <label htmlFor="vencimiento-input" className={styles.fieldLabel}>
                  Fecha de Vencimiento
                </label>
                <input
                  id="vencimiento-input"
                  type="date"
                  value={vencimientoStr}
                  onChange={(e) => setVencimientoStr(e.target.value)}
                  className={styles.input}
                  title="Fecha de vencimiento de la suscripción"
                />
              </div>

              <div>
                <label htmlFor="estado-select" className={styles.fieldLabel}>
                  Estado Forzado
                </label>
                <select
                  id="estado-select"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className={styles.select}
                  title="Estado forzado de la suscripción"
                >
                  <option value="activo">Activo</option>
                  <option value="vencido">Vencido / Suspendido</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>

              <div className={styles.saveSection}>
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className={styles.saveBtn}
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
                {message && (
                  <div className={`${styles.saveMessage} ${message.startsWith("✓") ? styles.saveMessageSuccess : styles.saveMessageError}`}>
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historial de Pagos */}
      <div className={styles.historySection}>
        <h3 className={styles.historyTitle}>Historial de Pagos</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th}>Fecha</th>
                <th className={styles.th}>Transacción ID</th>
                <th className={styles.th}>Monto</th>
                <th className={styles.thCenter}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pagos.length > 0 ? pagos.map((pago) => (
                <tr key={pago.id} className={styles.tr}>
                  <td className={styles.td}>
                    {(() => {
                      if (!pago.fecha) return "Sin fecha";
                      try {
                        const date = typeof pago.fecha.toDate === 'function' ? pago.fecha.toDate() : new Date(pago.fecha);
                        return date.toLocaleDateString('es-AR');
                      } catch (e) { return "Error fecha"; }
                    })()}
                  </td>
                  <td className={styles.tdMuted}>{pago.paymentId || "N/A"}</td>
                  <td className={styles.tdBold}>${pago.monto?.toLocaleString('es-AR') || "0"}</td>
                  <td className={styles.tdCenter}>
                    <span className={styles.badge}>{pago.estado || "Aprobado"}</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className={styles.emptyTd}>
                    No hay pagos registrados aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal email Mercado Pago */}
      {showMpEmailModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>Confirmar correo de Mercado Pago</h3>
            <p className={styles.modalDescription}>
              Ingresá el correo asociado a tu cuenta de Mercado Pago. Puede ser diferente al correo con el que iniciás sesión en la app.
            </p>
            <label htmlFor="mp-email-input" className={styles.modalLabel}>
              Correo de Mercado Pago
            </label>
            <input
              id="mp-email-input"
              type="email"
              value={mpEmail}
              onChange={(e) => setMpEmail(e.target.value)}
              placeholder="tu@correo-mercadopago.com"
              title="Correo de Mercado Pago"
              className={styles.modalInput}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handlePayment()}
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setShowMpEmailModal(false)}
                className={styles.cancelBtn}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`btn-red ${styles.confirmBtn}`}
                onClick={handlePayment}
              >
                Continuar al pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className={styles.infoSection}>
        <h4 className={styles.infoSectionTitle}>¿Cómo funciona la suscripción?</h4>
        <ul className={styles.infoSectionList}>
          <li>El costo mensual es de <strong>${costo?.toLocaleString('es-AR')}</strong>.</li>
          <li>Si el pago no se registra antes de la fecha de vencimiento, el acceso se restringirá automáticamente para todos los usuarios excepto el Superadmin.</li>
          <li>Los administradores serán redirigidos a esta página para realizar el pago.</li>
          <li>Una vez realizado el pago, el servicio se reactivará instantáneamente.</li>
        </ul>
      </div>
    </div>
  );
}
