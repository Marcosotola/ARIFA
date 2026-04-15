"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Certificado {
  id: string;
  numero: number;
  fechaInspeccion: string;
  fechaVencimiento: string;
  rubro: string;
  sistemaCertificado: string;
  clienteNombre: string;
  clienteEmpresa: string;
  estado: "borrador" | "emitido";
  createdAt: any;
}

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  borrador: { bg: "#f5f5f5", color: "#666" },
  emitido:  { bg: "#e8f5e9", color: "#2e7d32" },
};

export default function CertificadosPage() {
  const [certs, setCerts] = useState<Certificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "usuarios", u.uid));
      const r = snap.exists() ? snap.data().rol : "cliente";
      setRole(r);
      fetchCerts();
    });
    return () => unsub();
  }, []);

  const fetchCerts = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "certificados"), orderBy("createdAt", "desc")));
      setCerts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Certificado)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "certificados", id));
      setCerts(p => p.filter(c => c.id !== id));
      setDeleteConfirm(null);
    } catch (e) { alert("Error: " + e); }
  };

  const isStaff = role === "admin" || role === "tecnico";

  return (
    <div style={{ maxWidth: "1100px" }}>
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <span style={{ fontSize: "0.8rem", background: "#e8f5e9", color: "#2e7d32", padding: "3px 10px", borderRadius: "20px", fontWeight: 700 }}>
            📜 Certificados
          </span>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)", marginTop: "8px" }}>Certificados de Instalación</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Generá y gestioná certificados con carácter de Declaración Jurada.</p>
        </div>
        {isStaff && (
          <Link href="/admin/certificados/nuevo" className="btn-red" style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            ➕ Nuevo Certificado
          </Link>
        )}
      </header>

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando certificados...</div>
        ) : certs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "15px" }}>📜</div>
            <p style={{ color: "var(--text-muted)" }}>No hay certificados emitidos aún.</p>
            {isStaff && (
              <Link href="/admin/certificados/nuevo" className="btn-red" style={{ display: "inline-block", marginTop: "20px", padding: "12px 28px" }}>
                Crear primer certificado
              </Link>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "650px" }}>
              <thead>
                <tr style={{ background: "#f8f9fc", borderBottom: "2px solid #eef0f3" }}>
                  {["N° Cert.", "Fecha", "Vigencia", "Cliente", "Sistema", "Rubro", "Estado", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {certs.map(c => {
                  const ec = ESTADO_COLORS[c.estado] || ESTADO_COLORS.borrador;
                  const venc = c.fechaVencimiento ? new Date(c.fechaVencimiento) : null;
                  const vencido = venc && venc < new Date();
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f2f5f9" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-blue)" }}>
                          N°{String(c.numero || "?").padStart(4, "0")}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.88rem", color: "#555", whiteSpace: "nowrap" }}>
                        {c.fechaInspeccion ? new Date(c.fechaInspeccion).toLocaleDateString("es-AR") : "-"}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.88rem", whiteSpace: "nowrap" }}>
                        <span style={{ color: vencido ? "#c62828" : "#2e7d32", fontWeight: 700 }}>
                          {venc ? venc.toLocaleDateString("es-AR") : "-"}
                        </span>
                        {vencido && <span style={{ display: "block", fontSize: "0.68rem", color: "#c62828" }}>VENCIDO</span>}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{c.clienteNombre || "-"}</div>
                        {c.clienteEmpresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{c.clienteEmpresa}</div>}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.82rem", color: "#555", maxWidth: "180px" }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.sistemaCertificado || "-"}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: "0.72rem", background: "#f0f4ff", color: "var(--primary-blue)", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
                          {c.rubro || "-"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: "20px", fontWeight: 800, textTransform: "capitalize", background: ec.bg, color: ec.color }}>
                          {c.estado || "borrador"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <Link href={`/admin/certificados/${c.id}`} style={{ padding: "7px 12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", fontSize: "0.82rem", fontWeight: 600, color: "var(--primary-blue)", whiteSpace: "nowrap" }}>
                            Ver / Editar
                          </Link>
                          {role === "admin" && (
                            <button onClick={() => setDeleteConfirm(c.id)} style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #ffddd9", background: "#fff5f4", cursor: "pointer", color: "var(--primary-red)" }}>
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar certificado?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
