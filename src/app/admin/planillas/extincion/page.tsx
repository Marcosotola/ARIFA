"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, query, orderBy, where, doc, getDoc, deleteDoc
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface OT {
  id: string;
  numero: number;
  fecha: string;
  clienteNombre: string;
  clienteEmpresa: string;
  tecnicos: string[];
  estado: string;
  planillasSeleccionadas: { nombre: string; codigo?: string }[];
  createdAt: any;
}

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  borrador: { bg: "#f5f5f5", color: "#666" },
  en_proceso: { bg: "#fff3e0", color: "#e65100" },
  completada: { bg: "#e8f5e9", color: "#2e7d32" },
};

export default function ExtincionPage() {
  const [ots, setOts] = useState<OT[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      const r = userDoc.exists() ? userDoc.data().rol : "cliente";
      setRole(r);
      fetchOTs(r, u.uid);
    });
    return () => unsub();
  }, [router]);

  const fetchOTs = async (r: string, uid: string) => {
    setLoading(true);
    try {
      let q;
      if (r === "admin" || r === "tecnico" || r === "superadmin") {
        q = query(collection(db, "ordenes_trabajo_extincion"), orderBy("createdAt", "desc"));
      } else {
        q = query(collection(db, "ordenes_trabajo_extincion"), where("clienteId", "==", uid), orderBy("createdAt", "desc"));
      }
      const snap = await getDocs(q);
      setOts(snap.docs.map(d => ({ id: d.id, ...d.data() } as OT)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "ordenes_trabajo_extincion", id));
      setOts(prev => prev.filter(o => o.id !== id));
      setDeleteConfirm(null);
    } catch (e) { alert("Error al eliminar: " + e); }
  };

  const isStaff = role === "admin" || role === "tecnico" || role === "superadmin";

  return (
    <div style={{ maxWidth: "1100px" }}>
      {/* Header */}
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.8rem", background: "#fff3e0", color: "#e65100", padding: "3px 10px", borderRadius: "20px", fontWeight: 700 }}>
              🧯 Planillas / Extinción
            </span>
          </div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Órdenes de Trabajo — Extinción</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Sistema de Extinción de Incendios — Rociadores, Hidrantes y más.</p>
        </div>
        {isStaff && (
          <Link href="/admin/planillas/extincion/nueva" className="btn-red" style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            ➕ Nueva OT
          </Link>
        )}
      </header>

      {/* TABLE */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando órdenes...</div>
        ) : ots.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "15px" }}>🧯</div>
            <p style={{ color: "var(--text-muted)", fontSize: "1rem" }}>No hay órdenes de trabajo de extinción aún.</p>
            {isStaff && (
              <Link href="/admin/planillas/extincion/nueva" className="btn-red" style={{ margin: "20px auto 0", display: "inline-block", padding: "12px 28px" }}>
                Crear primera OT
              </Link>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
              <thead>
                <tr style={{ background: "#f8f9fc", borderBottom: "2px solid #eef0f3" }}>
                  {["N° OT", "Fecha", "Cliente / Empresa", "Planillas", "Técnico(s)", "Estado", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ots.map(ot => {
                  const ec = ESTADO_COLORS[ot.estado] || ESTADO_COLORS.borrador;
                  return (
                    <tr key={ot.id} style={{ borderBottom: "1px solid #f2f5f9", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-blue)" }}>
                          OT-{String(ot.numero || "?").padStart(4, "0")}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.88rem", color: "#555", whiteSpace: "nowrap" }}>
                        {ot.fecha ? new Date(ot.fecha).toLocaleDateString("es-AR") : "-"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{ot.clienteNombre || "-"}</div>
                        {ot.clienteEmpresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{ot.clienteEmpresa}</div>}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {(ot.planillasSeleccionadas || []).slice(0, 2).map((p, i) => (
                            <span key={i} style={{ fontSize: "0.68rem", background: "#fff3e0", color: "#e65100", padding: "2px 7px", borderRadius: "10px", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {p.nombre}
                            </span>
                          ))}
                          {(ot.planillasSeleccionadas || []).length > 2 && (
                            <span style={{ fontSize: "0.68rem", background: "#f5f5f5", color: "#888", padding: "2px 7px", borderRadius: "10px" }}>
                              +{ot.planillasSeleccionadas.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.85rem", color: "#666" }}>
                        {(ot.tecnicos || []).join(", ") || "-"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: "20px", fontWeight: 800, textTransform: "capitalize", background: ec.bg, color: ec.color }}>
                          {(ot.estado || "borrador").replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <Link href={`/admin/planillas/extincion/${ot.id}`} style={{ padding: "7px 12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", fontSize: "0.82rem", fontWeight: 600, color: "var(--primary-blue)", whiteSpace: "nowrap" }}>
                            {!isStaff ? "Ver Documento" : "Ver / Editar"}
                          </Link>
                          {(role === "admin" || role === "superadmin") && (
                            <button onClick={() => setDeleteConfirm(ot.id)} style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #ffddd9", background: "#fff5f4", cursor: "pointer", color: "var(--primary-red)", fontSize: "0.82rem" }}>
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

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar esta OT?</h3>
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
