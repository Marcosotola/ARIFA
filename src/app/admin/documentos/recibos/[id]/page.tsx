"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { generateReciboPDF } from "@/lib/pdfGenerator";
import { ArrowLeft, Edit, Scroll } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  emitido: { bg: "#dcfce7", color: "#166534" },
  anulado: { bg: "#fee2e2", color: "#991b1b" },
};

const FORMA_PAGO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia bancaria",
  cheque: "Cheque",
  tarjeta_credito: "Tarjeta de crédito",
  tarjeta_debito: "Tarjeta de débito",
  otro: "Otro",
};

export default function VerReciboPage() {
  const [recibo, setRecibo] = useState<any>(null);
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
        const [userDoc, reciboDoc] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDoc(doc(db, "recibos", id)),
        ]);
        const r = userDoc.exists() ? userDoc.data().rol : null;
        if (r === "tecnico") { router.push("/admin"); return; }
        setRole(r);
        if (reciboDoc.exists()) {
          setRecibo({ id: reciboDoc.id, ...reciboDoc.data() });
        } else {
          alert("Recibo no encontrado.");
          router.push("/admin/documentos/recibos");
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    });
    return () => unsub();
  }, [router, id]);

  const handleDownload = async () => {
    if (!recibo) return;
    setDownloading(true);
    try { await generateReciboPDF(recibo); }
    catch (e) { console.error(e); alert("Error al generar el PDF."); }
    finally { setDownloading(false); }
  };

  const isStaff = ["admin", "superadmin", "secretaria"].includes(role || "");

  if (loading) return <div style={{ padding: "100px", textAlign: "center", color: "var(--text-muted)" }}>Cargando...</div>;
  if (!recibo) return null;

  const rcNum = String(recibo.numero || "?").padStart(5, "0");
  const fecStr = recibo.fecha ? new Date(recibo.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";
  const ec = ESTADO_COLORS[recibo.estado] || ESTADO_COLORS.emitido;
  const empresa = recibo.sedeNombre
    ? `${recibo.clienteEmpresa || "-"} — Sede: ${recibo.sedeNombre}`
    : (recibo.clienteEmpresa || "");

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 15px 60px" }}>
      {/* ACCIONES */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <button
          onClick={() => router.push("/admin/documentos/recibos")}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: "0.9rem" }}
        >
          <ArrowLeft size={18} /> Volver a Recibos
        </button>
        <div style={{ display: "flex", gap: "10px" }}>
          {isStaff && (
            <Link
              href={`/admin/documentos/recibos/nuevo?edit=${id}`}
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
                Recibo de Cobro
              </div>
              <div style={{ color: "#fff", fontSize: "1.8rem", fontWeight: 900, letterSpacing: "1px" }}>
                RC-{rcNum}
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
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Emitido por: </span>
                <span style={{ color: "#fff", fontWeight: 700 }}>{recibo.creadoPorNombre || "ARIFA"}</span>
              </div>
              <span style={{ marginTop: "6px", fontSize: "0.72rem", padding: "4px 10px", borderRadius: "20px", fontWeight: 900, textTransform: "uppercase", background: ec.bg, color: ec.color }}>
                {recibo.estado || "emitido"}
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
            <DataRow label="Nombre / Contacto" value={`${recibo.clienteNombre || "-"}${recibo.clienteApellido ? " " + recibo.clienteApellido : ""}`} />
            <DataRow label="Empresa / Sede" value={empresa || recibo.clienteNombre || "-"} />
            <DataRow label="DNI / CUIT" value={recibo.clienteDniCuit || "-"} />
            <DataRow label="Teléfono" value={recibo.clienteTelefono || "-"} />
            <DataRow label="Email" value={recibo.clienteEmail || "-"} />
            <DataRow label="Dirección" value={recibo.clienteDireccion || "-"} />
          </div>
        </div>

        {/* DATOS DEL COBRO */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #f0f2f5" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--primary-blue)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
            Detalle del Cobro
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 30px", marginBottom: "16px" }}>
            <DataRow label="Forma de Pago" value={FORMA_PAGO_LABELS[recibo.formaPago] || recibo.formaPago || "-"} />
            <div>
              <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase", marginBottom: "2px" }}>Monto Recibido</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--primary-red)" }}>$ {fmt(recibo.monto || 0)}</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase", marginBottom: "6px" }}>Concepto</div>
            <div style={{ fontSize: "0.95rem", color: "#333", lineHeight: 1.6, background: "#f8f9fc", padding: "14px 16px", borderRadius: "10px", whiteSpace: "pre-wrap" }}>
              {recibo.concepto || "-"}
            </div>
          </div>
          {recibo.observaciones?.trim() && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase", marginBottom: "6px" }}>Observaciones</div>
              <p style={{ fontSize: "0.9rem", color: "#555", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{recibo.observaciones}</p>
            </div>
          )}
        </div>

        {/* FIRMA */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #f0f2f5" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--primary-blue)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>
            Firma del Receptor
          </div>
          <div style={{ display: "flex", gap: "40px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              {recibo.firmaReceptor ? (
                <div style={{ border: "1px solid #eee", borderRadius: "10px", overflow: "hidden", background: "#fafbfc", marginBottom: "8px" }}>
                  <img
                    src={recibo.firmaReceptor}
                    alt="Firma del receptor"
                    style={{ display: "block", width: "100%", maxHeight: "120px", objectFit: "contain" }}
                  />
                </div>
              ) : (
                <div style={{ border: "1px dashed #ddd", borderRadius: "10px", height: "80px", display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: "0.8rem", marginBottom: "8px" }}>
                  Sin firma
                </div>
              )}
              <div style={{ borderTop: "1.5px solid #333", paddingTop: "6px", textAlign: "center" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#444" }}>
                  {recibo.nombreReceptor || "—"}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#aaa", textTransform: "uppercase" }}>Firma y aclaración</div>
              </div>
            </div>
          </div>
        </div>

        {/* PIE */}
        <div style={{ padding: "16px 32px", background: "#f8f9fc", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <span style={{ fontSize: "0.78rem", color: "#999", fontStyle: "italic" }}>
            Recibo emitido el {fecStr}.
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
