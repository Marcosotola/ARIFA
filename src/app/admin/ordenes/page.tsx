"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, addDoc, getDocs, orderBy, updateDoc, doc, serverTimestamp, where, getDoc } from "firebase/firestore";
import { ClipboardList, Folder, Plus, Search, MapPin, Calendar, User, Layout, ArrowLeft } from "lucide-react";

export default function OrdenesAdmin() {
  const [activeTab, setActiveTab] = useState("listado");
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [filtroSede, setFiltroSede] = useState("Todas");
  const [search, setSearch] = useState("");
  const [newOrder, setNewOrder] = useState<any>({ 
    cliente: "", 
    clienteId: "",
    sedeId: "",
    sedeNombre: "",
    direccion: "", 
    tipo: "Mantenimiento Matafuegos", 
    estado: "Pendiente", 
    tecnico: "" 
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSedes, setFilteredSedes] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDoc = await getDoc(doc(db, "usuarios", u.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        const roleData = userData.rol || "cliente";
        setRole(roleData);
        fetchOrdenes(u.uid, roleData);
        if (roleData === 'admin' || roleData === 'superadmin') {
          fetchUsuarios();
        }
      }
    });
    return () => unsub();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const q = query(collection(db, "usuarios"), where("rol", "==", "cliente"));
      const snap = await getDocs(q);
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error fetching users:", e);
    }
  };

  const fetchOrdenes = async (uid: string, role: string) => {
    setLoading(true);
    try {
      let q;
      if (role === 'admin' || role === 'superadmin') {
        q = query(collection(db, "ordenes_trabajo"), orderBy("fechaCreacion", "desc"));
      } else {
        q = query(collection(db, "ordenes_trabajo"), where("userId", "==", uid), orderBy("fechaCreacion", "desc"));
      }
      
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrdenes(docs);
    } catch (e) {
      console.error("Error fetching ordenes:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCliente = (u: any) => {
    setNewOrder({
      ...newOrder,
      cliente: u.empresa || `${u.nombre} ${u.apellido}`,
      clienteId: u.id,
      direccion: u.direccion || "",
      sedeId: "",
      sedeNombre: ""
    });
    setFilteredSedes(u.sedes || []);
    setShowSuggestions(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'admin' && role !== 'superadmin') return;
    try {
      const num = ordenes.length ? Math.max(...ordenes.map(o => o.numero || 0)) + 1 : 1;
      await addDoc(collection(db, "ordenes_trabajo"), {
        ...newOrder,
        numero: num,
        userId: newOrder.clienteId || null,
        fechaCreacion: serverTimestamp(),
      });
      fetchOrdenes(user.uid, role!);
      setShowForm(false);
      setNewOrder({ cliente: "", clienteId: "", sedeId: "", sedeNombre: "", direccion: "", tipo: "Mantenimiento Matafuegos", estado: "Pendiente", tecnico: "" });
      setFilteredSedes([]);
    } catch (e) {
      alert("Error al crear la orden: " + e);
    }
  };

  const updateEstado = async (id: string, nuevo: string) => {
    if (role !== 'admin' && role !== 'superadmin') return;
    await updateDoc(doc(db, "ordenes_trabajo", id), { estado: nuevo });
    fetchOrdenes(user.uid, role!);
  };

  const filteredOrdenes = ordenes.filter(o => {
    const matchesSearch = 
      o.cliente.toLowerCase().includes(search.toLowerCase()) || 
      String(o.numero || "").includes(search);
    const matchesSede = filtroSede === "Todas" || o.sedeNombre === filtroSede;
    return matchesSearch && matchesSede;
  });

  const sedesDisponibles = Array.from(new Set(ordenes.map(o => o.sedeNombre).filter(Boolean))) as string[];

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando panel...</div>;

  const isClient = role === "cliente";
  const isAdmin = role === "admin" || role === "superadmin";

  return (
    <div style={{ maxWidth: "1000px" }}>
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "var(--primary-blue)" }}>
            {isClient ? "Mis Órdenes de Trabajo" : "Gestión de Órdenes"}
          </h1>
          <p style={{ color: "var(--text-muted)" }}>Control y seguimiento de servicios en campo.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="btn-red" style={{ padding: "12px 24px" }}>
            {showForm ? "✕ Cancelar" : "➕ Nueva Orden"}
          </button>
        )}
      </header>

      {/* TABS (ESTILO UNIFICADO) */}
      <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '6px', borderRadius: '14px', marginBottom: '24px', width: 'fit-content' }}>
        <button 
          onClick={() => setActiveTab("listado")} 
          style={{ 
            padding: '10px 18px', borderRadius: '10px', border: '1.5px solid', 
            borderColor: activeTab === "listado" ? '#3b82f6' : '#bfdbfe',
            background: activeTab === "listado" ? '#fff' : '#eff6ff', 
            fontWeight: 800, 
            color: '#3b82f6', 
            cursor: 'pointer', 
            boxShadow: activeTab === "listado" ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none', 
            display: 'flex', alignItems: 'center', gap: '8px',
            transition: '0.3s'
          }}>
          <ClipboardList size={18} strokeWidth={2.5} /> Listado OT
        </button>
        <button 
          onClick={() => setActiveTab("gestor")} 
          style={{ 
            padding: '10px 18px', borderRadius: '10px', border: '1.5px solid', 
            borderColor: activeTab === "gestor" ? '#f59e0b' : '#fef3c7',
            background: activeTab === "gestor" ? '#fff' : '#fffbeb', 
            fontWeight: 800, 
            color: '#f59e0b', 
            cursor: 'pointer', 
            boxShadow: activeTab === "gestor" ? '0 4px 12px rgba(245, 158, 11, 0.15)' : 'none', 
            display: 'flex', alignItems: 'center', gap: '8px',
            transition: '0.3s'
          }}>
          <Folder size={18} strokeWidth={2.5} /> Gestor
        </button>
      </div>

      {showForm && isAdmin && (
        <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: "30px", border: "1px solid #eee" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "20px", color: "var(--primary-blue)" }}>Información de la Orden</h2>
          <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <div style={{ gridColumn: "span 2", position: "relative" }}>
              <label style={labelSt}>Cliente</label>
              <input 
                style={inputSt} 
                value={newOrder.cliente} 
                onChange={e => { 
                  setNewOrder({ ...newOrder, cliente: e.target.value, clienteId: "", sedeId: "", sedeNombre: "" }); 
                  setShowSuggestions(true); 
                }} 
                placeholder="Nombre del cliente o empresa..." 
              />
              {showSuggestions && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "8px", zIndex: 100, boxShadow: "0 10px 30px rgba(0,0,0,0.15)", maxHeight: "200px", overflowY: "auto" }}>
                  {usuarios.filter(u => `${u.nombre} ${u.apellido} ${u.empresa}`.toLowerCase().includes(newOrder.cliente.toLowerCase())).map(u => (
                    <div key={u.id} onClick={() => handleSelectCliente(u)} style={{ padding: "10px 15px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                         onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                         onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                      <div style={{ fontWeight: 700 }}>{u.empresa || `${u.nombre} ${u.apellido}`}</div>
                      <div style={{ fontSize: "0.75rem", color: "#666" }}>{u.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={labelSt}>Sede / Obra (Opcional)</label>
              <select 
                style={inputSt} 
                value={newOrder.sedeId} 
                onChange={e => {
                  const s = filteredSedes.find(x => x.id === e.target.value);
                  if (s) {
                    setNewOrder({ ...newOrder, sedeId: s.id, sedeNombre: s.nombre, direccion: s.direccion });
                  } else {
                    const cli = usuarios.find(x => x.id === newOrder.clienteId);
                    setNewOrder({ ...newOrder, sedeId: "", sedeNombre: "", direccion: cli?.direccion || "" });
                  }
                }}
              >
                <option value="">-- Sin sede --</option>
                {filteredSedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            <div>
              <label style={labelSt}>Dirección</label>
              <input style={inputSt} value={newOrder.direccion} onChange={e => setNewOrder({ ...newOrder, direccion: e.target.value })} />
            </div>

            <div>
              <label style={labelSt}>Tipo de Trabajo</label>
              <select style={inputSt} value={newOrder.tipo} onChange={e => setNewOrder({ ...newOrder, tipo: e.target.value })}>
                <option>Mantenimiento Matafuegos</option>
                <option>Certificación de Red de Incendio</option>
                <option>Capacitación HyS</option>
                <option>Auditoría Técnica</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>Técnico Asignado</label>
              <input style={inputSt} value={newOrder.tecnico} onChange={e => setNewOrder({ ...newOrder, tecnico: e.target.value })} placeholder="Nombre del técnico..." />
            </div>
            <button type="submit" className="btn-red" style={{ gridColumn: "span 2", padding: "14px", marginTop: "10px" }}>Generar Orden de Trabajo</button>
          </form>
        </div>
      )}

      {activeTab === "listado" && (
        <>
          {/* FILTROS */}
          <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
            <div style={{ flex: 1, minWidth: "220px" }}>
              <label style={labelSt}>Buscar</label>
              <input 
                type="text" 
                placeholder="N° orden o cliente..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                style={{ ...inputSt, background: "#fff" }}
              />
            </div>
            {sedesDisponibles.length > 0 && (
              <div style={{ width: "200px" }}>
                <label style={labelSt}>Sede / Obra</label>
                <select 
                  value={filtroSede} 
                  onChange={e => setFiltroSede(e.target.value)}
                  style={{ ...inputSt, background: "#fff" }}
                >
                  <option value="Todas">Todas las sedes</option>
                  {sedesDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <button onClick={() => { setSearch(""); setFiltroSede("Todas"); }} style={{ padding: "10px 15px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#666" }}>Limpiar</button>
          </div>

          <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 4px 25px rgba(0,0,0,0.05)", overflow: "hidden", border: "1px solid #eee" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #edf2f7" }}>
                  <th style={thSt}>N° / Fecha</th>
                  <th style={thSt}>Cliente / Sede</th>
                  <th style={thSt}>Servicio</th>
                  <th style={thSt}>Estado</th>
                  <th style={thSt}>Técnico</th>
                  {isAdmin && <th style={thSt}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filteredOrdenes.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "16px" }}>
                      <div style={{ fontWeight: 800, color: "var(--primary-blue)" }}>OT-{String(o.numero || 0).padStart(4, "0")}</div>
                      <div style={{ fontSize: "0.7rem", color: "#666" }}>{o.fechaCreacion?.seconds ? new Date(o.fechaCreacion.seconds * 1000).toLocaleDateString() : "Recién creada"}</div>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ fontWeight: 700 }}>{o.cliente}</div>
                      {o.sedeNombre && <div style={{ fontSize: "0.75rem", color: "var(--primary-blue)", fontWeight: 600 }}>📍 {o.sedeNombre}</div>}
                      <div style={{ fontSize: "0.75rem", color: "#888" }}>{o.direccion}</div>
                    </td>
                    <td style={{ padding: "16px", fontSize: "0.85rem" }}>{o.tipo}</td>
                    <td style={{ padding: "16px" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 900, padding: "5px 12px", borderRadius: "20px", textTransform: "uppercase",
                        background: o.estado === "Completada" ? "#dcfce7" : o.estado === "En Proceso" ? "#fef9c3" : "#fee2e2",
                        color: o.estado === "Completada" ? "#166534" : o.estado === "En Proceso" ? "#854d0e" : "#b91c1c" }}>
                        {o.estado}
                      </span>
                    </td>
                    <td style={{ padding: "16px", fontSize: "0.85rem", color: "#666" }}>{o.tecnico || "—"}</td>
                    {isAdmin && (
                      <td style={{ padding: "16px" }}>
                        <select value={o.estado} onChange={(e) => updateEstado(o.id, e.target.value)} style={{ padding: "6px", borderRadius: "6px", fontSize: "0.75rem", border: "1px solid #ddd" }}>
                          <option>Pendiente</option>
                          <option>En Proceso</option>
                          <option>Completada</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrdenes.length === 0 && <div style={{ padding: "60px", textAlign: "center", color: "#999" }}>No hay órdenes registradas.</div>}
          </div>
        </>
      )}

      {activeTab === "gestor" && (
        <div style={{ background: "#fff", padding: "60px", borderRadius: "16px", border: "1px solid #eee", textAlign: "center", color: "#666" }}>
          <Folder size={48} style={{ color: "#f59e0b", marginBottom: "20px", opacity: 0.5 }} />
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Gestor de Archivos OT</h2>
          <p>Próximamente: Historial completo y descarga de reportes consolidados.</p>
        </div>
      )}
    </div>
  );
}

const labelSt = { display: "block", fontSize: "0.7rem", fontWeight: 800, color: "#999", marginBottom: "5px", textTransform: "uppercase" as any };
const inputSt = { width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", fontSize: "0.9rem", outline: "none" };
const thSt = { textAlign: "left" as any, padding: "16px", fontSize: "0.7rem", color: "#999", textTransform: "uppercase" as any, fontWeight: 800, letterSpacing: "0.5px" };
