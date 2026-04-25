"use client";
import { useEffect, useState, useCallback } from "react";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, getDocs, query, orderBy, where, doc, getDoc, deleteDoc,
  addDoc, serverTimestamp, updateDoc
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface OT {
  id: string;
  numero: number;
  fecha: string;
  clienteNombre: string;
  clienteEmpresa: string;
  clienteId?: string;
  tecnicos: string[];
  estado: string;
  planillasSeleccionadas: { nombre: string; codigo?: string }[];
  createdAt: any;
}

interface PlantillaItem {
  id: string;
  descripcion: string;
  esGrupo?: boolean;
  tipoColumna?: "checklist" | "tiempo" | "texto";
}

interface Plantilla {
  id: string;
  codigo: string;
  nombre: string;
  categoria: "deteccion" | "extincion" | "matafuegos" | "certificaciones";
  frecuencia: "mensual" | "trimestral" | "semestral" | "anual";
  tipo: "checklist" | "tabla_piso";
  descripcion?: string;
  modoChecklist?: "ok_nok" | "si_no";
  items?: PlantillaItem[];
  columnas?: string[];
  infoFields?: string[];
}

const CATEGORIAS = [
  { value: "deteccion", label: "Detección", icon: "🔍" },
  { value: "extincion", label: "Extinción", icon: "🧯" },
  { value: "matafuegos", label: "Matafuegos", icon: "🔥" },
  { value: "certificaciones", label: "Certificaciones", icon: "📜" },
];

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  borrador: { bg: "#f5f5f5", color: "#666" },
  en_proceso: { bg: "#fff3e0", color: "#e65100" },
  completada: { bg: "#e8f5e9", color: "#2e7d32" },
};

