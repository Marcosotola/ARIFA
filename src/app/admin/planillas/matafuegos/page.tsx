"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { generateMantenimientoPDF, generateRemitoPDF } from "@/lib/pdfGenerator";
import { 
  Package, 
  Settings, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Download,
  Scroll,
  ClipboardList,
  ShieldCheck
} from "lucide-react";

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

function MatafuegosUnifiedContent() {
  const [activeTab, setActiveTab] = useState<"remitos" | "fichas" | "inventario">("remitos");
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [matafuegos, setMatafuegos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: "remito" | "ficha" | "inventario" } | null>(null);
  const [editInventory, setEditInventory] = useState<any | null>(null);
  const [savingInventory, setSavingInventory] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  // Filtros
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "fichas" || tab === "remitos" || tab === "inventario") {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

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

  const fetchMatafuegos = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "matafuegos_activos"), orderBy("updatedAt", "desc"));
      const snap = await getDocs(q);
      setMatafuegos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error fetching matafuegos:", e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      setRole(userDoc.exists() ? userDoc.data().rol : "cliente");
      if (activeTab === "remitos") fetchRemitos();
      else if (activeTab === "fichas") fetchFichas();
      else fetchMatafuegos();
    });
    return () => unsub();
  }, [router, activeTab, fetchRemitos, fetchFichas, fetchMatafuegos]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      let col = "";
      if (deleteConfirm.type === "remito") col = "remitos_matafuegos";
      else if (deleteConfirm.type === "ficha") col = "mantenimiento_matafuegos";
      else if (deleteConfirm.type === "inventario") col = "matafuegos_activos";

      await deleteDoc(doc(db, col, deleteConfirm.id));
      
      if (deleteConfirm.type === "remito") setRemitos(prev => prev.filter(r => r.id !== deleteConfirm.id));
      else if (deleteConfirm.type === "ficha") setFichas(prev => prev.filter(f => f.id !== deleteConfirm.id));
      else if (deleteConfirm.type === "inventario") setMatafuegos(prev => prev.filter(m => m.id !== deleteConfirm.id));
      
      setDeleteConfirm(null);
    } catch (e) {
      alert("Error al eliminar.");
    }
  };

  const handleSaveInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInventory) return;
    setSavingInventory(true);
    try {
      const { id, ...data } = editInventory;
      await updateDoc(doc(db, "matafuegos_activos", id), {
        ...data,
        updatedAt: serverTimestamp()
      });
      setMatafuegos(prev => prev.map(m => m.id === id ? editInventory : m));
      setEditInventory(null);
      alert("Inventario actualizado.");
    } catch (e) {
      console.error(e);
      alert("Error al guardar cambios.");
    } finally {
      setSavingInventory(false);
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
  const isReadOnly = role === "cliente";

  const handleDownload = async (id: string, type: "remito" | "ficha") => {
    setDownloadingId(id);
    try {
      const collectionName = type === "remito" ? "remitos_matafuegos" : "mantenimiento_matafuegos";
      const snap = await getDoc(doc(db, collectionName, id));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        if (type === "remito") await generateRemitoPDF(data);
        else await generateMantenimientoPDF(data);
      }
    } catch (e) {
      console.error(e);
      alert("Error al descargar el PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

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
            style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px", textTransform: "uppercase", fontSize: "0.8rem", textDecoration: "none" }}>
            <Plus size={18} strokeWidth={3} /> {activeTab === "remitos" ? "Nuevo Remito" : "Nueva Ficha"}
          </Link>
        )}
      </header>

      {/* TABS (Segmented Control style) */}
      <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '6px', borderRadius: '14px', marginBottom: '24px', width: 'fit-content' }}>
        <button 
          onClick={() => { setActiveTab("remitos"); setSearch(""); }} 
          style={{ 
            padding: '10px 18px', borderRadius: '10px', border: '1.5px solid', 
            borderColor: activeTab === "remitos" ? '#ef4444' : '#fecaca',
            background: activeTab === "remitos" ? '#fff' : '#fef2f2', 
            fontWeight: 800, 
            color: '#ef4444', 
            cursor: 'pointer', 
            boxShadow: activeTab === "remitos" ? '0 4px 12px rgba(239, 68, 68, 0.15)' : 'none', 
            display: 'flex', alignItems: 'center', gap: '8px',
            transition: '0.3s'
          }}>
          <Package size={18} strokeWidth={2.5} /> Remitos
        </button>
        <button 
          onClick={() => { setActiveTab("fichas"); setSearch(""); }} 
          style={{ 
            padding: '10px 18px', borderRadius: '10px', border: '1.5px solid', 
            borderColor: activeTab === "fichas" ? '#3b82f6' : '#bfdbfe',
            background: activeTab === "fichas" ? '#fff' : '#eff6ff', 
            fontWeight: 800, 
            color: '#3b82f6', 
            cursor: 'pointer', 
            boxShadow: activeTab === "fichas" ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none', 
            display: 'flex', alignItems: 'center', gap: '8px',
            transition: '0.3s'
          }}>
          <ClipboardList size={18} strokeWidth={2.5} /> Fichas Técnicas
        </button>
        <button 
          onClick={() => { setActiveTab("inventario"); setSearch(""); }} 
          style={{ 
            padding: '10px 18px', borderRadius: '10px', border: '1.5px solid', 
            borderColor: activeTab === "inventario" ? '#10b981' : '#bbf7d0',
            background: activeTab === "inventario" ? '#fff' : '#f0fdf4', 
            fontWeight: 800, 
            color: '#10b981', 
            cursor: 'pointer', 
            boxShadow: activeTab === "inventario" ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none', 
            display: 'flex', alignItems: 'center', gap: '8px',
            transition: '0.3s'
          }}>
          <ShieldCheck size={18} strokeWidth={2.5} /> Inventario Equipos
        </button>
      </div>

      {/* FILTROS */}
      <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
        <div style={{ flex: 1, minWidth: "220px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>
            Buscar por {activeTab === "remitos" ? "Remito" : activeTab === "fichas" ? "Ficha" : "Tarjeta"}
          </label>
          <input 
            type="text" 
            placeholder="Buscar..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.9rem" }}
          />
        </div>
        {activeTab !== "inventario" && (
          <>
            <div style={{ width: "160px" }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Desde</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }} />
            </div>
            <div style={{ width: "160px" }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Hasta</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }} />
            </div>
          </>
        )}
        <button onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }} style={{ padding: "10px 15px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#666" }}>Limpiar</button>
      </div>

      {/* CONTENIDO */}
      {activeTab !== "inventario" && (
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
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <Link title="Ver Vista Previa" href={`/admin/planillas/matafuegos/${r.id}?view=true`} 
                              style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                              <Eye size={18} strokeWidth={2.5} />
                            </Link>
                            {!isReadOnly && (
                              <Link title="Ver / Editar" href={`/admin/planillas/matafuegos/nuevo?edit=${r.id}`} 
                               style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                               <Edit size={18} strokeWidth={2.5} />
                             </Link>
                            )}
                            <button title="Descargar PDF" onClick={() => handleDownload(r.id, "remito")} disabled={downloadingId === r.id} style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", opacity: downloadingId === r.id ? 0.5 : 1 }}>
                              <Scroll size={18} strokeWidth={2.5} />
                            </button>
                            {isAdmin && !isReadOnly && (
                              <button title="Eliminar" onClick={() => setDeleteConfirm({ id: r.id, type: "remito" })} style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", background: "#fef2f2", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Trash2 size={18} strokeWidth={2.5} />
                              </button>
                            )}
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
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <Link title="Ver Vista Previa" href={`/admin/planillas/matafuegos/mantenimiento/${f.id}?view=true`} 
                              style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                              <Eye size={18} strokeWidth={2.5} />
                            </Link>
                            {!isReadOnly && (
                              <Link title="Ver / Editar" href={`/admin/planillas/matafuegos/mantenimiento/nuevo?edit=${f.id}`} 
                               style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                               <Edit size={18} strokeWidth={2.5} />
                             </Link>
                            )}
                            <button title="Descargar PDF" onClick={() => handleDownload(f.id, "ficha")} disabled={downloadingId === f.id} style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", opacity: downloadingId === f.id ? 0.5 : 1 }}>
                              <Scroll size={18} strokeWidth={2.5} />
                            </button>
                            {isAdmin && !isReadOnly && (
                              <button title="Eliminar" onClick={() => setDeleteConfirm({ id: f.id, type: "ficha" })} style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", background: "#fef2f2", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Trash2 size={18} strokeWidth={2.5} />
                              </button>
                            )}
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
      )}

      {activeTab === "inventario" && (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #eee', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '800px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                <th style={{ padding: '15px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Tarjeta N°</th>
                <th style={{ padding: '15px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Cliente / Ubicación</th>
                <th style={{ padding: '15px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Equipo / Agente</th>
                <th style={{ padding: '15px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Historial PH</th>
                <th style={{ padding: '15px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Venc. Carga</th>
                <th style={{ padding: '15px', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {matafuegos.filter(m => 
                m.nroTarjeta?.toLowerCase().includes(search.toLowerCase())
              ).map((m, idx) => {
                const proxPH = m.historial?.proximaPH;
                const isUrgent = proxPH && new Date(proxPH) < new Date();
                
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f8fafc', transition: '0.2s', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '15px' }}>
                      <span style={{ 
                        background: '#fee2e2', 
                        color: '#b91c1c', 
                        padding: '5px 12px', 
                        borderRadius: '20px', 
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        border: '1px solid #fecaca'
                      }}>
                        {m.nroTarjeta}
                      </span>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary-blue)' }}>{m.clienteNombre || m.clienteId || "Carga Manual"}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>
                        {m.sedeNombre ? `📍 ${m.sedeNombre}` : (m.clienteEmpresa || "Sin empresa")}
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: 800, color: '#334155' }}>{m.datosTecnicos?.marca || "Sin Marca"} - {m.datosTecnicos?.capacidad}</div>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 900, 
                        padding: '2px 8px', 
                        borderRadius: '6px', 
                        textTransform: 'uppercase',
                        background: m.datosTecnicos?.agente === 'CO2' ? '#334155' : m.datosTecnicos?.agente === 'Agua' ? '#bfdbfe' : '#fef08a',
                        color: m.datosTecnicos?.agente === 'CO2' ? '#fff' : m.datosTecnicos?.agente === 'Agua' ? '#1e40af' : '#854d0e'
                      }}>
                        {m.datosTecnicos?.agente}
                      </span>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Últ: {m.historial?.ultimaPH || "-"}</div>
                      <div style={{ 
                        fontWeight: 800, 
                        color: isUrgent ? '#ef4444' : '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        Próx: {m.historial?.proximaPH || "-"}
                        {isUrgent && <span style={{ fontSize: '10px', background: '#ef4444', color: '#fff', padding: '1px 4px', borderRadius: '4px' }}>VENCIDO</span>}
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ 
                        padding: '6px 10px', 
                        borderRadius: '8px', 
                        background: '#f1f5f9', 
                        display: 'inline-block',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}>
                        {m.historial?.vencimientoCarga || "-"}
                      </div>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {isStaff && (
                          <button 
                            title="Editar" 
                            onClick={() => setEditInventory(m)} 
                            style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
                            <Edit size={18} strokeWidth={2.5} />
                          </button>
                        )}
                        {isAdmin && (
                          <button 
                            title="Eliminar" 
                            onClick={() => setDeleteConfirm({ id: m.id, type: "inventario" })} 
                            style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", background: "#fef2f2", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Trash2 size={18} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {matafuegos.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '60px', color: '#999', fontSize: '1rem' }}>No hay extintores registrados en el inventario.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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

      {/* EDIT MODAL */}
      {editInventory && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "30px", maxWidth: "650px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>Editar Extintor {editInventory.nroTarjeta}</h2>
              <button onClick={() => setEditInventory(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#999" }}>&times;</button>
            </div>

            <form onSubmit={handleSaveInventory}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "#999", marginBottom: "5px", textTransform: "uppercase" }}>Cliente</label>
                  <input 
                    type="text" 
                    value={editInventory.clienteNombre || ""} 
                    onChange={e => setEditInventory({ ...editInventory, clienteNombre: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "#999", marginBottom: "5px", textTransform: "uppercase" }}>Empresa</label>
                  <input 
                    type="text" 
                    value={editInventory.clienteEmpresa || ""} 
                    onChange={e => setEditInventory({ ...editInventory, clienteEmpresa: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "#999", marginBottom: "5px", textTransform: "uppercase" }}>Ubicación / Sede</label>
                  <input 
                    type="text" 
                    value={editInventory.sedeNombre || ""} 
                    onChange={e => setEditInventory({ ...editInventory, sedeNombre: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "#999", marginBottom: "5px", textTransform: "uppercase" }}>Marca</label>
                  <input 
                    type="text" 
                    value={editInventory.datosTecnicos?.marca || ""} 
                    onChange={e => setEditInventory({ ...editInventory, datosTecnicos: { ...editInventory.datosTecnicos, marca: e.target.value } })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "#999", marginBottom: "5px", textTransform: "uppercase" }}>Agente</label>
                  <select 
                    value={editInventory.datosTecnicos?.agente || ""} 
                    onChange={e => setEditInventory({ ...editInventory, datosTecnicos: { ...editInventory.datosTecnicos, agente: e.target.value } })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                  >
                    <option value="ABC">Polvo ABC</option>
                    <option value="CO2">CO2</option>
                    <option value="Agua">Agua</option>
                    <option value="K">Clase K</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "#999", marginBottom: "5px", textTransform: "uppercase" }}>Capacidad</label>
                  <input 
                    type="text" 
                    value={editInventory.datosTecnicos?.capacidad || ""} 
                    onChange={e => setEditInventory({ ...editInventory, datosTecnicos: { ...editInventory.datosTecnicos, capacidad: e.target.value } })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                  />
                </div>
              </div>

              <h4 style={{ borderTop: "1px solid #eee", paddingTop: "15px", marginBottom: "15px", fontSize: "0.85rem", fontWeight: 900, color: "#666" }}>HISTORIAL Y VENCIMIENTOS</h4>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "25px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 800, color: "#999", marginBottom: "5px" }}>VENC. CARGA</label>
                  <input 
                    type="month" 
                    value={editInventory.historial?.vencimientoCarga || ""} 
                    onChange={e => setEditInventory({ ...editInventory, historial: { ...editInventory.historial, vencimientoCarga: e.target.value } })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 800, color: "#999", marginBottom: "5px" }}>ÚLT. PH</label>
                  <input 
                    type="date" 
                    value={editInventory.historial?.ultimaPH || ""} 
                    onChange={e => setEditInventory({ ...editInventory, historial: { ...editInventory.historial, ultimaPH: e.target.value } })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.65rem", fontWeight: 800, color: "#999", marginBottom: "5px" }}>PRÓX. PH</label>
                  <input 
                    type="date" 
                    value={editInventory.historial?.proximaPH || ""} 
                    onChange={e => setEditInventory({ ...editInventory, historial: { ...editInventory.historial, proximaPH: e.target.value } })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" onClick={() => setEditInventory(null)} style={{ flex: 1, padding: "14px", borderRadius: "10px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 700 }}>Cancelar</button>
                <button type="submit" disabled={savingInventory} className="btn-red" style={{ flex: 1, padding: "14px", borderRadius: "10px", fontWeight: 800 }}>
                  {savingInventory ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatafuegosUnifiedPage() {
  return (
    <Suspense fallback={<div style={{ padding: '100px', textAlign: 'center' }}>Cargando panel de matafuegos...</div>}>
      <MatafuegosUnifiedContent />
    </Suspense>
  );
}
