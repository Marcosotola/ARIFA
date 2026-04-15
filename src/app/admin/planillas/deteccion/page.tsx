"use client";
import { useEffect, useState } from "react";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, query, orderBy, where, doc, getDoc, deleteDoc
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
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

export default function DeteccionPage() {
  const [ots, setOts] = useState<OT[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
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
      if (r === "admin" || r === "tecnico") {
        q = query(collection(db, "ordenes_trabajo"), orderBy("createdAt", "desc"));
      } else {
        q = query(collection(db, "ordenes_trabajo"), where("clienteId", "==", uid), orderBy("createdAt", "desc"));
      }
      const snap = await getDocs(q);
      setOts(snap.docs.map(d => ({ id: d.id, ...d.data() } as OT)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const docRef = doc(db, "ordenes_trabajo", id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fotos = data.fotos || [];
        // Delete each photo from Storage
        for (const url of fotos) {
          try {
            const picRef = ref(storage, url);
            await deleteObject(picRef);
          } catch (err) {
            console.error("Error eliminando imagen de storage:", err);
          }
        }
      }

      await deleteDoc(docRef);
      setOts(prev => prev.filter(o => o.id !== id));
      setDeleteConfirm(null);
    } catch (e) { alert("Error al eliminar: " + e); }
  };

  const isStaff = role === "admin" || role === "tecnico";

  const filteredOts = ots.filter(ot => {
    const matchesSearch = 
      String(ot.numero).includes(search) || 
      ot.clienteNombre?.toLowerCase().includes(search.toLowerCase()) ||
      ot.clienteEmpresa?.toLowerCase().includes(search.toLowerCase());
    
    const otDate = ot.fecha ? new Date(ot.fecha) : null;
    let matchesDate = true;
    if (otDate) {
      if (dateFrom && otDate < new Date(dateFrom)) matchesDate = false;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (otDate > toDate) matchesDate = false;
      }
    } else if (dateFrom || dateTo) {
      matchesDate = false; // If filtering by date but OT has no date, exclude it
    }
    
    return matchesSearch && matchesDate;
  });

  return (
    <div style={{ maxWidth: "1100px" }}>
      {/* Header */}
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.8rem", background: "#e3f2fd", color: "#1565c0", padding: "3px 10px", borderRadius: "20px", fontWeight: 700 }}>
              🔍 Planillas / Detección y Extinción
            </span>
          </div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Órdenes de Trabajo</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Sistema de Detección de Incendios — planillas de inspección y prueba.</p>
        </div>
        {isStaff && (
          <Link href="/admin/planillas/deteccion/nueva" className="btn-red" style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            ➕ Nueva OT
          </Link>
        )}
      </header>

      {/* FILTERS */}
      <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
        <div style={{ flex: 1, minWidth: "220px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Buscar por OT o Cliente</label>
          <input 
            type="text" 
            placeholder="N°, nombre, empresa..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.9rem" }}
          />
        </div>
        <div style={{ width: "160px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Desde</label>
          <input 
            type="date" 
            value={dateFrom} 
            onChange={e => setDateFrom(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }}
          />
        </div>
        <div style={{ width: "160px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Hasta</label>
          <input 
            type="date" 
            value={dateTo} 
            onChange={e => setDateTo(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }}
          />
        </div>
        <button 
          onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
          style={{ padding: "10px 15px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#666" }}
        >
          Limpiar
        </button>
      </div>

      {/* TABLE */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando órdenes...</div>
        ) : filteredOts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "15px", filter: "grayscale(1)", opacity: 0.3 }}>📋</div>
            <h3 style={{ fontWeight: 800, color: "#999", marginBottom: "8px" }}>No se encontraron resultados</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Ajustá los filtros para ver otras órdenes de trabajo.</p>
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
                {filteredOts.map(ot => {
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
                            <span key={i} style={{ fontSize: "0.68rem", background: "#f0f4ff", color: "#3557a0", padding: "2px 7px", borderRadius: "10px", fontWeight: 600, whiteSpace: "nowrap" }}>
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
                          <Link href={`/admin/planillas/deteccion/${ot.id}`} style={{ padding: "7px 12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", fontSize: "0.82rem", fontWeight: 600, color: "var(--primary-blue)", whiteSpace: "nowrap" }}>
                            Ver / Editar
                          </Link>
                          {['firmada', 'completada'].includes(ot.estado) && (
                            <Link href={`/admin/certificados/nuevo?fromOt=${ot.id}`} style={{ padding: "7px 12px", borderRadius: "6px", border: "1px solid #e8f5e9", background: "#e8f5e9", fontSize: "0.82rem", fontWeight: 700, color: "#2e7d32", whiteSpace: "nowrap" }}>
                              📜 Certificar
                            </Link>
                          )}
                          {role === "admin" && (
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
