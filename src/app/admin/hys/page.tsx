"use client";
import { useEffect, useState, useRef } from "react";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, getDoc, where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// ─── Types ───────────────────────────────────────────────────────────────────
type TipoDoc = "Visita" | "Capacitación" | "ATS" | "Programa de Seguridad";
const TIPOS: TipoDoc[] = ["Visita", "Capacitación", "ATS", "Programa de Seguridad"];

interface HySDoc {
  id: string;
  cliente: string;
  fecha: string;
  tipo: TipoDoc;
  descripcion?: string;
  imagenes: string[];
  creadoPor?: string;
  createdAt?: any;
  updatedAt?: any;
}

const inputSt: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: "8px", border: "1.5px solid #ddd", fontSize: "0.92rem", outline: "none", boxSizing: "border-box" };
const labelSt: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#555", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.4px" };

const TIPO_COLORS: Record<TipoDoc, { bg: string; color: string; dot: string }> = {
  "Visita":              { bg: "#e0f2fe", color: "#0369a1", dot: "#0ea5e9" },
  "Capacitación":        { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e" },
  "ATS":                 { bg: "#fef9c3", color: "#854d0e", dot: "#eab308" },
  "Programa de Seguridad":{ bg: "#fdf2f8", color: "#86198f", dot: "#d946ef" },
};

export default function HySPage() {
  const [docs, setDocs] = useState<HySDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<HySDoc | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filtroTipo, setFiltroTipo] = useState<TipoDoc | "Todos">("Todos");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");

  // Form
  const [usuarios, setUsuarios] = useState<{id: string, nombre: string, apellido: string, empresa?: string}[]>([]);
  const [fCliente, setFCliente] = useState("");
  const [fFecha, setFFecha] = useState(new Date().toISOString().split("T")[0]);
  const [fTipo, setFTipo] = useState<TipoDoc>("Visita");
  const [fDescripcion, setFDescripcion] = useState("");
  const [fImagenes, setFImagenes] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      await fetchDocs();
      await fetchUsuarios();
    });
    return () => unsub();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const q = query(collection(db, "usuarios"), where("rol", "==", "cliente"));
      const snap = await getDocs(q);
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    } catch (e) { console.error(e); }
  };

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "hys_documentos"), orderBy("createdAt", "desc")));
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as HySDoc)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setFCliente(""); setFFecha(new Date().toISOString().split("T")[0]);
    setFTipo("Visita"); setFDescripcion(""); setFImagenes([]);
    setSelectedDoc(null); setModal("create");
  };

  const openEdit = (d: HySDoc) => {
    setFCliente(d.cliente); setFFecha(d.fecha);
    setFTipo(d.tipo); setFDescripcion(d.descripcion || ""); setFImagenes([...d.imagenes]);
    setSelectedDoc(d); setModal("edit");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const r = ref(storage, `hys/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        urls.push(await getDownloadURL(r));
      }
      setFImagenes(prev => [...prev, ...urls]);
    } catch { alert("Error al subir imagen."); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImagen = (idx: number) => setFImagenes(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!fCliente.trim()) { alert("El campo cliente es obligatorio."); return; }
    if (!fFecha) { alert("La fecha es obligatoria."); return; }
    setSaving(true);
    try {
      const payload: any = {
        cliente: fCliente.trim(),
        fecha: fFecha,
        tipo: fTipo,
        descripcion: fDescripcion.trim(),
        imagenes: fImagenes,
        updatedAt: serverTimestamp(),
      };
      if (modal === "create") {
        payload.creadoPor = auth.currentUser?.email || "";
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "hys_documentos"), payload);
      } else if (modal === "edit" && selectedDoc) {
        await updateDoc(doc(db, "hys_documentos", selectedDoc.id), payload);
      }
      setModal(null);
      await fetchDocs();
    } catch (e) { alert("Error al guardar: " + e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "hys_documentos", id));
      setDeleteConfirm(null);
      setDocs(prev => prev.filter(d => d.id !== id));
    } catch { alert("Error al eliminar."); }
  };

  // ── Filters ──────────────────────────────────────────────────────────────────
  const filtered = docs.filter(d => {
    if (filtroTipo !== "Todos" && d.tipo !== filtroTipo) return false;
    if (filtroCliente && !d.cliente.toLowerCase().includes(filtroCliente.toLowerCase())) return false;
    if (filtroFechaDesde && d.fecha < filtroFechaDesde) return false;
    if (filtroFechaHasta && d.fecha > filtroFechaHasta) return false;
    return true;
  });

  const fmtFecha = (s: string) => {
    try { return new Date(s + "T12:00:00").toLocaleDateString("es-AR"); } catch { return s; }
  };

  return (
    <div style={{ width: "100%" }}>
      {/* ── Header ── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Panel HyS</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>Gestión de documentos de Higiene y Seguridad.</p>
        </div>
        <button onClick={openCreate} className="btn-red" style={{ padding: "12px 22px" }}>
          ➕ Nuevo Documento
        </button>
      </header>

      {/* ── Filters ── */}
      <div style={{ background: "#fff", borderRadius: "12px", padding: "20px 24px", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", marginBottom: "24px", border: "1px solid #eee" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px", alignItems: "end" }}>
          <div>
            <label style={labelSt}>Tipo</label>
            <select style={{ ...inputSt, background: "#fff" }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}>
              <option value="Todos">Todos</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Cliente</label>
            <input style={inputSt} value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} placeholder="Filtrar por cliente..." />
          </div>
          <div>
            <label style={labelSt}>Fecha desde</label>
            <input type="date" style={inputSt} value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} />
          </div>
          <div>
            <label style={labelSt}>Fecha hasta</label>
            <input type="date" style={inputSt} value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button onClick={() => { setFiltroTipo("Todos"); setFiltroCliente(""); setFiltroFechaDesde(""); setFiltroFechaHasta(""); }}
              style={{ padding: "11px 16px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600, width: "100%" }}>
              🔄 Limpiar filtros
            </button>
          </div>
        </div>
        {/* Tipo quick-filters */}
        <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
          {(["Todos", ...TIPOS] as const).map(t => {
            const active = filtroTipo === t;
            const colors = t !== "Todos" ? TIPO_COLORS[t as TipoDoc] : { bg: "#f0f0f0", color: "#555", dot: "#999" };
            return (
              <button key={t} onClick={() => setFiltroTipo(t as any)}
                style={{ padding: "6px 14px", borderRadius: "20px", border: `2px solid ${active ? colors.dot : "#eee"}`, background: active ? colors.bg : "#fff", color: active ? colors.color : "#888", fontWeight: active ? 800 : 500, fontSize: "0.78rem", cursor: "pointer", transition: "0.2s" }}>
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stats badges ── */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        {TIPOS.map(t => {
          const count = docs.filter(d => d.tipo === t).length;
          const { bg, color } = TIPO_COLORS[t];
          return (
            <div key={t} style={{ background: bg, color, padding: "8px 16px", borderRadius: "20px", fontSize: "0.78rem", fontWeight: 800 }}>
              {t}: {count}
            </div>
          );
        })}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "60px", textAlign: "center", color: "#bbb", border: "1px dashed #ddd" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📂</div>
          <div style={{ fontWeight: 700 }}>No hay documentos que coincidan con los filtros.</div>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", overflow: "hidden", border: "1px solid #eee" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
              <thead style={{ background: "#fafafa", borderBottom: "1.5px solid #eee" }}>
                <tr>
                  {["Fecha", "Cliente", "Tipo", "Descripción", "Fotos", "Acciones"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: "0.72rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const { bg, color, dot } = TIPO_COLORS[d.tipo];
                  return (
                    <tr key={d.id} style={{ borderBottom: "1px solid #f5f5f5" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fafcff")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      <td style={{ padding: "14px 18px", whiteSpace: "nowrap", fontSize: "0.88rem", fontWeight: 600 }}>{fmtFecha(d.fecha)}</td>
                      <td style={{ padding: "14px 18px", fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.92rem" }}>{d.cliente}</td>
                      <td style={{ padding: "14px 18px" }}>
                        <span style={{ background: bg, color, fontSize: "0.72rem", fontWeight: 800, padding: "4px 11px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: dot, flexShrink: 0 }} />
                          {d.tipo}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px", fontSize: "0.85rem", color: "#555", maxWidth: "250px" }}>
                        {d.descripcion ? (
                          <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}>{d.descripcion}</span>
                        ) : <span style={{ color: "#ccc" }}>—</span>}
                      </td>
                      {/* Image thumbnails */}
                      <td style={{ padding: "14px 18px" }}>
                        {d.imagenes.length > 0 ? (
                          <div style={{ display: "flex", gap: "6px", flexWrap: "nowrap" }}>
                            {d.imagenes.slice(0, 3).map((img, i) => (
                              <div key={i} onClick={() => setLightbox(img)}
                                style={{ width: "44px", height: "44px", borderRadius: "6px", overflow: "hidden", cursor: "pointer", border: "2px solid #eee", position: "relative", flexShrink: 0 }}>
                                <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            ))}
                            {d.imagenes.length > 3 && (
                              <div onClick={() => openEdit(d)}
                                style={{ width: "44px", height: "44px", borderRadius: "6px", background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.72rem", fontWeight: 800, color: "var(--primary-blue)", flexShrink: 0 }}>
                                +{d.imagenes.length - 3}
                              </div>
                            )}
                          </div>
                        ) : <span style={{ color: "#ccc", fontSize: "0.82rem" }}>Sin fotos</span>}
                      </td>
                      <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                        <button onClick={() => openEdit(d)} title="Editar"
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "5px", borderRadius: "6px" }}>✏️</button>
                        <button onClick={() => setDeleteConfirm(d.id)} title="Eliminar"
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "5px", borderRadius: "6px", marginLeft: "2px" }}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", cursor: "zoom-out" }}>
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: "20px", right: "24px", background: "none", border: "none", color: "#fff", fontSize: "2rem", cursor: "pointer" }}>✕</button>
          <img src={lightbox} alt="Vista completa" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "8px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} />
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "380px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "10px" }}>¿Eliminar documento?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer. Las imágenes asociadas se conservarán en Storage.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, overflowY: "auto", padding: "40px 20px" }}>
          <div style={{ background: "#fff", borderRadius: "14px", maxWidth: "640px", margin: "0 auto", padding: "32px", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--primary-blue)" }}>
                {modal === "create" ? "Nuevo Documento HyS" : "Editar Documento"}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#999" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Cliente + Fecha */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={labelSt}>Cliente *</label>
                  <input 
                    style={inputSt} 
                    value={fCliente} 
                    onChange={e => setFCliente(e.target.value)} 
                    placeholder="Escribí nombre o empresa..." 
                    list="usuarios-list"
                  />
                  <datalist id="usuarios-list">
                    {usuarios.map(u => {
                      const display = u.empresa ? `${u.empresa} - ${u.nombre} ${u.apellido}` : `${u.nombre} ${u.apellido}`;
                      return <option key={u.id} value={display} />;
                    })}
                  </datalist>
                </div>
                <div>
                  <label style={labelSt}>Fecha *</label>
                  <input type="date" style={inputSt} value={fFecha} onChange={e => setFFecha(e.target.value)} />
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label style={labelSt}>Tipo de Documento</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                  {TIPOS.map(t => {
                    const active = fTipo === t;
                    const { bg, color, dot } = TIPO_COLORS[t];
                    return (
                      <button key={t} type="button" onClick={() => setFTipo(t)}
                        style={{ padding: "10px 14px", borderRadius: "8px", border: `2px solid ${active ? dot : "#eee"}`, background: active ? bg : "#fff", color: active ? color : "#666", fontWeight: active ? 800 : 500, cursor: "pointer", textAlign: "left", fontSize: "0.88rem", transition: "0.2s", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: active ? dot : "#ddd", flexShrink: 0 }} />
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label style={labelSt}>Descripción / Observaciones</label>
                <textarea style={{ ...inputSt, height: "90px", resize: "vertical", fontFamily: "inherit" }}
                  value={fDescripcion} onChange={e => setFDescripcion(e.target.value)}
                  placeholder="Detalle de la actividad realizada..." />
              </div>

              {/* Imágenes */}
              <div>
                <label style={labelSt}>Imágenes / Planillas ({fImagenes.length})</label>
                <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" style={{ display: "none" }} onChange={handleImageUpload} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  style={{ width: "100%", padding: "18px", borderRadius: "10px", border: "2px dashed #ddd", background: "#fafafa", cursor: "pointer", fontSize: "0.92rem", color: "#999", marginBottom: "12px", transition: "0.2s" }}>
                  {uploading ? "⏳ Subiendo imágenes..." : "📷 Agregar fotos o planillas escaneadas"}
                </button>
                {fImagenes.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "10px" }}>
                    {fImagenes.map((img, i) => (
                      <div key={i} style={{ position: "relative", borderRadius: "8px", overflow: "hidden", aspectRatio: "1", background: "#f0f0f0", border: "2px solid #eee" }}>
                        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onClick={() => setLightbox(img)} />
                        <button onClick={() => removeImagen(i)}
                          style={{ position: "absolute", top: "4px", right: "4px", background: "rgba(163,31,29,0.9)", border: "none", borderRadius: "50%", width: "22px", height: "22px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "12px", borderTop: "1px solid #eee", paddingTop: "20px", marginTop: "4px" }}>
                <button onClick={() => setModal(null)}
                  style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-red" style={{ flex: 2, padding: "12px" }}>
                  {saving ? "Guardando..." : "💾 Guardar Documento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
