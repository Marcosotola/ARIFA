"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, onSnapshot, setDoc, Timestamp, collection, query, orderBy, limit } from "firebase/firestore";

export default function SuscripcionPage() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pagos, setPagos] = useState<any[]>([]);

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
          setVencimientoStr(data.vencimiento.toDate().toISOString().split('T')[0]);
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

    // Historial de pagos
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

  const handlePayment = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/mercadopago/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costo: subscription.costo,
          email: user.email
        })
      });
      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert("Error al generar el link de pago. Verificá la configuración de Mercado Pago.");
      }
    } catch (error) {
      console.error(error);
      alert("Error al procesar el pago.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", fontStyle: "italic", color: "var(--text-muted)" }}>Cargando datos de suscripción...</div>;

  const isSuperAdmin = role === "superadmin";
  const isExpired = subscription?.estado === "vencido" || (subscription?.vencimiento && subscription.vencimiento.toDate() < new Date());
  const isMaintenance = subscription?.estado === "mantenimiento";

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", paddingBottom: "100px" }}>
      <header style={{ marginBottom: "35px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>
          Gestión de Suscripción
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px", fontSize: "0.95rem" }}>
          Estado actual y configuración de pagos recurrentes.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "25px" }}>
        
        {/* Status Card */}
        <div style={{ background: "#fff", borderRadius: "16px", padding: "30px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", border: "1px solid #eee" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "20px" }}>Estado del Servicio</h3>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "25px" }}>
            <div style={{ 
              width: "12px", height: "12px", borderRadius: "50%", 
              background: isMaintenance ? "#f59e0b" : (isExpired ? "var(--primary-red)" : "#10b981"),
              boxShadow: `0 0 10px ${isMaintenance ? "#f59e0b" : (isExpired ? "var(--primary-red)" : "#10b981")}`
            }} />
            <span style={{ fontSize: "1.2rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px" }}>
              {isMaintenance ? "Mantenimiento" : (isExpired ? "Expirado" : "Activo")}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ color: "#666" }}>Vencimiento:</span>
              <span style={{ fontWeight: 700 }}>{subscription?.vencimiento ? subscription.vencimiento.toDate().toLocaleDateString('es-AR') : "Sin fecha"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ color: "#666" }}>Costo Mensual:</span>
              <span style={{ fontWeight: 700 }}>${subscription?.costo?.toLocaleString('es-AR')}</span>
            </div>
          </div>

          {!isSuperAdmin && (
            <div style={{ marginTop: "30px" }}>
              <button 
                className="btn-red"
                style={{ width: "100%", padding: "15px", fontSize: "1rem" }}
                onClick={handlePayment}
                disabled={saving}
              >
                {saving ? "Procesando..." : (isExpired ? "Renovar Suscripción" : "Pagar Próximo Mes")}
              </button>
              <p style={{ fontSize: "0.75rem", color: "#999", textAlign: "center", marginTop: "12px" }}>
                El pago se procesa de forma segura a través de Mercado Pago.
              </p>
            </div>
          )}
        </div>

        {/* Superadmin Config Card */}
        {isSuperAdmin && (
          <div style={{ background: "#fff", borderRadius: "16px", padding: "30px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", border: "1px solid #eee" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-red)", marginBottom: "20px" }}>Configuración Superadmin</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px" }}>Costo de Suscripción (ARS)</label>
                <input 
                  type="number" 
                  value={costo} 
                  onChange={(e) => setCosto(Number(e.target.value))}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px" }}>Fecha de Vencimiento</label>
                <input 
                  type="date" 
                  value={vencimientoStr} 
                  onChange={(e) => setVencimientoStr(e.target.value)}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px" }}>Estado Forzado</label>
                <select 
                  value={estado} 
                  onChange={(e) => setEstado(e.target.value)}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff" }}
                >
                  <option value="activo">Activo</option>
                  <option value="vencido">Vencido / Suspendido</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>

              <div style={{ marginTop: "10px" }}>
                <button 
                  onClick={handleSaveConfig}
                  disabled={saving}
                  style={{ 
                    width: "100%", padding: "14px", background: "var(--primary-blue)", color: "#fff", 
                    border: "none", borderRadius: "8px", fontWeight: 800, cursor: "pointer"
                  }}
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
                {message && (
                  <div style={{ 
                    marginTop: "15px", textAlign: "center", fontSize: "0.9rem", fontWeight: 700, 
                    color: message.startsWith("✓") ? "#2e7d32" : "var(--primary-red)" 
                  }}>
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historial de Pagos */}
      <div style={{ marginTop: "40px" }}>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "20px" }}>Historial de Pagos</h3>
        <div style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", border: "1px solid #eee" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead style={{ background: "#f8f9fa", borderBottom: "1px solid #eee" }}>
              <tr>
                <th style={{ padding: "15px", textAlign: "left", color: "#666" }}>Fecha</th>
                <th style={{ padding: "15px", textAlign: "left", color: "#666" }}>Transacción ID</th>
                <th style={{ padding: "15px", textAlign: "left", color: "#666" }}>Monto</th>
                <th style={{ padding: "15px", textAlign: "center", color: "#666" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pagos.length > 0 ? pagos.map((pago) => (
                <tr key={pago.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "15px" }}>{pago.fecha?.toDate().toLocaleDateString('es-AR')}</td>
                  <td style={{ padding: "15px", color: "var(--text-muted)", fontSize: "0.8rem" }}>{pago.paymentId}</td>
                  <td style={{ padding: "15px", fontWeight: 700 }}>${pago.monto?.toLocaleString('es-AR')}</td>
                  <td style={{ padding: "15px", textAlign: "center" }}>
                    <span style={{ 
                      padding: "4px 10px", borderRadius: "100px", background: "#dcfce7", 
                      color: "#166534", fontSize: "0.75rem", fontWeight: 700 
                    }}>
                      Aprobado
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "#999", fontStyle: "italic" }}>
                    No hay pagos registrados aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Section */}
      <div style={{ marginTop: "40px", padding: "30px", background: "rgba(26, 58, 107, 0.05)", borderRadius: "16px", border: "1px solid rgba(26, 58, 107, 0.1)" }}>
        <h4 style={{ color: "var(--primary-blue)", fontWeight: 800, marginBottom: "10px" }}>¿Cómo funciona la suscripción?</h4>
        <ul style={{ paddingLeft: "20px", fontSize: "0.9rem", color: "#555", lineHeight: "1.7" }}>
          <li>El costo mensual es de <strong>${costo?.toLocaleString('es-AR')}</strong>.</li>
          <li>Si el pago no se registra antes de la fecha de vencimiento, el acceso se restringirá automáticamente para todos los usuarios excepto el Superadmin.</li>
          <li>Los administradores serán redirigidos a esta página para realizar el pago.</li>
          <li>Una vez realizado el pago, el servicio se reactivará instantáneamente.</li>
        </ul>
      </div>
    </div>
  );
}
