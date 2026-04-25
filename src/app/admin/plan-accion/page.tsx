"use client";
import { useEffect, useState, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, query, orderBy, serverTimestamp, getDoc, where 
} from "firebase/firestore";
import { useRouter } from "next/navigation";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Prioridad = "Leve" | "Moderada" | "Crítica";
const PRIORIDADES: Prioridad[] = ["Leve", "Moderada", "Crítica"];

interface PlanItem {
  id: string;
  cliente: string;
  consorcio: string;
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
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selectedItem, setSelectedItem] = useState<PlanItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const router = useRouter();

  // Filtros
  const [search, setSearch] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState<Prioridad | "Todas">("Todas");
  const [filtroRealizado, setFiltroRealizado] = useState<"Todos" | "Si" | "No">("Todos");

  // Form State
  const [fCliente, setFCliente] = useState("");
  const [fConsorcio, setFConsorcio] = useState("");
  const [fFecha, setFFecha] = useState(new Date().toISOString().split("T")[0]);
  const [fDetalle, setFDetalle] = useState("");
  const [fPrioridad, setFPrioridad] = useState<Prioridad>("Leve");
  const [fCosto, setFCosto] = useState<string>("");
  const [fRealizado, setFRealizado] = useState(false);
  const [fFechaRealizacion, setFFechaRealizacion] = useState("");

  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "usuarios", u.uid));
      const userData = snap.exists() ? snap.data() : {};
      const r = userData.rol || "cliente";
      setRole(r);
      setUid(u.uid);
      setCurrentUser({ uid: u.uid, ...userData });
      fetchItems(r, userData);
      if (r !== "cliente") fetchUsuarios();
    });
    return () => unsub();
  }, [router]);

  const fetchItems = async (r?: string, userData?: any) => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "plan_accion"), orderBy("createdAt", "desc")));
      let all = snap.docs.map(d => ({ id: d.id, ...d.data() } as PlanItem));
      // Filtro para cliente: solo sus items
      if (r === "cliente" && userData) {
        const clientName = userData.empresa 
          ? `${userData.empresa} - ${userData.nombre} ${userData.apellido}`
          : `${userData.nombre} ${userData.apellido}`;
        all = all.filter(i =>
          i.clienteId === userData.uid ||
          i.cliente?.toLowerCase().includes((userData.empresa || userData.nombre || "").toLowerCase())
        );
      }
      setItems(all);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchUsuarios = async () => {
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const filtered = all.filter(u => u.rol?.toLowerCase() === "cliente");
      setUsuarios(filtered); 
    } catch (e) { console.error("Error fetching users:", e); }
  };

  const openCreate = () => {
    setFCliente(""); setFConsorcio(""); setFDetalle(""); 
    setFPrioridad("Leve"); setFCosto(""); setFRealizado(false); setFFechaRealizacion("");
    setFFecha(new Date().toISOString().split("T")[0]);
    setSelectedItem(null); setModal("create");
    setShowSuggestions(false);
  };

  const openEdit = (item: PlanItem) => {
    setFCliente(item.cliente); setFConsorcio(item.consorcio); setFFecha(item.fecha);
    setFDetalle(item.detalle); setFPrioridad(item.prioridad); setFCosto(String(item.costo || ""));
    setFRealizado(item.realizado || false); setFFechaRealizacion(item.fechaRealizacion || "");
    setSelectedItem(item); setModal("edit");
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    if (!fCliente || !fDetalle) { alert("Cliente y Detalle son obligatorios."); return; }
    setSaving(true);
    try {
      const payload: any = {
        cliente: fCliente,
        consorcio: fConsorcio,
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
      fetchItems();
    } catch (e) { alert("Error al guardar."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "plan_accion", id));
      setDeleteConfirm(null);
      fetchItems();
    } catch { alert("Error al eliminar."); }
  };

  const filtered = items.filter(i => {
    const matchesSearch = i.cliente.toLowerCase().includes(search.toLowerCase()) || i.consorcio.toLowerCase().includes(search.toLowerCase()) || i.detalle.toLowerCase().includes(search.toLowerCase());
    const matchesPrioridad = filtroPrioridad === "Todas" || i.prioridad === filtroPrioridad;
    const matchesRealizado = filtroRealizado === "Todos" || (filtroRealizado === "Si" ? i.realizado : !i.realizado);
    return matchesSearch && matchesPrioridad && matchesRealizado;
  });

  const isReadOnly = role === "cliente";

  return (
    <div style={{ width: "100%", maxWidth: "1100px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px", flexWrap: "wrap", gap: "20px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>
            {isReadOnly ? "Mi Plan de Acción" : "Plan de Acción"}
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>
            {isReadOnly ? "Propuestas de mejora asignadas a tus instalaciones." : "Propuestas de mejora, mantenimiento y seguimiento de prioridades."}
          </p>
        </div>
        {!isReadOnly && <button onClick={openCreate} className="btn-red" style={{ padding: "12px 24px" }}>➕ Nueva Propuesta</button>}
      </header>

      {/* FILTROS */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "24px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
        <div style={{ flex: 1, minWidth: "250px" }}>
          <label style={labelSt}>Buscar</label>
          <input style={inputSt} placeholder="Cliente, consorcio o detalle..." value={search} onChange={e => setSearch(e.target.value)} />
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
      </div>

      {/* LISTADO */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden", border: "1px solid #eee" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando propuestas...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#999" }}>No se encontraron registros en el Plan de Acción.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "2px solid #eee" }}>
                  {["Fecha", "Cliente / Consorcio", "Detalle / Observación", "Prioridad", "Costo", "Estado", "Acciones"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: "0.72rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{h}</th>
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
                        <div style={{ fontSize: "0.75rem", color: "#888" }}>{item.consorcio || "Sin consorcio"}</div>
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
                          <span style={{ color: "#16a34a", fontSize: "0.75rem", fontWeight: 700 }}>✅ Realizado<br/><small style={{fontWeight:400}}>{item.fechaRealizacion ? new Date(item.fechaRealizacion + "T12:00:00").toLocaleDateString("es-AR") : ""}</small></span>
                        ) : (
                          <span style={{ color: "#f59e0b", fontSize: "0.75rem", fontWeight: 700 }}>⏳ Pendiente</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                        {!isReadOnly && (
                          <>
                            <button onClick={() => openEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }} title="Editar">✏️</button>
                            <button onClick={() => setDeleteConfirm(item.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", marginLeft: "5px" }} title="Eliminar">🗑️</button>
                          </>
                        )}
                        {isReadOnly && <span style={{ color: "#ccc", fontSize: "0.8rem" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CREATE/EDIT */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: "600px", padding: "30px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "20px" }}>{modal === "create" ? "Nueva Propuesta de Acción" : "Editar Propuesta"}</h2>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
              <div style={{ gridColumn: "span 2", position: "relative" }}>
                <label style={labelSt}>Cliente *</label>
                <input 
                  style={inputSt} 
                  value={fCliente} 
                  onChange={e => { setFCliente(e.target.value); setShowSuggestions(true); }} 
                  onFocus={() => { fetchUsuarios(); setShowSuggestions(true); }}
                  placeholder="Escribí nombre o empresa..." 
                />
                {showSuggestions && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", zIndex: 9999, maxHeight: "220px", overflowY: "auto", marginTop: "5px" }}>
                    {usuarios
                      .filter(u => {
                        if (!fCliente) return true; // Mostrar todos si está vacío
                        const searchStr = `${u.nombre} ${u.apellido} ${u.empresa || ""} ${u.email || ""}`.toLowerCase();
                        return searchStr.includes(fCliente.toLowerCase());
                      })
                      .map(u => {
                        const display = u.empresa ? `${u.empresa} - ${u.nombre} ${u.apellido}` : `${u.nombre} ${u.apellido}`;
                        return (
                          <div 
                            key={u.id} 
                            onClick={() => { setFCliente(display); setShowSuggestions(false); }}
                            style={{ padding: "10px 15px", cursor: "pointer", borderBottom: "1px solid #eee", fontSize: "0.85rem" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                          >
                            <div style={{ fontWeight: 700, color: "var(--primary-blue)" }}>{display}</div>
                            <div style={{ fontSize: "0.7rem", color: "#888" }}>{u.email} - {u.rol}</div>
                          </div>
                        );
                      })}
                    {usuarios.length > 0 && usuarios.filter(u => `${u.nombre} ${u.apellido} ${u.empresa || ""}`.toLowerCase().includes(fCliente.toLowerCase())).length === 0 && fCliente && (
                      <div style={{ padding: "12px 15px", color: "#666", fontSize: "0.8rem", background: "#fff9f0" }}>
                        ✨ No hay coincidencias exactas. Se guardará como: <strong>"{fCliente}"</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label style={labelSt}>Consorcio / Edificio</label>
                <input style={inputSt} value={fConsorcio} onChange={e => setFConsorcio(e.target.value)} placeholder="Ej: Torre Alem" />
              </div>
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
    </div>
  );
}

const labelSt = { display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "5px", textTransform: "uppercase" as any };
const inputSt = { width: "100%", padding: "11px", borderRadius: "8px", border: "1.5px solid #eee", fontSize: "0.9rem", outline: "none" };