export default function OTUnifiedPage() {
  const [activeTab, setActiveTab] = useState<"ots" | "gestor">("ots");
  const [ots, setOts] = useState<OT[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: "ot" | "plantilla" } | null>(null);
  
  // Modal Gestor
  const [modalGestor, setModalGestor] = useState<"create" | "edit" | null>(null);
  const [editingPlantilla, setEditingPlantilla] = useState<Plantilla | null>(null);
  const [saving, setSaving] = useState(false);
  const [newInfoField, setNewInfoField] = useState("");
  const [newCol, setNewCol] = useState("");

  const emptyPlantilla = (): Omit<Plantilla, "id"> => ({
    codigo: "",
    nombre: "",
    categoria: "deteccion",
    frecuencia: "mensual",
    tipo: "checklist",
    modoChecklist: "ok_nok",
    descripcion: "",
    infoFields: [],
    items: [{ id: crypto.randomUUID(), descripcion: "" }],
    columnas: [""],
  });
  const [formPlantilla, setFormPlantilla] = useState(emptyPlantilla());

  // Filtros
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const router = useRouter();

  const isStaffRole = (r: string) => ["admin", "tecnico", "superadmin"].includes(r);

  const fetchOTs = useCallback(async (r: string, uid: string) => {
    setLoading(true);
    try {
      let snap;
      const q = isStaffRole(r)
        ? query(collection(db, "ordenes_trabajo"), orderBy("createdAt", "desc"))
        : query(collection(db, "ordenes_trabajo"), where("clienteId", "==", uid), orderBy("createdAt", "desc"));
      
      try {
        snap = await getDocs(q);
      } catch {
        snap = await getDocs(collection(db, "ordenes_trabajo"));
      }

      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as OT));
      // SEGURIDAD: Filtrar por clienteId si no es staff, pase lo que pase
      if (!isStaffRole(r)) {
        docs = docs.filter(o => o.clienteId === uid);
      }
      
      docs.sort((a, b) => {
        const ts = (o: any) => o.createdAt?.seconds ?? o.fechaCreacion?.seconds ?? (o.fecha ? new Date(o.fecha).getTime() / 1000 : 0);
        return ts(b) - ts(a);
      });
      setOts(docs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const fetchPlantillas = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "plantillas_inspeccion"), orderBy("categoria"), orderBy("codigo")));
      setPlantillas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Plantilla)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      const r = userDoc.exists() ? userDoc.data().rol : "cliente";
      setRole(r);
      if (activeTab === "ots") fetchOTs(r, u.uid);
      else fetchPlantillas();
    });
    return () => unsub();
  }, [router, activeTab, fetchOTs, fetchPlantillas]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "ot") {
        const docRef = doc(db, "ordenes_trabajo", deleteConfirm.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fotos = docSnap.data().fotos || [];
          for (const url of fotos) {
            try { await deleteObject(ref(storage, url)); } catch {}
          }
        }
        await deleteDoc(docRef);
        setOts(prev => prev.filter(o => o.id !== deleteConfirm.id));
      } else {
        await deleteDoc(doc(db, "plantillas_inspeccion", deleteConfirm.id));
        setPlantillas(prev => prev.filter(p => p.id !== deleteConfirm.id));
      }
      setDeleteConfirm(null);
    } catch (e) { alert("Error al eliminar."); }
  };

  const handleSavePlantilla = async () => {
    if (!formPlantilla.codigo || !formPlantilla.nombre) { alert("Código y nombre son obligatorios."); return; }
    setSaving(true);
    try {
      const payload: any = {
        codigo: formPlantilla.codigo.toUpperCase().trim(),
        nombre: formPlantilla.nombre.trim(),
        categoria: formPlantilla.categoria,
        frecuencia: formPlantilla.frecuencia,
        tipo: formPlantilla.tipo,
        descripcion: formPlantilla.descripcion,
        infoFields: formPlantilla.infoFields || [],
        modoChecklist: formPlantilla.modoChecklist || "ok_nok",
        updatedAt: serverTimestamp(),
      };
      if (formPlantilla.tipo === "checklist") {
        payload.items = (formPlantilla.items || []).filter(i => i.descripcion.trim());
        payload.columnas = [];
      } else {
        payload.columnas = (formPlantilla.columnas || []).filter(c => c.trim());
        payload.items = [];
      }

      if (modalGestor === "edit" && editingPlantilla) {
        await updateDoc(doc(db, "plantillas_inspeccion", editingPlantilla.id), payload);
      } else {
        await addDoc(collection(db, "plantillas_inspeccion"), { ...payload, createdAt: serverTimestamp() });
      }
      setModalGestor(null);
      await fetchPlantillas();
    } catch (e) { alert("Error al guardar: " + e); }
    finally { setSaving(false); }
  };

  const openEditPlantilla = (p: Plantilla) => {
    setFormPlantilla({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      frecuencia: p.frecuencia,
      tipo: p.tipo,
      modoChecklist: p.modoChecklist || "ok_nok",
      descripcion: p.descripcion || "",
      infoFields: p.infoFields || [],
      items: p.items?.length ? p.items : [{ id: crypto.randomUUID(), descripcion: "" }],
      columnas: p.columnas?.length ? p.columnas : [""],
    });
    setEditingPlantilla(p);
    setModalGestor("edit");
  };

  // Helpers Plantilla
  const addItem = () => setFormPlantilla(f => ({ ...f, items: [...(f.items || []), { id: crypto.randomUUID(), descripcion: "" }] }));
  const updateItem = (idx: number, field: keyof PlantillaItem, val: any) =>
    setFormPlantilla(f => ({ ...f, items: f.items!.map((it, i) => i === idx ? { ...it, [field]: val } : it) }));
  const removeItem = (idx: number) => setFormPlantilla(f => ({ ...f, items: f.items!.filter((_, i) => i !== idx) }));
  const addColumn = () => { if (!newCol.trim()) return; setFormPlantilla(f => ({ ...f, columnas: [...(f.columnas || []), newCol.trim()] })); setNewCol(""); };
  const removeCol = (idx: number) => setFormPlantilla(f => ({ ...f, columnas: f.columnas!.filter((_, i) => i !== idx) }));
  const addInfoField = () => { if (!newInfoField.trim()) return; setFormPlantilla(f => ({ ...f, infoFields: [...(f.infoFields || []), newInfoField.trim()] })); setNewInfoField(""); };
  const removeInfoField = (idx: number) => setFormPlantilla(f => ({ ...f, infoFields: f.infoFields!.filter((_, i) => i !== idx) }));

  const filteredOts = ots.filter(ot => {
    const matchesSearch = String(ot.numero).includes(search) || ot.clienteNombre?.toLowerCase().includes(search.toLowerCase()) || ot.clienteEmpresa?.toLowerCase().includes(search.toLowerCase());
    const otDate = ot.fecha ? new Date(ot.fecha) : null;
    let matchesDate = true;
    if (otDate) {
      if (dateFrom && otDate < new Date(dateFrom)) matchesDate = false;
      if (dateTo && otDate > new Date(dateTo)) matchesDate = false;
    }
    return matchesSearch && matchesDate;
  });

  const isStaff = isStaffRole(role ?? "");
  const isAdmin = role === "admin" || role === "superadmin";
  const isClient = role === "cliente";
  const isReadOnly = isClient; // clientes solo pueden ver

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* HEADER */}
      <header style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>
            {isClient ? "Mis Órdenes" : "Órdenes de Trabajo"}
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>{activeTab === "ots" ? "Gestión de inspecciones en campo." : "Gestión de plantillas base."}</p>
        </div>
        {isStaff && !isReadOnly && (
          <div style={{ display: "flex", gap: "10px" }}>
            {activeTab === "gestor" ? (
              isAdmin && <button onClick={() => { setFormPlantilla(emptyPlantilla()); setModalGestor("create"); }} className="btn-red" style={{ padding: "12px 24px" }}>➕ NUEVA PLANTILLA</button>
            ) : (
              <Link href="/admin/planillas/deteccion/nueva" className="btn-red" style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                ➕ NUEVA OT
              </Link>
            )}
          </div>
        )}
      </header>

      {/* TABS */}
      <div style={{ 
        display: "inline-flex", 
        background: "#e2e8f0", 
        padding: "4px", 
        borderRadius: "12px", 
        marginBottom: "24px",
        gap: "4px"
      }}>
        <button 
          onClick={() => setActiveTab("ots")}
          style={{ 
            padding: "10px 30px", cursor: "pointer", border: "none", borderRadius: "10px", fontSize: "0.85rem", fontWeight: 800, transition: "0.2s",
            background: activeTab === "ots" ? "#fff" : "transparent",
            color: activeTab === "ots" ? "var(--primary-blue)" : "#64748b",
            boxShadow: activeTab === "ots" ? "0 4px 10px rgba(0,0,0,0.08)" : "none",
          }}>
          📋 Listado OT
        </button>
        {isAdmin && !isReadOnly && (
          <button 
            onClick={() => setActiveTab("gestor")}
            style={{ 
              padding: "10px 30px", cursor: "pointer", border: "none", borderRadius: "10px", fontSize: "0.85rem", fontWeight: 800, transition: "0.2s",
              background: activeTab === "gestor" ? "#fff" : "transparent",
              color: activeTab === "gestor" ? "var(--primary-blue)" : "#64748b",
              boxShadow: activeTab === "gestor" ? "0 4px 10px rgba(0,0,0,0.08)" : "none",
            }}>
            🗂️ Gestor
          </button>
        )}
      </div>

      {activeTab === "ots" ? (
        <>
          {/* FILTROS OT */}
          <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
            <div style={{ flex: 1, minWidth: "220px" }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Buscar por OT o Cliente</label>
              <input type="text" placeholder="N°, cliente o empresa..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.9rem" }} />
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

          {/* TABLA OT */}
          <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando órdenes...</div>
            ) : filteredOts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px", color: "#999" }}>No se encontraron órdenes de trabajo.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fc", borderBottom: "2px solid #eef0f3" }}>
                      {["N° OT", "Fecha", "Cliente", "Estado", ""].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOts.map(ot => {
                      const ec = ESTADO_COLORS[ot.estado] || ESTADO_COLORS.borrador;
                      return (
                        <tr key={ot.id} style={{ borderBottom: "1px solid #f2f5f9" }}>
                          <td style={{ padding: "14px 16px", fontWeight: 800, color: "var(--primary-blue)" }}>OT-{String(ot.numero || "?").padStart(4, "0")}</td>
                          <td style={{ padding: "14px 16px", fontSize: "0.85rem" }}>{ot.fecha ? new Date(ot.fecha).toLocaleDateString("es-AR") : "-"}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{ot.clienteNombre}</div>
                            <div style={{ fontSize: "0.75rem", color: "#888" }}>{ot.clienteEmpresa}</div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ fontSize: "0.65rem", padding: "4px 8px", borderRadius: "10px", fontWeight: 900, textTransform: "uppercase", background: ec.bg, color: ec.color }}>{ot.estado.replace("_", " ")}</span>
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                              <Link href={`/admin/planillas/deteccion/${ot.id}`} style={{ padding: "6px 10px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", textDecoration: "none", fontSize: "0.75rem", fontWeight: 700 }}>
                                {isReadOnly ? "Ver" : "Editar"}
                              </Link>
                              {isAdmin && !isReadOnly && <button onClick={() => setDeleteConfirm({ id: ot.id, type: "ot" })} style={{ padding: "6px 10px", borderRadius: "6px", border: "none", background: "#fee2e2", color: "#b91c1c", cursor: "pointer" }}>🗑️</button>}
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
        </>
      ) : (
        <>
          {/* GESTOR DE PLANTILLAS COMPLETO */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando plantillas...</div>
          ) : (
            CATEGORIAS.map(cat => (
              <section key={cat.value} style={{ marginBottom: "35px" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                  {cat.icon} {cat.label}
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
                  {plantillas.filter(p => p.categoria === cat.value).map(p => (
                    <div key={p.id} style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)", border: "1px solid #eee" }}>
                      <div style={{ marginBottom: "12px" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 900, color: "var(--primary-red)", background: "#fff1f0", padding: "2px 8px", borderRadius: "4px" }}>{p.codigo}</span>
                        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--primary-blue)", marginTop: "5px" }}>{p.nombre}</h3>
                      </div>
                      <div style={{ display: "flex", gap: "6px", marginBottom: "15px" }}>
                        <span style={{ fontSize: "0.7rem", background: p.tipo === "checklist" ? "#e3f2fd" : "#e8f5e9", color: p.tipo === "checklist" ? "#1565c0" : "#2e7d32", padding: "3px 9px", borderRadius: "20px", fontWeight: 700 }}>{p.tipo === "checklist" ? "Checklist" : "Tabla"}</span>
                        <span style={{ fontSize: "0.7rem", background: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: "20px", fontWeight: 700 }}>{p.frecuencia}</span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => openEditPlantilla(p)} style={{ flex: 1, padding: "8px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}>✏️ Editar</button>
                        <button onClick={() => setDeleteConfirm({ id: p.id, type: "plantilla" })} style={{ padding: "8px 12px", borderRadius: "6px", background: "#fee2e2", color: "#b91c1c", border: "none", cursor: "pointer" }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                  {plantillas.filter(p => p.categoria === cat.value).length === 0 && (
                    <p style={{ color: "#999", fontSize: "0.85rem", fontStyle: "italic" }}>No hay plantillas en esta categoría.</p>
                  )}
                </div>
              </section>
            ))
          )}
        </>
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

      {/* MODAL GESTOR (CREATE/EDIT PLANTILLA) */}
      {modalGestor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, overflowY: "auto", padding: "40px 20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", maxWidth: "700px", margin: "0 auto", padding: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--primary-blue)" }}>{modalGestor === "create" ? "Nueva Plantilla" : "Editar Plantilla"}</h2>
              <button onClick={() => setModalGestor(null)} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#999" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
              <div>
                <label style={labelStyle}>Código *</label>
                <input style={inputStyle} value={formPlantilla.codigo} onChange={e => setFormPlantilla(f => ({ ...f, codigo: e.target.value }))} placeholder="ARIFA-IPM-020" />
              </div>
              <div>
                <label style={labelStyle}>Frecuencia</label>
                <select style={inputStyle} value={formPlantilla.frecuencia} onChange={e => setFormPlantilla(f => ({ ...f, frecuencia: e.target.value as any }))}>
                  {["mensual", "trimestral", "semestral", "anual"].map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelStyle}>Nombre de la Plantilla *</label>
                <input style={inputStyle} value={formPlantilla.nombre} onChange={e => setFormPlantilla(f => ({ ...f, nombre: e.target.value }))} placeholder="Test de Pulsadores y Sirenas" />
              </div>
              <div>
                <label style={labelStyle}>Categoría</label>
                <select style={inputStyle} value={formPlantilla.categoria} onChange={e => setFormPlantilla(f => ({ ...f, categoria: e.target.value as any }))}>
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tipo de tabla</label>
                <select style={inputStyle} value={formPlantilla.tipo} onChange={e => setFormPlantilla(f => ({ ...f, tipo: e.target.value as any }))}>
                  <option value="checklist">Checklist</option>
                  <option value="tabla_piso">Tabla por piso</option>
                </select>
              </div>
            </div>

            {/* SECCION ITEMS / COLUMNAS */}
            {formPlantilla.tipo === "checklist" ? (
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Ítems / Grupos</label>
                {(formPlantilla.items || []).map((item, idx) => (
                  <div key={item.id} style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                    <input type="checkbox" checked={item.esGrupo} onChange={e => updateItem(idx, "esGrupo", e.target.checked)} style={{ width: "20px" }} />
                    <input style={{ ...inputStyle, flex: 1, marginBottom: 0, fontWeight: item.esGrupo ? 800 : 400 }} value={item.descripcion} onChange={e => updateItem(idx, "descripcion", e.target.value)} placeholder="Descripción..." />
                    <button onClick={() => removeItem(idx)} style={removeBtnStyle}>✕</button>
                  </div>
                ))}
                <button onClick={addItem} style={{ padding: "8px", width: "100%", borderRadius: "8px", border: "1px dashed #ccc", background: "none", cursor: "pointer" }}>+ Agregar ítem</button>
              </div>
            ) : (
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Columnas</label>
                {(formPlantilla.columnas || []).map((col, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                    <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} value={col} onChange={e => setFormPlantilla(f => ({ ...f, columnas: f.columnas!.map((c, i) => i === idx ? e.target.value : c) }))} />
                    <button onClick={() => removeCol(idx)} style={removeBtnStyle}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: "6px" }}>
                  <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} value={newCol} onChange={e => setNewCol(e.target.value)} placeholder="Nueva columna..." />
                  <button onClick={addColumn} style={{ padding: "8px 15px", borderRadius: "8px", background: "var(--primary-blue)", color: "#fff", border: "none" }}>+</button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #eee", paddingTop: "20px" }}>
              <button onClick={() => setModalGestor(null)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #ddd", background: "none", cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleSavePlantilla} disabled={saving} className="btn-red" style={{ padding: "10px 30px" }}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "5px", textTransform: "uppercase" as any };
const inputStyle = { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.9rem", marginBottom: "10px" };
const removeBtnStyle = { padding: "8px 12px", borderRadius: "8px", background: "#fee2e2", color: "#b91c1c", border: "none", cursor: "pointer" };
