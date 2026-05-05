"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { generatePresupuestoPDF } from "@/lib/pdfGenerator";
import { ArrowLeft, Edit, Scroll } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  pendiente: { bg: "#fffbeb", color: "#b45309" },
  aceptado:  { bg: "#dcfce7", color: "#166534" },
  cancelado: { bg: "#fee2e2", color: "#991b1b" },
};

export default function VerPresupuestoPage() {
  const [pres, setPres] = useState<any>(null);
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
        const [userDoc, presDoc] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDoc(doc(db, "presupuestos", id)),
        ]);
        const r = userDoc.exists() ? userDoc.data().rol : null;
        if (r === "tecnico") { router.push("/admin"); return; }
        setRole(r);
        if (presDoc.exists()) {
          setPres({ id: presDoc.id, ...presDoc.data() });
        } else {
          alert("Presupuesto no encontrado.");
          router.push("/admin/documentos/presupuestos");
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    });
    return () => unsub();
  }, [router, id]);

  const handleDownload = async () => {
    if (!pres) return;
    setDownloading(true);
    try { await generatePresupuestoPDF(pres); }
    catch (e) { console.error(e); alert("Error al generar el PDF."); }
    finally { setDownloading(false); }
  };

  const isReadOnly = role === "cliente";
  const isStaff = ["admin", "superadmin", "secretaria"].includes(role || "");

  if (loading) return <div style={{ padding: "100px", textAlign: "center", color: "var(--text-muted)" }}>Cargando...</div>;
  if (!pres) return null;

  const presNum = String(pres.numero || "?").padStart(5, "0");
  const fecStr = pres.fecha ? new Date(pres.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";
  const ec = ESTADO_COLORS[pres.estado] || ESTADO_COLORS.pendiente;
  const empresa = pres.sedeNombre
    ? `${pres.clienteEmpresa || "-"} — Sede: ${pres.sedeNombre}`
    : (pres.clienteEmpresa || "");

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 15px 60px" }}>
      {/* ACCIONES */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <button
          onClick={() => router.push("/admin/documentos/presupuestos")}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: "0.9rem" }}
        >
          <ArrowLeft size={18} /> Volver a Presupuestos
        </button>
        <div style={{ display: "flex", gap: "10px" }}>
          {isStaff && (
            <Link
              href={`/admin/documentos/presupuestos/nuevo?edit=${id}`}
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
                Presupuesto
              </div>
              <div style={{ color: "#fff", fontSize: "1.8rem", fontWeight: 900, letterSpacing: "1px" }}>
                P-{presNum}
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
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Validez: </span>
                <span style={{ color: "#fff", fontWeight: 700 }}>{pres.validezDias || 15} días</span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Emitido por: </span>
                <span style={{ color: "#fff", fontWeight: 700 }}>{pres.creadoPorNombre || "ARIFA"}</span>
              </div>
              <span style={{ marginTop: "6px", fontSize: "0.72rem", padding: "4px 10px", borderRadius: "20px", fontWeight: 900, textTransform: "uppercase", background: ec.bg, color: ec.color }}>
                {pres.estado || "pendiente"}
              </span>
            </div>
          </div>
        </div>

        {/* DATOS DEL CLIENTE */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #f0f2f5" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--primary-blue)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
            Datos del Cliente
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 30px" }}>
            <DataRow label="Nombre / Contacto" value={`${pres.clienteNombre || "-"}${pres.clienteApellido ? " " + pres.clienteApellido : ""}`} />
            <DataRow label="Empresa / Sede" value={empresa || pres.clienteNombre || "-"} />
            <DataRow label="DNI / CUIT" value={pres.clienteDniCuit || "-"} />
            <DataRow label="Teléfono" value={pres.clienteTelefono || "-"} />
            <DataRow label="Email" value={pres.clienteEmail || "-"} />
            <DataRow label="Dirección" value={pres.clienteDireccion || "-"} />
          </div>
        </div>

        {/* ÍTEMS */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #f0f2f5" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--primary-blue)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
            Detalle de Servicios / Productos
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--primary-blue)" }}>
                  {["Cant.", "Descripción", "P. Unitario", "Subtotal"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: h === "Cant." ? "center" : h === "Descripción" ? "left" : "right", fontSize: "0.75rem", color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(pres.items || []).map((item: any, idx: number) => (
                  <tr key={item.id || idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f8f9fc", borderBottom: "1px solid #f0f2f5" }}>
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#555" }}>{item.cantidad}</td>
                    <td style={{ padding: "12px 14px", fontSize: "0.9rem", color: "#333" }}>{item.descripcion}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "0.9rem", color: "#555" }}>$ {fmt(item.precioUnitario || 0)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "var(--primary-blue)" }}>$ {fmt(item.subtotal || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOTALES */}
        <div style={{ padding: "20px 32px", borderBottom: "1px solid #f0f2f5", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: "300px" }}>
            <TotalRow label="Subtotal" value={`$ ${fmt(pres.subtotal || 0)}`} />
            {(pres.descuentoMonto || 0) > 0 && (
              <TotalRow
                label={`Descuento${pres.descuentoTipo === "porcentaje" ? ` (${pres.descuentoValor}%)` : ""}`}
                value={`- $ ${fmt(pres.descuentoMonto || 0)}`}
                color="#dc2626"
              />
            )}
            {(pres.impuestoMonto || 0) > 0 && (
              <TotalRow
                label={`Impuesto${pres.impuestoTipo === "porcentaje" ? ` (${pres.impuestoValor}%)` : ""}`}
                value={`+ $ ${fmt(pres.impuestoMonto || 0)}`}
                color="#16a34a"
              />
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 4px", borderTop: "2px solid var(--primary-blue)", marginTop: "6px" }}>
              <span style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--primary-blue)" }}>TOTAL</span>
              <span style={{ fontWeight: 900, fontSize: "1.2rem", color: "var(--primary-red)" }}>$ {fmt(pres.total || 0)}</span>
            </div>
          </div>
        </div>

        {/* NOTAS */}
        {pres.notas?.trim() && (
          <div style={{ padding: "20px 32px", borderBottom: "1px solid #f0f2f5" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--primary-blue)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
              Notas / Condiciones
            </div>
            <p style={{ fontSize: "0.9rem", color: "#555", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{pres.notas}</p>
          </div>
        )}

        {/* PIE */}
        <div style={{ padding: "16px 32px", background: "#f8f9fc", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <span style={{ fontSize: "0.78rem", color: "#999", fontStyle: "italic" }}>
            Este presupuesto tiene validez de {pres.validezDias || 15} días desde su fecha de emisión.
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

function TotalRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f2f5", fontSize: "0.9rem" }}>
      <span style={{ color: color || "#666" }}>{label}</span>
      <span style={{ fontWeight: 700, color: color || "#333" }}>{value}</span>
    </div>
  );
}
