"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Remito {
  id: string;
  numero: number;
  tipo: "retiro" | "entrega";
  fecha: string;
  clienteNombre: string;
  clienteEmpresa: string;
  tecnicoNombre: string;
  equipos?: any[];
  createdAt: any;
}

export default function RemitosListPage() {
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Filtros
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      setRole(userDoc.exists() ? userDoc.data().rol : "cliente");
      fetchRemitos();
    });
    return () => unsub();
  }, [router]);

  const fetchRemitos = async () => {
    try {
      // Intentamos ordenar; si falla porque no hay índice, lo traemos normal y ordenamos localmente
      const q = query(collection(db, "remitos_matafuegos"), orderBy("numero", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Remito));
      setRemitos(data);
    } catch (e) {
      console.warn("Falla de índice, cargando sin ordenamiento:", e);
      const snap = await getDocs(collection(db, "remitos_matafuegos"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Remito));
      setRemitos(data.sort((a,b) => (b.numero || 0) - (a.numero || 0)));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "remitos_matafuegos", id));
      setRemitos(prev => prev.filter(r => r.id !== id));
      setDeleteConfirm(null);
    } catch (e) {
      alert("Error al eliminar el remito.");
    }
  };

  const filteredRemitos = remitos.filter(r => {
    const matchesSearch = 
      String(r.numero).includes(search) || 
      r.clienteNombre?.toLowerCase().includes(search.toLowerCase()) ||
      r.clienteEmpresa?.toLowerCase().includes(search.toLowerCase());
    
    const rDate = r.fecha ? new Date(r.fecha) : null;
    let matchesDate = true;
    if (rDate) {
      if (dateFrom && rDate < new Date(dateFrom)) matchesDate = false;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (rDate > toDate) matchesDate = false;
      }
    }
    return matchesSearch && matchesDate;
  });

  const isAdmin = role === "admin";

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* HEADER ESTILO UNIFICADO */}
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.8rem", background: "#fee2e2", color: "#b91c1c", padding: "3px 10px", borderRadius: "20px", fontWeight: 800 }}>
              📦 Planillas / Matafuegos - Logística
            </span>
          </div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Movimientos de Extintores</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Registro de retiros para recarga y entregas a clientes.</p>
        </div>
        {(role === "admin" || role === "tecnico") && (
          <Link href="/admin/planillas/matafuegos/nuevo" className="btn-red" style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            ➕ NUEVO REMITO
          </Link>
        )}
      </header>

      {/* FILTROS */}
      <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
        <div style={{ flex: 1, minWidth: "220px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Buscar por Remito o Cliente</label>
          <input 
            type="text" 
            placeholder="N°, cliente o empresa..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.9rem" }}
          />
        </div>
        <div style={{ width: "160px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Desde</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }} />
        </div>
        <div style={{ width: "160px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Hasta</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }} />
        </div>
        <button onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }} style={{ padding: "10px 15px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#666" }}>Limpiar</button>
      </div>

      {/* TABLA UNIFICADA */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando remitos...</div>
        ) : filteredRemitos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "15px", filter: "grayscale(1)", opacity: 0.3 }}>📦</div>
            <h3 style={{ fontWeight: 800, color: "#999", marginBottom: "8px" }}>No se encontraron remitos</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Intentá con otros filtros o creá un nuevo registro.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
              <thead>
                <tr style={{ background: "#f8f9fc", borderBottom: "2px solid #eef0f3" }}>
                  {["N° REMITO", "TIPO", "FECHA", "CLIENTE / EMPRESA", "EQUIPOS", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRemitos.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f2f5f9", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-blue)" }}>
                        R-{String(r.numero || "?").padStart(5, "0")}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ 
                        fontSize: "0.68rem", padding: "4px 10px", borderRadius: "20px", fontWeight: 800, textTransform: "uppercase",
                        background: r.tipo === "retiro" ? "#fff1f2" : "#f0fdf4",
                        color: r.tipo === "retiro" ? "#e11d48" : "#166534"
                      }}>
                        {r.tipo}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "0.88rem", color: "#555" }}>
                      {r.fecha ? new Date(r.fecha).toLocaleDateString("es-AR") : "-"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{r.clienteNombre || "-"}</div>
                      {r.clienteEmpresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{r.clienteEmpresa}</div>}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: "0.8rem", color: "#444", fontWeight: 600 }}>{r.equipos?.length || 0} unidades</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: 'flex-end' }}>
                        <Link href={`/admin/planillas/matafuegos/${r.id}`} style={{ padding: "7px 12px", borderRadius: "6px", border: "1px solid #ddd", background: "#fff", fontSize: "0.82rem", fontWeight: 600, color: "var(--primary-blue)", textDecoration: 'none' }}>
                          Ver / Editar
                        </Link>
                        {isAdmin && (
                          <button onClick={() => setDeleteConfirm(r.id)} style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #ffddd9", background: "#fff5f4", cursor: "pointer", color: "var(--primary-red)", fontSize: "0.82rem" }}>
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL ELIMINAR */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar este Remito?</h3>
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
