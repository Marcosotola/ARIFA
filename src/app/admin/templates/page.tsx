"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, orderBy, query
} from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlantillaItem {
  id: string;
  descripcion: string;
  esGrupo?: boolean; // header/separator row
}

interface Plantilla {
  id: string;
  codigo: string;      // ARIFA-IPM-020
  nombre: string;
  categoria: "deteccion" | "extincion";
  frecuencia: "mensual" | "trimestral" | "semestral" | "anual";
  tipo: "checklist" | "tabla_piso";
  descripcion?: string;
  // checklist fields
  items?: PlantillaItem[];
  // tabla_piso fields
  columnas?: string[];
  // extra info fields shown on planilla header
  infoFields?: string[]; // e.g. ["Sistema de detección", "Tipo de sistema", "Cantidad de dispositivos"]
}

const CATEGORIAS = [
  { value: "deteccion", label: "Detección", icon: "🔍" },
  { value: "extincion", label: "Extinción", icon: "🧯" },
];
const FRECUENCIAS = ["mensual", "trimestral", "semestral", "anual"];

// Pre-loaded seed data for first time setup
const SEED_PLANTILLAS: Omit<Plantilla, "id">[] = [
  {
    codigo: "ARIFA-IPM-020",
    nombre: "Central de Detección y Paneles de Control",
    categoria: "deteccion",
    frecuencia: "trimestral",
    tipo: "checklist",
    descripcion: "Inspección y prueba trimestral del panel central de detección de incendios.",
    infoFields: ["Sistema de detección de incendios", "Tipo de sistema"],
    items: [
      { id: "g1", descripcion: "INSPECCIÓN", esGrupo: true },
      { id: "g1-1", descripcion: "Fuentes de energía", esGrupo: true },
      { id: "i1", descripcion: "¿Se halla alimentada con tensión Primaria (220v)?" },
      { id: "i2", descripcion: "¿Se halla alimentada con tensión Secundaria (Baterías) 220v?" },
      { id: "g1-2", descripcion: "Instalación", esGrupo: true },
      { id: "i3", descripcion: "¿Posee cargas externas?" },
      { id: "i4", descripcion: "¿Están todos los componentes incrustados?" },
      { id: "i5", descripcion: "¿Están ensamblados en alineación?" },
      { id: "g1-3", descripcion: "Cableado", esGrupo: true },
      { id: "i6", descripcion: "¿Todas las zonas vinculadas al panel están conectadas?" },
      { id: "g2", descripcion: "PRUEBA", esGrupo: true },
      { id: "g2-1", descripcion: "Panel de Control", esGrupo: true },
      { id: "i7", descripcion: "Fusibles" },
      { id: "i8", descripcion: "Equipos de interfase" },
      { id: "i9", descripcion: "Alimentación de energía primaria" },
      { id: "i10", descripcion: "Indicadores luminosos del panel" },
      { id: "i11", descripcion: "Señales de falla propias del panel de simulación" },
      { id: "i12", descripcion: "Conexiones de red" },
      { id: "i13", descripcion: "Medición de tensión de baterías (alimentación secundaria)" },
      { id: "i14", descripcion: "¿El panel se encuentra conectado a la central de detección?" },
      { id: "i15", descripcion: "¿El panel recibe información normal de toda la zona monitoreada?" },
    ],
  },
  {
    codigo: "ARIFA-IPM-021",
    nombre: "Test de Detectores y Barreras de Humo",
    categoria: "deteccion",
    frecuencia: "mensual",
    tipo: "tabla_piso",
    descripcion: "Prueba mensual de detectores de humo, temperatura y gas.",
    infoFields: ["Sistema de detección de incendios", "Tipo de sistema", "Cantidad de detectores CONTROLADOS"],
    columnas: ["N°", "Tipo", "Fecha", "Tipo de Prueba", "Tiempo de Reporte", "Señal Visual", "Señal Acústica", "Estado", "Observaciones"],
  },
  {
    codigo: "ARIFA-IPM-022",
    nombre: "Test de Pulsadores y Sirenas",
    categoria: "deteccion",
    frecuencia: "mensual",
    tipo: "tabla_piso",
    descripcion: "Prueba mensual de pulsadores manuales, sirenas y luces estroboscópicas.",
    infoFields: ["Sistema de detección de incendios", "Tipo de sistema", "Cantidad de pulsadores CONTROLADOS", "Cantidad de sirenas CONTROLADOS"],
    columnas: ["Piso", "Tipo", "Fecha", "Tipo de Prueba", "Tiempo de Reporte", "Luz Estroboscópica", "Sirenas", "Estado", "Observaciones"],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TemplatesPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Plantilla | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const emptyForm = (): Omit<Plantilla, "id"> => ({
    codigo: "",
    nombre: "",
    categoria: "deteccion",
    frecuencia: "mensual",
    tipo: "checklist",
    descripcion: "",
    infoFields: [],
    items: [{ id: crypto.randomUUID(), descripcion: "" }],
    columnas: [""],
  });
  const [form, setForm] = useState(emptyForm());
  const [newInfoField, setNewInfoField] = useState("");
  const [newCol, setNewCol] = useState("");

  useEffect(() => { fetchPlantillas(); }, []);

  const fetchPlantillas = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "plantillas_inspeccion"), orderBy("categoria"), orderBy("codigo")));
      setPlantillas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Plantilla)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSeed = async () => {
    if (!confirm("¿Cargar las plantillas base pre-configuradas? Solo se recomienda hacer esto una vez.")) return;
    setSeeding(true);
    try {
      for (const p of SEED_PLANTILLAS) {
        await addDoc(collection(db, "plantillas_inspeccion"), { ...p, createdAt: serverTimestamp() });
      }
      await fetchPlantillas();
    } catch (e) { alert("Error al cargar plantillas: " + e); }
    finally { setSeeding(false); }
  };

  const openCreate = () => { setForm(emptyForm()); setEditing(null); setModal("create"); };
  const openEdit = (p: Plantilla) => {
    setForm({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      frecuencia: p.frecuencia,
      tipo: p.tipo,
      descripcion: p.descripcion || "",
      infoFields: p.infoFields || [],
      items: p.items?.length ? p.items : [{ id: crypto.randomUUID(), descripcion: "" }],
      columnas: p.columnas?.length ? p.columnas : [""],
    });
    setEditing(p);
    setModal("edit");
  };

  const handleSave = async () => {
    if (!form.codigo || !form.nombre) { alert("Código y nombre son obligatorios."); return; }
    setSaving(true);
    try {
      const payload: any = {
        codigo: form.codigo.toUpperCase().trim(),
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        frecuencia: form.frecuencia,
        tipo: form.tipo,
        descripcion: form.descripcion,
        infoFields: form.infoFields || [],
        updatedAt: serverTimestamp(),
      };
      if (form.tipo === "checklist") {
        payload.items = (form.items || []).filter(i => i.descripcion.trim());
        payload.columnas = [];
      } else {
        payload.columnas = (form.columnas || []).filter(c => c.trim());
        payload.items = [];
      }

      if (modal === "edit" && editing) {
        await updateDoc(doc(db, "plantillas_inspeccion", editing.id), payload);
      } else {
        await addDoc(collection(db, "plantillas_inspeccion"), { ...payload, createdAt: serverTimestamp() });
      }
      setModal(null);
      await fetchPlantillas();
    } catch (e) { alert("Error al guardar: " + e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "plantillas_inspeccion", id));
      setDeleteConfirm(null);
      await fetchPlantillas();
    } catch (e) { alert("Error al eliminar: " + e); }
  };

  // Item helpers
  const addItem = () => setForm(f => ({ ...f, items: [...(f.items || []), { id: crypto.randomUUID(), descripcion: "" }] }));
  const updateItem = (idx: number, field: keyof PlantillaItem, val: any) =>
    setForm(f => ({ ...f, items: f.items!.map((it, i) => i === idx ? { ...it, [field]: val } : it) }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items!.filter((_, i) => i !== idx) }));

  const addColumn = () => { if (!newCol.trim()) return; setForm(f => ({ ...f, columnas: [...(f.columnas || []), newCol.trim()] })); setNewCol(""); };
  const removeCol = (idx: number) => setForm(f => ({ ...f, columnas: f.columnas!.filter((_, i) => i !== idx) }));

  const addInfoField = () => { if (!newInfoField.trim()) return; setForm(f => ({ ...f, infoFields: [...(f.infoFields || []), newInfoField.trim()] })); setNewInfoField(""); };
  const removeInfoField = (idx: number) => setForm(f => ({ ...f, infoFields: f.infoFields!.filter((_, i) => i !== idx) }));

  const byCategoria = (cat: string) => plantillas.filter(p => p.categoria === cat);

  return (
    <div style={{ maxWidth: "1100px" }}>
      {/* HEADER */}
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Gestión de Plantillas</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>Creá, editá y eliminá las plantillas de inspección base.</p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {plantillas.length === 0 && (
            <button onClick={handleSeed} disabled={seeding} className="btn-blue" style={{ padding: "10px 20px", fontSize: "0.85rem" }}>
              {seeding ? "Cargando..." : "⚡ Cargar Plantillas Base"}
            </button>
          )}
          <button onClick={openCreate} className="btn-red" style={{ padding: "10px 20px", fontSize: "0.85rem" }}>
            ➕ Nueva Plantilla
          </button>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando plantillas...</div>
      ) : (
        CATEGORIAS.map(cat => (
          <section key={cat.value} style={{ marginBottom: "35px" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
              {cat.icon} {cat.label}
            </h2>
            {byCategoria(cat.value).length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontStyle: "italic", padding: "15px 20px", background: "#f9f9f9", borderRadius: "8px" }}>
                No hay plantillas de {cat.label} aún.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
                {byCategoria(cat.value).map(p => (
                  <div key={p.id} style={{ background: "#fff", borderRadius: "10px", padding: "20px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)", border: "1px solid #eef0f3" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px" }}>
                      <div>
                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-red)", background: "#fff1f0", padding: "2px 8px", borderRadius: "4px", letterSpacing: "0.5px" }}>
                          {p.codigo}
                        </span>
                        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--primary-blue)", marginTop: "8px", lineHeight: "1.3" }}>{p.nombre}</h3>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "15px" }}>
                      <span style={{ fontSize: "0.72rem", background: p.tipo === "checklist" ? "#e3f2fd" : "#e8f5e9", color: p.tipo === "checklist" ? "#1565c0" : "#2e7d32", padding: "3px 9px", borderRadius: "20px", fontWeight: 700, textTransform: "capitalize" }}>
                        {p.tipo === "checklist" ? "✅ Checklist" : "📊 Tabla por piso"}
                      </span>
                      <span style={{ fontSize: "0.72rem", background: "#f5f5f5", color: "#666", padding: "3px 9px", borderRadius: "20px", fontWeight: 600, textTransform: "capitalize" }}>
                        {p.frecuencia}
                      </span>
                    </div>
                    {p.tipo === "checklist" && p.items && (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                        {p.items.filter(i => !i.esGrupo).length} ítems
                      </p>
                    )}
                    {p.tipo === "tabla_piso" && p.columnas && (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                        {p.columnas.length} columnas
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => openEdit(p)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600, fontSize: "0.82rem" }}>
                        ✏️ Editar
                      </button>
                      <button onClick={() => setDeleteConfirm(p.id)} style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #ffddd9", background: "#fff5f4", cursor: "pointer", color: "var(--primary-red)", fontWeight: 700, fontSize: "0.82rem" }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar plantilla?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer. Las órdenes de trabajo existentes no se verán afectadas.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREATE / EDIT */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, overflowY: "auto", padding: "40px 20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", maxWidth: "700px", margin: "0 auto", padding: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--primary-blue)" }}>
                {modal === "create" ? "Nueva Plantilla" : "Editar Plantilla"}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#999" }}>✕</button>
            </div>

            {/* Base fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
              <div>
                <label style={labelStyle}>Código *</label>
                <input style={inputStyle} value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="ARIFA-IPM-020" />
              </div>
              <div>
                <label style={labelStyle}>Frecuencia</label>
                <select style={inputStyle} value={form.frecuencia} onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value as any }))}>
                  {FRECUENCIAS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelStyle}>Nombre de la Plantilla *</label>
                <input style={inputStyle} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Test de Pulsadores y Sirenas" />
              </div>
              <div>
                <label style={labelStyle}>Categoría</label>
                <select style={inputStyle} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as any }))}>
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tipo de tabla</label>
                <select style={inputStyle} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}>
                  <option value="checklist">Checklist (OK/NOK/N/A)</option>
                  <option value="tabla_piso">Tabla por piso/dispositivo</option>
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelStyle}>Descripción (opcional)</label>
                <input style={inputStyle} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Breve descripción de la planilla..." />
              </div>
            </div>

            {/* Info fields (datos adicionales del encabezado) */}
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Campos de información del encabezado</label>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "10px" }}>Ej: "Sistema de detección de incendios", "Tipo de sistema"</p>
              {(form.infoFields || []).map((f, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                  <input
                    style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                    value={f}
                    onChange={e => setForm(prev => ({ ...prev, infoFields: prev.infoFields!.map((x, j) => j === i ? e.target.value : x) }))}
                  />
                  <button onClick={() => removeInfoField(i)} style={removeBtnStyle}>✕</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px" }}>
                <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} value={newInfoField} onChange={e => setNewInfoField(e.target.value)} placeholder="Nuevo campo..." onKeyDown={e => e.key === "Enter" && addInfoField()} />
                <button onClick={addInfoField} style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid var(--primary-blue)", background: "transparent", cursor: "pointer", color: "var(--primary-blue)", fontWeight: 700 }}>+</button>
              </div>
            </div>

            {/* CHECKLIST items */}
            {form.tipo === "checklist" && (
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Ítems / Grupos (en orden)</label>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "10px" }}>Marcá "Grupo/Sección" para que aparezca como cabecera de sección en la tabla.</p>
                {(form.items || []).map((item, idx) => (
                  <div key={item.id} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={item.esGrupo || false}
                      onChange={e => updateItem(idx, "esGrupo", e.target.checked)}
                      title="Es grupo/sección"
                      style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                    />
                    <input
                      style={{
                        ...inputStyle,
                        flex: 1,
                        marginBottom: 0,
                        fontWeight: item.esGrupo ? 700 : 400,
                        background: item.esGrupo ? "#f0f4ff" : "#fff",
                        borderColor: item.esGrupo ? "#c5d5f0" : "#ddd"
                      }}
                      value={item.descripcion}
                      onChange={e => updateItem(idx, "descripcion", e.target.value)}
                      placeholder={item.esGrupo ? "Nombre del grupo (ej: Fuentes de energía)" : "Descripción del ítem..."}
                    />
                    <button onClick={() => removeItem(idx)} style={removeBtnStyle}>✕</button>
                  </div>
                ))}
                <button onClick={addItem} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px dashed #ccc", background: "#f8f9fa", cursor: "pointer", fontSize: "0.85rem", color: "#666", marginTop: "4px" }}>
                  + Agregar ítem
                </button>
              </div>
            )}

            {/* TABLE columns */}
            {form.tipo === "tabla_piso" && (
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Columnas de la tabla</label>
                {(form.columnas || []).map((col, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                    <input
                      style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                      value={col}
                      onChange={e => setForm(f => ({ ...f, columnas: f.columnas!.map((c, i) => i === idx ? e.target.value : c) }))}
                      placeholder={`Columna ${idx + 1}`}
                    />
                    <button onClick={() => removeCol(idx)} style={removeBtnStyle}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: "8px" }}>
                  <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} value={newCol} onChange={e => setNewCol(e.target.value)} placeholder="Nueva columna..." onKeyDown={e => e.key === "Enter" && addColumn()} />
                  <button onClick={addColumn} style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid var(--primary-blue)", background: "transparent", cursor: "pointer", color: "var(--primary-blue)", fontWeight: 700 }}>+</button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid #eee", paddingTop: "20px" }}>
              <button onClick={() => setModal(null)} style={{ padding: "12px 24px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-red" style={{ padding: "12px 30px" }}>
                {saving ? "Guardando..." : "💾 Guardar Plantilla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 700,
  color: "var(--text-dark)",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "6px",
  border: "1px solid #ddd",
  fontSize: "0.9rem",
  marginBottom: "4px",
};
const removeBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #ffddd9",
  background: "#fff5f4",
  cursor: "pointer",
  color: "var(--primary-red)",
  fontWeight: 700,
  flexShrink: 0,
};
