"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { generateEstadoCuentaPDF } from "@/lib/pdfGenerator";
import { ArrowLeft, Edit, Scroll, TrendingUp, TrendingDown } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function VerEstadoCuentaPage() {
  const [estado, setEstado] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      try {
        const [userDoc, docSnap] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDoc(doc(db, "estados-cuenta", id)),
        ]);
        const r = userDoc.exists() ? userDoc.data().rol : null;
        if (r === "tecnico") { router.push("/admin"); return; }
        setRole(r);
        if (docSnap.exists()) {
          setEstado({ id: docSnap.id, ...docSnap.data() });
        } else {
          alert("Documento no encontrado.");
          router.push("/admin/documentos/estado-cuenta");
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    });
    return () => unsub();
  }, [router, id]);

  const handleDownload = async () => {
    if (!estado) return;
    setDownloading(true);
    try { await generateEstadoCuentaPDF(estado); }
    catch (e) { console.error(e); alert("Error al generar el PDF."); }
    finally { setDownloading(false); }
  };

  const isStaff = ["admin", "superadmin", "secretaria"].includes(role || "");

  if (loading) return <div style={{ padding: "100px", textAlign: "center", color: "var(--text-muted)" }}>Cargando...</div>;
  if (!estado) return null;

  const ecNum = String(estado.numero || "?").padStart(5, "0");
  const fecStr = estado.fecha ? new Date(estado.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";
  const saldoActual = estado.saldoActual || 0;

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 15px 60px" }}>
      {/* ACCIONES */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <button
          onClick={() => router.push("/admin/documentos/estado-cuenta")}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: "0.9rem" }}
        >
          <ArrowLeft size={18} /> Volver a Estados de Cuenta
        </button>
        <div style={{ display: "flex", gap: "10px" }}>
          {isStaff && (
            <Link
              href={`/admin/documentos/estado-cuenta/nuevo?edit=${id}`}
              style={{ display: "flex", alignItems: "center", gap: "7px", padding: "10px 18px", borderRadius: "10px", background: "#f0f7ff", color: "#0061ff", textDecoration: "none", fontWeight: 700, fontSize: "0.85rem" }}
            >
              <Edit size={16} /> Editar
            </Link>
          )}
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{ display: "flex", alignItems: "center", gap: "7px", padding: "10px 18px", borderRadius: "10px", background: "#f5f3ff", color: "#7c3aed", border: "none", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", opacity: downloading ? 0.6 : 1 }}
          >
            <Scroll size={16} /> {downloading ? "Generando..." : "Descargar PDF"}
          </button>
        </div>
      </div>

      {/* DOCUMENTO */}
      <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 4px 30px rgba(0,0,0,0.08)", overflow: "hidden", border: "1px solid #eee" }}>

        {/* ENCABEZADO */}
        <div style={{ background: "var(--primary-blue)", padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <img src="/logos/logoFondoTransparente.svg" alt="ARIFA" style={{ height: "55px" }} />
            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: "16px" }}>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "2px" }}>
                Estado de Cuenta
              </div>
              <div style={{ color: "#fff", fontSize: "1.8rem", fontWeight: 900, letterSpacing: "1px" }}>
                EC-{ecNum}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Fecha: </span>
                <span style={{ color: "#fff", fontWeight: 700 }}>{fecStr}</span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Referencia: </span>
                <span style={{ color: "#fff", fontWeight: 700 }}>{estado.obraNombre || "-"}</span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Emitido por: </span>
                <span style={{ color: "#fff", fontWeight: 700 }}>{estado.creadoPorNombre || "ARIFA"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* DATOS DEL CLIENTE */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #f0f2f5" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--primary-blue)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
            Datos del Cliente
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 30px" }}>
            <DataRow label="Nombre / Contacto" value={`${estado.clienteNombre || "-"}${estado.clienteApellido ? " " + estado.clienteApellido : ""}`} />
            <DataRow label="Empresa / Sede" value={estado.sedeNombre ? `${estado.clienteEmpresa || "-"} — Sede: ${estado.sedeNombre}` : (estado.clienteEmpresa || estado.clienteNombre || "-")} />
            <DataRow label="DNI / CUIT" value={estado.clienteDniCuit || "-"} />
            <DataRow label="Teléfono" value={estado.clienteTelefono || "-"} />
            <DataRow label="Email" value={estado.clienteEmail || "-"} />
            <DataRow label="Dirección" value={estado.clienteDireccion || "-"} />
          </div>
        </div>

        {/* MOVIMIENTOS */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #f0f2f5" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--primary-blue)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
            Movimientos y Seguimiento de Obra
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--primary-blue)" }}>
                  {["Descripción", "Tipo", "Monto"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: h === "Monto" ? "right" : h === "Tipo" ? "center" : "left", fontSize: "0.75rem", color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(estado.items || []).map((item: any, idx: number) => (
                  <tr key={item.id || idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f8f9fc", borderBottom: "1px solid #f0f2f5" }}>
                    <td style={{ padding: "12px 14px", fontSize: "0.9rem", color: "#333" }}>{item.descripcion}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center", fontSize: "0.75rem", fontWeight: 900, textTransform: "uppercase", color: item.tipo === "egreso" ? "#ef4444" : "#16a34a" }}>
                        {item.tipo === "egreso" ? "Deuda" : "Pago"}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: item.tipo === "egreso" ? "#ef4444" : "#16a34a" }}>
                        $ {fmt(item.monto || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RESUMEN */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #f0f2f5", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ minWidth: "300px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "0.9rem" }}>
                    <span style={{ color: "#666" }}>Total Deudas:</span>
                    <span style={{ fontWeight: 700, color: "#ef4444" }}>$ {fmt(estado.totalEgresos || 0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "0.9rem" }}>
                    <span style={{ color: "#666" }}>Total Pagos:</span>
                    <span style={{ fontWeight: 700, color: "#16a34a" }}>$ {fmt(estado.totalIngresos || 0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 4px", borderTop: "2px solid var(--primary-blue)", marginTop: "10px" }}>
                    <span style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--primary-blue)" }}>SALDO ACTUAL</span>
                    <span style={{ fontWeight: 900, fontSize: "1.2rem", color: saldoActual > 0 ? "#ef4444" : "#16a34a" }}>
                        $ {fmt(Math.abs(saldoActual))}
                    </span>
                </div>
            </div>
        </div>

        {/* NOTAS */}
        {estado.notas?.trim() && (
          <div style={{ padding: "20px 32px", borderBottom: "1px solid #f0f2f5" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--primary-blue)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
              Observaciones
            </div>
            <p style={{ fontSize: "0.9rem", color: "#555", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{estado.notas}</p>
          </div>
        )}

        {/* PIE */}
        <div style={{ padding: "16px 32px", background: "#f8f9fc", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <span style={{ fontSize: "0.78rem", color: "#999", fontStyle: "italic" }}>
            Documento informativo de seguimiento de costos.
          </span>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--primary-blue)" }}>
            ARIFA — Protección contra Incendios
          </span>
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "0.9rem", color: "#333", fontWeight: 500 }}>{value}</div>
    </div>
  );
}
