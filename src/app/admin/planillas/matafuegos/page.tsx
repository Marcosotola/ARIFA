"use client";
import { useEffect, useState, useCallback } from "react";
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

interface Ficha {
  id: string;
  numeroFicha: number;
  fechaServicio: string;
  clienteNombre: string;
  clienteEmpresa: string;
  tecnicoNombre: string;
  items: any[];
  createdAt: any;
}

export default function MatafuegosUnifiedPage() {
  const [activeTab, setActiveTab] = useState<"remitos" | "fichas">("remitos");
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: "remito" | "ficha" } | null>(null);
  
  // Filtros
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const router = useRouter();

  const fetchRemitos = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "remitos_matafuegos"), orderBy("numero", "desc"));
      const snap = await getDocs(q);
      setRemitos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Remito)));
    } catch (e) {
      const snap = await getDocs(collection(db, "remitos_matafuegos"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Remito));
      setRemitos(data.sort((a,b) => (b.numero || 0) - (a.numero || 0)));
    } finally { setLoading(false); }
  }, []);

  const fetchFichas = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "mantenimiento_matafuegos"), orderBy("numeroFicha", "desc"));
      const snap = await getDocs(q);
      setFichas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ficha)));
    } catch (e) {
      const snap = await getDocs(collection(db, "mantenimiento_matafuegos"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ficha));
      setFichas(data.sort((a,b) => (b.numeroFicha || 0) - (a.numeroFicha || 0)));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      setRole(userDoc.exists() ? userDoc.data().rol : "cliente");
      if (activeTab === "remitos") fetchRemitos();
      else fetchFichas();
    });
    return () => unsub();
  }, [router, activeTab, fetchRemitos, fetchFichas]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const col = deleteConfirm.type === "remito" ? "remitos_matafuegos" : "mantenimiento_matafuegos";
      await deleteDoc(doc(db, col, deleteConfirm.id));
      if (deleteConfirm.type === "remito") setRemitos(prev => prev.filter(r => r.id !== deleteConfirm.id));
      else setFichas(prev => prev.filter(f => f.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (e) {
      alert("Error al eliminar.");
    }
  };

  const filteredRemitos = remitos.filter(r => {
    const matchesSearch = String(r.numero).includes(search) || r.clienteNombre?.toLowerCase().includes(search.toLowerCase()) || r.clienteEmpresa?.toLowerCase().includes(search.toLowerCase());
    const rDate = r.fecha ? new Date(r.fecha) : null;
    let matchesDate = true;
    if (rDate) {
      if (dateFrom && rDate < new Date(dateFrom)) matchesDate = false;
      if (dateTo && rDate > new Date(dateTo)) matchesDate = false;
    }
    return matchesSearch && matchesDate;
  });

  const filteredFichas = fichas.filter(f => {
    const matchesSearch = String(f.numeroFicha).includes(search) || f.clienteNombre?.toLowerCase().includes(search.toLowerCase()) || f.clienteEmpresa?.toLowerCase().includes(search.toLowerCase());
    const fDate = f.fechaServicio ? new Date(f.fechaServicio) : null;
    let matchesDate = true;
    if (fDate) {
      if (dateFrom && fDate < new Date(dateFrom)) matchesDate = false;
      if (dateTo && fDate > new Date(dateTo)) matchesDate = false;
    }
    return matchesSearch && matchesDate;
  });

  const isStaff = role === "admin" || role === "tecnico" || role === "superadmin";
  const isAdmin = role === "admin" || role === "superadmin";

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* HEADER */}
      <header style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Matafuegos</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Gestión de logística y taller técnico.</p>
        </div>
        {isStaff && (
          <Link 
            href={activeTab === "remitos" ? "/admin/planillas/matafuegos/nuevo" : "/admin/planillas/matafuegos/mantenimiento/nuevo"} 
            className="btn-red" 
            style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            {activeTab === "remitos" ? "➕ NUEVO REMITO" : "➕ NUEVA FICHA"}
          </Link>
        )}
      </header>

      {/* TABS (Segmented Control style) */}
      <div style={{ 
        display: "inline-flex", 
        background: "#e2e8f0", 
        padding: "4px", 
        borderRadius: "12px", 
        marginBottom: "24px",
        gap: "4px"
      }}>
        <button 
          onClick={() => { setActiveTab("remitos"); setSearch(""); }}
          style={{ 
            padding: "10px 30px", 
            cursor: "pointer", 
            borderWidth: 0,
            borderStyle: "none",
            borderRadius: "10px",
            fontSize: "0.85rem", 
            fontWeight: 800, 
            transition: "0.2s",
            background: activeTab === "remitos" ? "#fff" : "transparent",
            color: activeTab === "remitos" ? "var(--primary-blue)" : "#64748b",
            boxShadow: activeTab === "remitos" ? "0 4px 10px rgba(0,0,0,0.08)" : "none",
          }}>
          📦 Remitos
        </button>
        <button 
          onClick={() => { setActiveTab("fichas"); setSearch(""); }}
          style={{ 
            padding: "10px 30px", 
            cursor: "pointer", 
            borderWidth: 0,
            borderStyle: "none",
            borderRadius: "10px",
            fontSize: "0.85rem", 
            fontWeight: 800, 
            transition: "0.2s",
            background: activeTab === "fichas" ? "#fff" : "transparent",
            color: activeTab === "fichas" ? "var(--primary-blue)" : "#64748b",
            boxShadow: activeTab === "fichas" ? "0 4px 10px rgba(0,0,0,0.08)" : "none",
          }}>
          🛠️ Fichas
        </button>
      </div>

      {/* FILTROS */}
      <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
        <div style={{ flex: 1, minWidth: "220px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>
            Buscar por {activeTab === "remitos" ? "Remito" : "Ficha"} o Cliente
          </label>
          <input 
            type="text" 
            placeholder="Número, cliente o empresa..." 
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

      {/* CONTENIDO */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando datos...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
              <thead>
                <tr style={{ background: "#f8f9fc", borderBottom: "2px solid #eef0f3" }}>
                  <th style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>
                    {activeTab === "remitos" ? "N° REMITO" : "N° FICHA"}
                  </th>
                  <th style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>
                    {activeTab === "remitos" ? "TIPO" : "FECHA"}
                  </th>
                  {activeTab === "remitos" && <th style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>FECHA</th>}
                  <th style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>CLIENTE / EMPRESA</th>
                  <th style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>EQUIPOS</th>
                  <th style={{ textAlign: "right", padding: "14px 16px" }}></th>
                </tr>
              </thead>
              <tbody>
                {activeTab === "remitos" ? (
                  filteredRemitos.map(r => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f2f5f9" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: "var(--primary-blue)" }}>R-{String(r.numero || "?").padStart(5, "0")}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: "0.65rem", padding: "4px 8px", borderRadius: "10px", fontWeight: 900, textTransform: "uppercase", background: r.tipo === "retiro" ? "#fee2e2" : "#dcfce7", color: r.tipo === "retiro" ? "#b91c1c" : "#166534" }}>{r.tipo}</span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.85rem" }}>{r.fecha ? new Date(r.fecha).toLocaleDateString("es-AR") : "-"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{r.clienteNombre}</div>
                        <div style={{ fontSize: "0.75rem", color: "#888" }}>{r.clienteEmpresa}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.85rem", fontWeight: 600 }}>{r.equipos?.length || 0} u.</td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                          <Link href={`/admin/planillas/matafuegos/${r.id}`} style={{ padding: "6px 10px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", textDecoration: "none", fontSize: "0.75rem", fontWeight: 700 }}>Editar</Link>
                          {isAdmin && <button onClick={() => setDeleteConfirm({ id: r.id, type: "remito" })} style={{ padding: "6px 10px", borderRadius: "6px", border: "none", background: "#fee2e2", color: "#b91c1c", cursor: "pointer" }}>🗑️</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  filteredFichas.map(f => (
                    <tr key={f.id} style={{ borderBottom: "1px solid #f2f5f9" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: "var(--primary-blue)" }}>FT-{String(f.numeroFicha || "?").padStart(5, "0")}</td>
                      <td style={{ padding: "14px 16px", fontSize: "0.85rem" }}>{f.fechaServicio ? new Date(f.fechaServicio).toLocaleDateString("es-AR") : "-"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{f.clienteNombre}</div>
                        <div style={{ fontSize: "0.75rem", color: "#888" }}>{f.clienteEmpresa}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.85rem" }}>
                        <span style={{ background: "#f0f4ff", color: "#3b82f6", padding: "3px 8px", borderRadius: "10px", fontWeight: 800 }}>{f.items?.length || 0} Extintores</span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                          <Link href={`/admin/planillas/matafuegos/mantenimiento/${f.id}`} style={{ padding: "6px 10px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", textDecoration: "none", fontSize: "0.75rem", fontWeight: 700 }}>Editar</Link>
                          {isAdmin && <button onClick={() => setDeleteConfirm({ id: f.id, type: "ficha" })} style={{ padding: "6px 10px", borderRadius: "6px", border: "none", background: "#fee2e2", color: "#b91c1c", cursor: "pointer" }}>🗑️</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {((activeTab === "remitos" && filteredRemitos.length === 0) || (activeTab === "fichas" && filteredFichas.length === 0)) && (
              <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>No se encontraron registros.</div>
            )}
          </div>
        )}
      </div>

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%", textAlign: "center" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar este registro?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleDelete} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
