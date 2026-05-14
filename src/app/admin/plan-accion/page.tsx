"use client";
import { useEffect, useState, useRef } from "react";
import { useToast, Toast } from "@/components/Toast";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, query, orderBy, serverTimestamp, getDoc, where 
} from "firebase/firestore";
import { useRouter } from "next/navigation";

import { 
  Package, 
  Settings, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Scroll,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";

import { PieChart, Pie, Cell, Tooltip } from "recharts";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Prioridad = "Leve" | "Moderada" | "Crítica";
const PRIORIDADES: Prioridad[] = ["Leve", "Moderada", "Crítica"];

interface PlanItem {
  id: string;
  cliente: string;
  clienteId?: string;
  consorcio: string;
  sedeId?: string;
  sedeNombre?: string;
  fecha: string;
  detalle: string;
  prioridad: Prioridad;
  costo: number;
  realizado: boolean;
  fechaRealizacion?: string;
  createdAt?: any;
}

const PRIORIDAD_COLORS: Record<Prioridad, { bg: string; color: string; border: string }> = {
  "Leve":     { bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd" },
  "Moderada": { bg: "#fffbeb", color: "#92400e", border: "#fef3c7" },
  "Crítica":  { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
};

export default function PlanAccionPage() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [modal, setModal] = useState<"create" | "edit" | "view" | null>(null);
  const [selectedItem, setSelectedItem] = useState<PlanItem | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast, showToast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const router = useRouter();

  // Filtros
  const [search, setSearch] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState<Prioridad | "Todas">("Todas");
  const [filtroRealizado, setFiltroRealizado] = useState<"Todos" | "Si" | "No">("Todos");
  const [filtroSede, setFiltroSede] = useState("Todas");

  // Form State
  const [fCliente, setFCliente] = useState("");
  const [fClienteId, setFClienteId] = useState("");
  const [fConsorcio, setFConsorcio] = useState("");
  const [fSedeId, setFSedeId] = useState("");
  const [fSedeNombre, setFSedeNombre] = useState("");
  const [filteredSedes, setFilteredSedes] = useState<any[]>([]);
  const [fFecha, setFFecha] = useState(new Date().toISOString().split("T")[0]);
  const [fDetalle, setFDetalle] = useState("");
  const [fPrioridad, setFPrioridad] = useState<Prioridad>("Leve");
  const [fCosto, setFCosto] = useState<string>("");
  const [fRealizado, setFRealizado] = useState(false);
  const [fFechaRealizacion, setFFechaRealizacion] = useState("");

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({ 
    nombre: "", 
    apellido: "",
    email: "", 
    empresa: "", 
    dniCuit: "", 
    telefono: "", 
    direccion: "",
    sedes: [] as { id: string, nombre: string, direccion: string }[]
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "usuarios", u.uid));
      const userData = snap.exists() ? snap.data() : {};
      const r = userData.rol || "cliente";
      setRole(r);
      setUid(u.uid);
      setCurrentUser({ uid: u.uid, ...userData });
      fetchItems(r, userData, u.uid);
      if (r !== "cliente") fetchUsuarios();
    });
    return () => unsub();
  }, [router]);

  const fetchItems = async (r?: string, userData?: any, uid: string = "") => {
    setLoading(true);
    try {
      const isStaff = ["admin", "superadmin", "secretaria"].includes(r || "");
      const q = isStaff 
        ? query(collection(db, "plan_accion"), orderBy("createdAt", "desc"))
        : query(collection(db, "plan_accion"), where("clienteId", "==", uid), orderBy("createdAt", "desc"));
      
      let snap;
      try {
        snap = await getDocs(q);
      } catch (e) {
        const qFallback = isStaff
          ? query(collection(db, "plan_accion"))
          : query(collection(db, "plan_accion"), where("clienteId", "==", uid));
        snap = await getDocs(qFallback);
      }
      let all = snap.docs.map(d => ({ id: d.id, ...d.data() } as PlanItem));
      if (r === "cliente" && userData) {
        const uid = userData.uid;
        const emp = userData.empresa?.toLowerCase() || "";
        const nom = userData.nombre?.toLowerCase() || "";
        if (!uid && !emp && !nom) {
          all = [];
        } else {
          all = all.filter(i => {
            if (i.clienteId === uid) return true;
            if (emp && i.cliente?.toLowerCase().includes(emp)) return true;
            if (nom && i.cliente?.toLowerCase().includes(nom)) return true;
            return false;
          });
        }
      }
      setItems(all);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchUsuarios = async () => {
    try {
      const snap = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente")));
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))); 
    } catch (e) { console.error("Error fetching users:", e); }
  };

  const handleSelectCliente = (u: any) => {
    const display = u.empresa ? `${u.empresa} - ${u.nombre} ${u.apellido}` : `${u.nombre} ${u.apellido}`;
    setFCliente(display); 
    setFClienteId(u.id);
    setFilteredSedes(u.sedes || []);
    setShowSuggestions(false); 
  };

  const handleCreateNewClient = async () => {
    if (!newClientData.nombre || !newClientData.email) { showToast("Nombre y Email son obligatorios.", "error"); return; }
    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, "usuarios"), {
        ...newClientData,
        rol: "cliente",
        createdAt: serverTimestamp()
      });
      const newC = { id: docRef.id, ...newClientData, rol: "cliente" };
      setUsuarios([...usuarios, newC]);
      handleSelectCliente(newC);
      setShowNewClientModal(false);
      setNewClientData({ nombre: "", apellido: "", email: "", empresa: "", dniCuit: "", telefono: "", direccion: "", sedes: [] });
    } catch (e) {
      showToast("Error al crear cliente. Intentá de nuevo.", "error");
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setFCliente(""); setFClienteId(""); setFConsorcio(""); setFDetalle(""); 
    setFPrioridad("Leve"); setFCosto(""); setFRealizado(false); setFFechaRealizacion("");
    setFSedeId(""); setFSedeNombre(""); setFilteredSedes([]);
    setFFecha(new Date().toISOString().split("T")[0]);
    setSelectedItem(null); setModal("create");
    setShowSuggestions(false);
  };

  const openEdit = (item: PlanItem) => {
    setFCliente(item.cliente); setFClienteId(item.clienteId || ""); 
    setFConsorcio(item.consorcio); setFFecha(item.fecha);
    setFDetalle(item.detalle); setFPrioridad(item.prioridad); setFCosto(String(item.costo || ""));
    setFRealizado(item.realizado || false); setFFechaRealizacion(item.fechaRealizacion || "");
    setFSedeId(item.sedeId || ""); setFSedeNombre(item.sedeNombre || "");
    
    if (item.clienteId) {
      const u = usuarios.find(x => x.id === item.clienteId);
      if (u) setFilteredSedes(u.sedes || []);
    }
    
    setSelectedItem(item); setModal("edit");
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    if (!fCliente || !fDetalle) { showToast("Cliente y Detalle son obligatorios.", "error"); return; }
    setSaving(true);
    try {
      const payload: any = {
        cliente: fCliente,
        clienteId: fClienteId || null,
        consorcio: fSedeId ? fSedeNombre : fConsorcio,
        sedeId: fSedeId || null,
        sedeNombre: fSedeNombre || "",
        fecha: fFecha,
        detalle: fDetalle,
        prioridad: fPrioridad,
        costo: fCosto ? Number(fCosto) : 0,
        realizado: fRealizado,
        fechaRealizacion: fRealizado ? (fFechaRealizacion || new Date().toISOString().split("T")[0]) : "",
        updatedAt: serverTimestamp(),
      };

      if (modal === "create") {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "plan_accion"), payload);
      } else if (modal === "edit" && selectedItem) {
        await updateDoc(doc(db, "plan_accion", selectedItem.id), payload);
      }
      setModal(null);
      fetchItems(role as string, currentUser, uid || "");
      showToast("Elemento guardado correctamente", "success");
    } catch (e) { showToast("Error al guardar. Intentá de nuevo.", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "plan_accion", id));
      setDeleteConfirm(null);
      fetchItems(role as string, currentUser, uid || "");
    } catch { showToast("Error al eliminar. Intentá de nuevo.", "error"); }
  };

  const filtered = items.filter(i => {
    const matchesSearch = i.cliente.toLowerCase().includes(search.toLowerCase()) || 
                          i.consorcio.toLowerCase().includes(search.toLowerCase()) || 
                          (i.sedeNombre || "").toLowerCase().includes(search.toLowerCase()) ||
                          i.detalle.toLowerCase().includes(search.toLowerCase());
    const matchesPrioridad = filtroPrioridad === "Todas" || i.prioridad === filtroPrioridad;
    const matchesRealizado = filtroRealizado === "Todos" || (filtroRealizado === "Si" ? i.realizado : !i.realizado);
    const matchesSede = filtroSede === "Todas" || i.sedeNombre === filtroSede;
    return matchesSearch && matchesPrioridad && matchesRealizado && matchesSede;
  });

  const isReadOnly = role === "cliente";
  const isAdmin = role === "admin" || role === "superadmin";

  const totalRealizados = items.filter(i => i.realizado).length;
  const totalPendientes = items.filter(i => !i.realizado).length;
  const chartData = [
    { name: "Realizados", value: totalRealizados, color: "#16a34a" },
    { name: "Pendientes", value: totalPendientes, color: "#f59e0b" },
  ];
  const pctEjecucion = items.length > 0 ? Math.round((totalRealizados / items.length) * 100) : 0;

  return (
    <div style={{ maxWidth: "1350px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px", flexWrap: "wrap", gap: "20px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>
            {isReadOnly ? "Mi Plan de Acción" : "Plan de Acción"}
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>
            {isReadOnly ? "Propuestas de mejora asignadas a tus instalaciones." : "Propuestas de mejora, mantenimiento y seguimiento de prioridades."}
          </p>
        </div>
        {!isReadOnly && (
          <button onClick={openCreate} className="btn-red" style={{ padding: "12px 24px", display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} strokeWidth={3} /> Nueva Propuesta
          </button>
        )}
      </header>

      {/* FILTROS */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "24px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
        <div style={{ flex: 1, minWidth: "250px" }}>
          <label style={labelSt}>Buscar</label>
          <input style={inputSt} placeholder={isReadOnly ? "Consorcio o detalle..." : "Cliente, consorcio o detalle..."} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ width: "150px" }}>
          <label style={labelSt}>Prioridad</label>
          <select style={inputSt} value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value as any)}>
            <option value="Todas">Todas</option>
            {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ width: "150px" }}>
          <label style={labelSt}>Estado</label>
          <select style={inputSt} value={filtroRealizado} onChange={e => setFiltroRealizado(e.target.value as any)}>
            <option value="Todos">Todos</option>
            <option value="Si">Realizados</option>
            <option value="No">Pendientes</option>
          </select>
        </div>
        <div style={{ width: "180px" }}>
          <label style={labelSt}>Sede / Obra</label>
          <select style={inputSt} value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
            <option value="Todas">Todas las sedes</option>
            {isReadOnly && currentUser?.sedes ? (
              currentUser.sedes.map((s: any) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)
            ) : (
              (Array.from(new Set(items.map(i => i.sedeNombre).filter(Boolean))) as string[]).map(s => <option key={s} value={s}>{s}</option>)
            )}
          </select>
        </div>
        <button 
          onClick={() => { setSearch(""); setFiltroPrioridad("Todas"); setFiltroRealizado("Todos"); setFiltroSede("Todas"); }}
          style={{ padding: "10px 15px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#666" }}
        >
          Limpiar
        </button>
      </div>

      {/* GRÁFICO DE ESTADOS */}
      {!loading && items.length > 0 && (
        <div style={{ background: "#fff", padding: "24px 28px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "24px", border: "1px solid #eee", display: "flex", alignItems: "center", gap: "28px", flexWrap: "wrap" }}>
          <PieChart width={150} height={150}>
            <Pie
              data={chartData}
              cx={70}
              cy={70}
              innerRadius={45}
              outerRadius={65}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(val) => [`${val} ítems`]}
              contentStyle={{ borderRadius: "8px", fontSize: "0.82rem", border: "1px solid #eee" }}
            />
          </PieChart>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {chartData.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: d.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 900, fontSize: "1.5rem", color: "#1e293b", lineHeight: 1 }}>{d.value}</div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{d.name}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Tasa de ejecución</div>
            <div style={{ fontSize: "2.4rem", fontWeight: 900, color: "var(--primary-blue)", lineHeight: 1 }}>{pctEjecucion}%</div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>{items.length} propuestas en total</div>
          </div>
        </div>
      )}

      {/* LISTADO */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden", border: "1px solid #eee", marginBottom: "20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando propuestas...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#999" }}>No se encontraron registros en el Plan de Acción.</div>
        ) : (
          <>
            <div className="hide-on-mobile" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                <thead>
                  <tr style={{ background: "#fafafa", borderBottom: "2px solid #eee" }}>
                    {["Fecha", "Cliente / Sede", "Detalle / Observación", "Prioridad", "Costo", "Estado", "Acciones"].map(h => (
                      <th key={h as string} style={{ textAlign: "left", padding: "14px 18px", fontSize: "0.72rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const pc = PRIORIDAD_COLORS[item.prioridad];
                    return (
                      <tr key={item.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                        <td style={{ padding: "14px 18px", fontSize: "0.85rem", whiteSpace: "nowrap" }}>{new Date(item.fecha + "T12:00:00").toLocaleDateString("es-AR")}</td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.9rem" }}>{item.cliente}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--primary-blue)", fontWeight: 600 }}>📍 {item.sedeNombre || item.consorcio || "Sin sede/consorcio"}</div>
                        </td>
                        <td style={{ padding: "14px 18px", fontSize: "0.85rem", color: "#555", maxWidth: "300px" }}>{item.detalle}</td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{ fontSize: "0.7rem", fontWeight: 800, padding: "4px 10px", borderRadius: "20px", background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>{item.prioridad}</span>
                        </td>
                        <td style={{ padding: "14px 18px", fontWeight: 700, color: "#2e7d32" }}>
                          {item.costo ? `$${Number(item.costo).toLocaleString("es-AR")}` : <span style={{ color: "#ccc" }}>—</span>}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          {item.realizado ? (
                            <div style={{ color: "#16a34a", fontSize: "0.75rem", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <CheckCircle2 size={14} /> 
                              <div>
                                Realizado
                                {item.fechaRealizacion && <div style={{fontWeight:400, fontSize: '0.65rem'}}>{new Date(item.fechaRealizacion + "T12:00:00").toLocaleDateString("es-AR")}</div>}
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: "#f59e0b", fontSize: "0.75rem", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={14} /> Pendiente
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setSelectedItem(item); setModal("view"); }} 
                              style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", border: 'none', cursor: 'pointer' }} title="Ver Detalle">
                              <Eye size={18} strokeWidth={2.5} />
                            </button>
                            
                            {!isReadOnly && (
                              <button onClick={() => openEdit(item)} 
                                style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", border: 'none', cursor: 'pointer' }} title="Editar">
                                <Edit size={18} strokeWidth={2.5} />
                              </button>
                            )}

                            {isAdmin && !isReadOnly && (
                              <button onClick={() => setDeleteConfirm(item.id)} 
                                style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fef2f2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", border: 'none', cursor: 'pointer' }} title="Eliminar">
                                <Trash2 size={18} strokeWidth={2.5} />
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

            {/* Mobile Cards */}
            <div className="show-on-mobile" style={{ display: "none", flexDirection: "column", gap: "12px", padding: "12px" }}>
              {filtered.map(item => {
                const pc = PRIORIDAD_COLORS[item.prioridad];
                return (
                  <div key={item.id} style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1.5px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                      <div>
                        <div style={{ fontSize: "0.7rem", color: "#999", fontWeight: 600 }}>{new Date(item.fecha + "T12:00:00").toLocaleDateString("es-AR")}</div>
                        <div style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "0.95rem" }}>{item.cliente}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--primary-blue)", fontWeight: 600 }}>📍 {item.sedeNombre || item.consorcio}</div>
                      </div>
                      <span style={{ fontSize: "0.65rem", fontWeight: 900, padding: "4px 10px", borderRadius: "20px", background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, textTransform: "uppercase" }}>{item.prioridad}</span>
                    </div>
                    
                    <p style={{ fontSize: "0.85rem", color: "#555", margin: "10px 0", lineHeight: "1.4" }}>{item.detalle}</p>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", borderTop: "1px solid #f0f0f0", paddingTop: "12px" }}>
                      <div>
                        <div style={{ fontSize: "0.6rem", color: "#999", textTransform: "uppercase", fontWeight: 700 }}>Costo</div>
                        <div style={{ fontWeight: 800, color: "#2e7d32" }}>{item.costo ? `$${Number(item.costo).toLocaleString("es-AR")}` : "—"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {item.realizado ? (
                          <span style={{ color: "#16a34a", fontSize: "0.75rem", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> Realizado
                          </span>
                        ) : (
                          <span style={{ color: "#f59e0b", fontSize: "0.75rem", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> Pendiente
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "flex-end" }}>
                      <button onClick={() => { setSelectedItem(item); setModal("view"); }} 
                        style={{ background: "#f0fdf4", border: "none", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", color: "#16a34a", display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Eye size={16} /> Ver
                      </button>
                      {!isReadOnly && (
                        <button onClick={() => openEdit(item)} 
                          style={{ background: "#f0f7ff", border: "none", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", color: "#0061ff", display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Edit size={16} /> Editar
                        </button>
                      )}
                      {isAdmin && !isReadOnly && (
                        <button onClick={() => setDeleteConfirm(item.id)} 
                          style={{ background: "#fff1f0", border: "none", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", color: "#ef4444" }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* MODAL VIEW/CREATE/EDIT */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: "600px", padding: "30px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary-blue)", margin: 0 }}>
                {modal === "view" ? "Detalle de Propuesta" : modal === "create" ? "Nueva Propuesta de Acción" : "Editar Propuesta"}
              </h2>
              <button 
                onClick={() => setModal(null)} 
                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: '0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >✕</button>
            </div>
            
            {modal === "view" && selectedItem ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={labelSt}>Cliente</label>
                    <div style={{ fontWeight: 700, color: 'var(--primary-blue)' }}>{selectedItem.cliente}</div>
                  </div>
                  <div>
                    <label style={labelSt}>Sede / Consorcio</label>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <MapPin size={14} /> {selectedItem.sedeNombre || selectedItem.consorcio}
                    </div>
                  </div>
                  <div>
                    <label style={labelSt}>Fecha Propuesta</label>
                    <div>{new Date(selectedItem.fecha + "T12:00:00").toLocaleDateString("es-AR")}</div>
                  </div>
                  <div>
                    <label style={labelSt}>Prioridad</label>
                    <span style={{ fontSize: "0.7rem", fontWeight: 800, padding: "4px 10px", borderRadius: "20px", background: PRIORIDAD_COLORS[selectedItem.prioridad].bg, color: PRIORIDAD_COLORS[selectedItem.prioridad].color, border: `1px solid ${PRIORIDAD_COLORS[selectedItem.prioridad].border}` }}>
                      {selectedItem.prioridad}
                    </span>
                  </div>
                </div>

                <div>
                  <label style={labelSt}>Detalle de la Mejora</label>
                  <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '10px', fontSize: '0.95rem', color: '#334155', lineHeight: '1.6', border: '1px solid #e2e8f0' }}>
                    {selectedItem.detalle}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'center' }}>
                  <div>
                    <label style={labelSt}>Costo Estimado</label>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2e7d32' }}>
                      {selectedItem.costo ? `$${Number(selectedItem.costo).toLocaleString("es-AR")}` : "—"}
                    </div>
                  </div>
                  <div>
                    <label style={labelSt}>Estado</label>
                    {selectedItem.realizado ? (
                      <div style={{ color: "#16a34a", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={18} /> Realizado
                        {selectedItem.fechaRealizacion && <span style={{fontWeight:400, fontSize: '0.8rem', color: '#666'}}>({new Date(selectedItem.fechaRealizacion + "T12:00:00").toLocaleDateString("es-AR")})</span>}
                      </div>
                    ) : (
                      <div style={{ color: "#f59e0b", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={18} /> Pendiente de ejecución
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <button onClick={() => setModal(null)} className="btn-blue" style={{ width: '100%', padding: '12px' }}>Cerrar Vista</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <div style={{ gridColumn: "span 2", position: "relative" }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <label style={labelSt}>Cliente *</label>
                      <button type="button" onClick={() => setShowNewClientModal(true)} style={{ background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                        <Plus size={14} /> NUEVO CLIENTE
                      </button>
                    </div>
                    
                    <input 
                      style={inputSt} 
                      value={fCliente} 
                      onChange={e => { setFCliente(e.target.value); setShowSuggestions(true); setFClienteId(""); setFSedeId(""); setFSedeNombre(""); setFilteredSedes([]); }} 
                      onFocus={() => { fetchUsuarios(); setShowSuggestions(true); }}
                      placeholder="Buscar cliente registrado..." 
                    />
                    {showSuggestions && fCliente.length >= 2 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", zIndex: 9999, maxHeight: "220px", overflowY: "auto", marginTop: "5px" }}>
                        {usuarios
                          .filter(u => {
                            const searchStr = `${u.nombre} ${u.apellido} ${u.empresa || ""} ${u.email || ""}`.toLowerCase();
                            return searchStr.includes(fCliente.toLowerCase());
                          })
                          .map(u => (
                            <div key={u.id} onClick={() => handleSelectCliente(u)}
                              style={{ padding: "10px 15px", cursor: "pointer", borderBottom: "1px solid #eee", fontSize: "0.85rem" }}
                              onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                              onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                              <div style={{ fontWeight: 700, color: "var(--primary-blue)" }}>{u.empresa ? `${u.empresa} - ${u.nombre} ${u.apellido}` : `${u.nombre} ${u.apellido}`}</div>
                              <div style={{ fontSize: "0.7rem", color: "#888" }}>{u.email}</div>
                            </div>
                          ))}
                        {usuarios.length > 0 && usuarios.filter(u => `${u.nombre} ${u.apellido} ${u.empresa || ""}`.toLowerCase().includes(fCliente.toLowerCase())).length === 0 && fCliente && (
                          <div style={{ padding: "12px 15px", color: "#666", fontSize: "0.8rem", background: "#f8f9fa", fontStyle: 'italic' }}>
                            No se encontraron clientes registrados con ese nombre.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {fClienteId && (
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={labelSt}>Sede / Obra / Consorcio</label>
                      <select 
                        style={inputSt} 
                        value={fSedeId} 
                        onChange={e => {
                          const s = filteredSedes.find(x => x.id === e.target.value);
                          if (s) {
                            setFSedeId(s.id);
                            setFSedeNombre(s.nombre);
                            setFConsorcio(s.nombre);
                          } else {
                            setFSedeId("");
                            setFSedeNombre("");
                            setFConsorcio("");
                          }
                        }}
                      >
                        <option value="">{filteredSedes.length === 0 ? "Sin sedes registradas" : "Seleccionar sede (Opcional)"}</option>
                        {filteredSedes.map(s => (
                          <option key={s.id} value={s.id}>{s.nombre} ({s.direccion})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!fClienteId && (
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={labelSt}>Consorcio / Edificio (Manual)</label>
                      <input style={inputSt} value={fConsorcio} onChange={e => setFConsorcio(e.target.value)} placeholder="Ej: Torre Alem" />
                    </div>
                  )}

                  <div>
                    <label style={labelSt}>Fecha Propuesta</label>
                    <input type="date" style={inputSt} value={fFecha} onChange={e => setFFecha(e.target.value)} />
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={labelSt}>Detalle de la Mejora / Observación *</label>
                    <textarea style={{ ...inputSt, height: "80px", resize: "none" }} value={fDetalle} onChange={e => setFDetalle(e.target.value)} placeholder="Describí lo que hay que hacer..." />
                  </div>
                  <div>
                    <label style={labelSt}>Prioridad</label>
                    <select style={inputSt} value={fPrioridad} onChange={e => setFPrioridad(e.target.value as any)}>
                      {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelSt}>Costo Estimado ($)</label>
                    <input type="number" style={inputSt} value={fCosto} onChange={e => setFCosto(e.target.value)} placeholder="0" />
                  </div>
                </div>

                <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "10px", marginBottom: "25px", border: "1.5px solid #eee" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: fRealizado ? "10px" : "0" }}>
                    <input type="checkbox" id="check-realizado" checked={fRealizado} onChange={e => setFRealizado(e.target.checked)} style={{ width: "20px", height: "20px", cursor: "pointer" }} />
                    <label htmlFor="check-realizado" style={{ fontWeight: 700, cursor: "pointer", color: "var(--primary-blue)" }}>Marcar como REALIZADO</label>
                  </div>
                  {fRealizado && (
                    <div>
                      <label style={{ ...labelSt, marginTop: "10px" }}>Fecha de Realización</label>
                      <input type="date" style={inputSt} value={fFechaRealizacion} onChange={e => setFFechaRealizacion(e.target.value)} />
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setModal(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "none", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                  <button onClick={handleSave} disabled={saving} className="btn-red" style={{ flex: 1.5, padding: "12px" }}>{saving ? "Guardando..." : "Guardar Propuesta"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "380px", width: "100%", textAlign: "center" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "10px" }}>¿Eliminar registro?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Nuevo Cliente Modal */}
      {showNewClientModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "35px", maxWidth: "600px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                <Plus size={24} strokeWidth={3} /> Registrar Nuevo Cliente
              </h2>
              <button 
                onClick={() => setShowNewClientModal(false)} 
                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: '0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >✕</button>
            </div>
            
            <div style={{ display: "grid", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label style={labelSt}>Nombre *</label>
                  <input type="text" value={newClientData.nombre} onChange={e => setNewClientData({...newClientData, nombre: e.target.value})} style={inputSt} placeholder="Nombre" />
                </div>
                <div>
                  <label style={labelSt}>Apellido</label>
                  <input type="text" value={newClientData.apellido} onChange={e => setNewClientData({...newClientData, apellido: e.target.value})} style={inputSt} placeholder="Apellido" />
                </div>
              </div>

              <div>
                <label style={labelSt}>Email *</label>
                <input type="email" value={newClientData.email} onChange={e => setNewClientData({...newClientData, email: e.target.value})} style={inputSt} placeholder="correo@ejemplo.com" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label style={labelSt}>Empresa / R. Social</label>
                  <input type="text" value={newClientData.empresa} onChange={e => setNewClientData({...newClientData, empresa: e.target.value})} style={inputSt} placeholder="Empresa" />
                </div>
                <div>
                  <label style={labelSt}>DNI / CUIT</label>
                  <input type="text" value={newClientData.dniCuit} onChange={e => setNewClientData({...newClientData, dniCuit: e.target.value})} style={inputSt} placeholder="DNI o CUIT" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label style={labelSt}>Teléfono</label>
                  <input type="text" value={newClientData.telefono} onChange={e => setNewClientData({...newClientData, telefono: e.target.value})} style={inputSt} placeholder="Teléfono" />
                </div>
                <div>
                  <label style={labelSt}>Dirección</label>
                  <input type="text" value={newClientData.direccion} onChange={e => setNewClientData({...newClientData, direccion: e.target.value})} style={inputSt} placeholder="Calle, Altura, Localidad" />
                </div>
              </div>

              {/* SEDES */}
              <div style={{ borderTop: "1px solid #eee", paddingTop: "20px" }}>
                <label style={{ ...labelSt, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  Sedes / Ubicaciones
                  <button type="button" onClick={() => {
                    const id = Math.random().toString(36).substr(2, 9);
                    setNewClientData({ ...newClientData, sedes: [...newClientData.sedes, { id, nombre: "", direccion: "" }] });
                  }} style={{ background: "var(--primary-blue)", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "0.7rem", cursor: "pointer" }}>
                    + AGREGAR SEDE
                  </button>
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                  {newClientData.sedes.map((s, idx) => (
                    <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "10px", alignItems: "center", background: "#f8f9fa", padding: "10px", borderRadius: "8px" }}>
                      <input style={{ ...inputSt, padding: "8px" }} placeholder="Nombre sede..." value={s.nombre} onChange={e => {
                        const newS = [...newClientData.sedes];
                        newS[idx].nombre = e.target.value;
                        setNewClientData({ ...newClientData, sedes: newS });
                      }} />
                      <input style={{ ...inputSt, padding: "8px" }} placeholder="Dirección..." value={s.direccion} onChange={e => {
                        const newS = [...newClientData.sedes];
                        newS[idx].direccion = e.target.value;
                        setNewClientData({ ...newClientData, sedes: newS });
                      }} />
                      <button onClick={() => {
                        setNewClientData({ ...newClientData, sedes: newClientData.sedes.filter((_, i) => i !== idx) });
                      }} style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "4px", padding: "8px", cursor: "pointer" }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "15px", marginTop: "10px" }}>
                <button onClick={() => setShowNewClientModal(false)} style={{ flex: 1, padding: "15px", borderRadius: "12px", border: "1px solid #ddd", background: "#f8f9fa", fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleCreateNewClient} className="btn-red" style={{ flex: 2, padding: "15px", borderRadius: "12px", fontWeight: 800 }}>REGISTRAR CLIENTE</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STYLES */}
      <style jsx>{`
        @media (max-width: 768px) {
          .hide-on-mobile { display: none !important; }
          .show-on-mobile { display: flex !important; }
        }
      `}</style>
      <Toast {...toast} />
    </div>
  );
}

const labelSt = { display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "5px", textTransform: "uppercase" as any };
const inputSt = { width: "100%", padding: "11px", borderRadius: "8px", border: "1.5px solid #eee", fontSize: "0.9rem", outline: "none" };
