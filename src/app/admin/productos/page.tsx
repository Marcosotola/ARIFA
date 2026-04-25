"use client";
import { useEffect, useState, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, getDoc
} from "firebase/firestore";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Producto {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  proveedor: string;
  precio: number;       // precio de costo
  porcentaje: number;   // margen de ganancia %
  precioVenta: number;  // calculado
  activo: boolean;
  imagenes?: string[];  // URLs de las imágenes
  slug?: string;        // URL amigable
  createdAt?: any;
  updatedAt?: any;
}

const CATEGORIAS = [
  "Matafuegos", "Detectores y Alarmas", "Señalización", "Rociadores y Sprinklers",
  "Mangueras y Accesorios", "Equipos de Protección Personal",
  "Iluminación de Emergencia", "Botiquines y Primeros Auxilios", "Otro",
];

const CAT_COLORS: Record<string, string> = {
  "Matafuegos": "#e11d48",
  "Detectores y Alarmas": "#2563eb",
  "Señalización": "#ea580c",
  "Rociadores y Sprinklers": "#0891b2",
  "Mangueras y Accesorios": "#7c3aed",
  "Equipos de Protección Personal": "#16a34a",
  "Iluminación de Emergencia": "#ca8a04",
  "Botiquines y Primeros Auxilios": "#db2777",
  "Otro": "#4b5563",
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: "8px",
  border: "1.5px solid #ddd", fontSize: "0.92rem", outline: "none", boxSizing: "border-box",
};
const labelSt: React.CSSProperties = {
  display: "block", fontSize: "0.75rem", fontWeight: 700,
  textTransform: "uppercase" as const, letterSpacing: "0.4px", marginBottom: "5px", color: "#666",
};

const EMPTY: Omit<Producto, "id" | "createdAt" | "updatedAt"> = {
  titulo: "", descripcion: "", categoria: "", proveedor: "",
  precio: 0, porcentaje: 30, precioVenta: 0, activo: true,
  imagenes: [],
  slug: "",
};

function calcVenta(precio: number, porcentaje: number): number {
  return Math.round(precio * (1 + porcentaje / 100) * 100) / 100;
}

export default function AdminProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroCat, setFiltroCat] = useState("Todas");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "productos"), orderBy("createdAt", "desc")));
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Producto)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userDoc = await getDoc(doc(db, "usuarios", u.uid));
        setRole(userDoc.exists() ? userDoc.data().rol : "cliente");
      }
    });
    fetch();
    return () => unsub();
  }, [fetch]);

  const isAllowed = role === "admin" || role === "tecnico" || role === "superadmin";

  const setField = (field: string, value: any) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === "precio" || field === "porcentaje") {
        updated.precioVenta = calcVenta(
          field === "precio" ? Number(value) : prev.precio,
          field === "porcentaje" ? Number(value) : prev.porcentaje,
        );
      }
      if (field === "titulo" && !editId) {
        updated.slug = value.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
      }
      return updated;
    });
  };

  const openCreate = () => {
    setForm({ ...EMPTY, precioVenta: calcVenta(EMPTY.precio, EMPTY.porcentaje) });
    setEditId(null);
    setImageFiles([]);
    setPreviews([]);
    setModal("create");
  };

  const openEdit = (p: Producto) => {
    setForm({
      titulo: p.titulo, descripcion: p.descripcion, categoria: p.categoria,
      proveedor: p.proveedor, precio: p.precio, porcentaje: p.porcentaje,
      precioVenta: p.precioVenta, activo: p.activo,
      imagenes: p.imagenes || [],
      slug: p.slug || "",
    });
    setEditId(p.id);
    setImageFiles([]);
    setPreviews(p.imagenes || []);
    setModal("edit");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) { alert("El título es obligatorio."); return; }
    setSaving(true);
    try {
      // 1. Upload new files
      const newUrls: string[] = [];
      for (const file of imageFiles) {
        const fileRef = ref(storage, `productos/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(fileRef, file);
        const url = await getDownloadURL(snap.ref);
        newUrls.push(url);
      }

      // 2. Filter existing URLs that were kept
      const keptUrls = previews.filter(p => p.startsWith("http"));
      const finalImages = [...keptUrls, ...newUrls];

      // 3. Clean up deleted images from Storage if editing
      if (editId) {
        const oldProd = productos.find(p => p.id === editId);
        if (oldProd?.imagenes) {
          const removed = oldProd.imagenes.filter(url => !keptUrls.includes(url));
          for (const url of removed) {
            try { await deleteObject(ref(storage, url)); } catch (e) { console.warn("Error deleting removed image", e); }
          }
        }
      }

      const payload = {
        ...form,
        imagenes: finalImages,
        precio: Number(form.precio),
        porcentaje: Number(form.porcentaje),
        precioVenta: calcVenta(Number(form.precio), Number(form.porcentaje)),
        updatedAt: serverTimestamp(),
      };
      
      // Remove legacy 'imagen' field if it exists
      if ("imagen" in payload) delete (payload as any).imagen;

      if (modal === "create") {
        await addDoc(collection(db, "productos"), { ...payload, createdAt: serverTimestamp() });
      } else if (editId) {
        await updateDoc(doc(db, "productos", editId), payload);
      }
      setModal(null);
      setImageFiles([]);
      setPreviews([]);
      await fetch();
    } catch (err) { alert("Error al guardar: " + err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const prod = productos.find(p => p.id === id);
      if (prod?.imagenes && prod.imagenes.length > 0) {
        for (const url of prod.imagenes) {
          try { await deleteObject(ref(storage, url)); } catch (e) { console.warn("Error deleting storage file", e); }
        }
      }
      await deleteDoc(doc(db, "productos", id));
      setDeleteConfirm(null);
      setProductos(prev => prev.filter(p => p.id !== id));
    } catch { alert("Error al eliminar."); }
  };

  const toggleActivo = async (p: Producto) => {
    await updateDoc(doc(db, "productos", p.id), { activo: !p.activo });
    setProductos(prev => prev.map(x => x.id === p.id ? { ...x, activo: !x.activo } : x));
  };

  const visible = productos.filter(p => {
    const matchCat = filtroCat === "Todas" || p.categoria === filtroCat;
    const matchQ = !search || p.titulo.toLowerCase().includes(search.toLowerCase()) || p.proveedor?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });

  const fmtPeso = (n: number) => `$${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading && !role) return <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Cargando catálogo...</div>;
  if (!isAllowed && role) return <div style={{ padding: "60px", textAlign: "center", color: "var(--primary-red)", fontWeight: 700 }}>No tenés permisos para gestionar productos.</div>;

  return (
    <div style={{ width: "100%", position: 'relative' }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Gestión de Productos</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>{visible.length} producto{visible.length !== 1 ? "s" : ""} en catálogo.</p>
        </div>
        <button onClick={openCreate} className="btn-red" style={{ padding: "12px 22px" }}>➕ Nuevo Producto</button>
      </header>

      <div style={{ background: "#fff", borderRadius: "10px", padding: "16px 20px", marginBottom: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", border: "1px solid #eee" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", marginBottom: "12px" }}>
          <input style={{ ...inputSt }} placeholder="🔎 Buscar por título o proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
          <button onClick={() => { setSearch(""); setFiltroCat("Todas"); }}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600 }}>
            🔄 Limpiar
          </button>
        </div>
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {["Todas", ...CATEGORIAS].map(cat => (
            <button key={cat} onClick={() => setFiltroCat(cat)}
              style={{ padding: "5px 12px", borderRadius: "20px", border: `2px solid ${filtroCat === cat ? "var(--primary-blue)" : "#eee"}`, background: filtroCat === cat ? "var(--primary-blue)" : "#fff", color: filtroCat === cat ? "#fff" : "#666", fontWeight: filtroCat === cat ? 800 : 500, fontSize: "0.75rem", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "0.2s" }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
            <thead style={{ background: "#fafafa", borderBottom: "1.5px solid #eee" }}>
              <tr>
                {["Producto / Categoría", "Proveedor", "Costo", "Margen", "Precio Venta", "Estado", "Acciones"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "13px 16px", fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "60px", color: "#bbb" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "10px" }}>⏳</div>Cargando...
                </td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "60px", color: "#bbb" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📦</div>
                  {search || filtroCat !== "Todas" ? "No hay productos que coincidan." : "Catálogo vacío."}
                </td></tr>
              ) : visible.map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafcff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "6px", background: "#f5f5f5", overflow: "hidden", border: "1px solid #eee", flexShrink: 0 }}>
                        {p.imagenes && p.imagenes.length > 0 ? (
                          <img src={p.imagenes[0]} alt={p.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: "#ddd" }}>📦</div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.9rem" }}>{p.titulo}</div>
                        {p.categoria && (
                          <div style={{ 
                            fontSize: "0.65rem", 
                            color: CAT_COLORS[p.categoria] || "#666", 
                            marginTop: "2px", 
                            fontWeight: 800, 
                            textTransform: "uppercase",
                            letterSpacing: "0.3px"
                          }}>
                            {p.categoria}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: "0.85rem", color: "#555" }}>{p.proveedor || "—"}</td>
                  <td style={{ padding: "13px 16px", fontSize: "0.88rem", fontWeight: 600 }}>{fmtPeso(p.precio)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ background: "#f0fdf4", color: "#16a34a", fontSize: "0.75rem", fontWeight: 800, padding: "3px 8px", borderRadius: "20px" }}>{p.porcentaje}%</span>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: "0.92rem", fontWeight: 800, color: "var(--primary-red)" }}>{fmtPeso(p.precioVenta)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <button onClick={() => toggleActivo(p)} style={{ padding: "4px 10px", borderRadius: "20px", border: "none", cursor: "pointer", fontSize: "0.68rem", fontWeight: 900, background: p.activo ? "#dcfce7" : "#fee2e2", color: p.activo ? "#15803d" : "#dc2626" }}>
                      {p.activo ? "✓ Activo" : "✕ Inactivo"}
                    </button>
                  </td>
                  <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(p)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}>✏️</button>
                    <button onClick={() => setDeleteConfirm(p.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", marginLeft: "8px" }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Adjusted to NOT cover the sidebar (z-index 150 < sidebar 200) */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 150, overflowY: "auto", padding: "40px 16px", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "14px", maxWidth: "600px", width: "100%", padding: "32px", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--primary-blue)" }}>
                {modal === "create" ? "Nuevo Producto" : "Editar Producto"}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#aaa" }}>×</button>
            </header>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelSt}>Fotos del Producto</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "12px" }}>
                    {previews.map((src, idx) => (
                      <div key={idx} style={{ position: "relative", width: "100%", aspectRatio: "1", borderRadius: "8px", border: "1px solid #eee", overflow: "hidden", background: "#f8f9fa" }}>
                        <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button type="button" 
                          onClick={() => {
                            const isUrl = src.startsWith("http");
                            if (!isUrl) {
                              const blobIdx = previews.slice(0, idx).filter(p => !p.startsWith("http")).length;
                              setImageFiles(prev => prev.filter((_, i) => i !== blobIdx));
                            }
                            setPreviews(prev => prev.filter((_, i) => i !== idx));
                          }}
                          style={{ position: "absolute", top: "4px", right: "4px", width: "20px", height: "20px", borderRadius: "50%", border: "none", background: "rgba(220, 38, 38, 0.8)", color: "#fff", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          ×
                        </button>
                      </div>
                    ))}
                    <div style={{ width: "100%", aspectRatio: "1", borderRadius: "8px", border: "2px dashed #ccc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", background: "#fafafa" }}>
                      <span style={{ fontSize: "1.2rem", color: "#999" }}>➕</span>
                      <span style={{ fontSize: "0.6rem", fontWeight: 800, color: "#999", textTransform: "uppercase" }}>Añadir</span>
                      <input type="file" multiple accept="image/*" 
                        onChange={e => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            setImageFiles(prev => [...prev, ...files]);
                            setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                          }
                        }}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} 
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: "0.65rem", color: "#888", fontStyle: "italic" }}>Sugerencia: Subí varias fotos. La primera será la principal.</p>
                </div>
                <div style={{ flex: 2 }}>
                  <label style={labelSt}>Título del Producto *</label>
                  <input style={inputSt} value={form.titulo} onChange={e => setField("titulo", e.target.value)} required />
                  <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>
                    Slug: <strong>{form.slug || '—'}</strong>
                  </div>
                </div>
              </div>
              <div>
                <label style={labelSt}>Descripción</label>
                <textarea style={{ ...inputSt, height: "80px", resize: "none" }} value={form.descripcion} onChange={e => setField("descripcion", e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label style={labelSt}>Categoría</label>
                  <select style={{ ...inputSt, background: "#fff" }} value={form.categoria} onChange={e => setField("categoria", e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Proveedor</label>
                  <input style={inputSt} value={form.proveedor} onChange={e => setField("proveedor", e.target.value)} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label style={labelSt}>Precio Costo ($)</label>
                  <input style={inputSt} type="number" step="0.01" value={form.precio || ""} onChange={e => setField("precio", e.target.value)} />
                </div>
                <div>
                  <label style={labelSt}>Margen (%)</label>
                  <input style={inputSt} type="number" step="0.1" value={form.porcentaje || ""} onChange={e => setField("porcentaje", e.target.value)} />
                </div>
              </div>

              <div style={{ background: "#f0fdf4", padding: "20px", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#16a34a", textTransform: "uppercase", marginBottom: "5px" }}>Precio de Venta Sugerido</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#15803d" }}>{fmtPeso(calcVenta(Number(form.precio), Number(form.porcentaje)))}</div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 }}>
                <input type="checkbox" checked={form.activo} onChange={e => setField("activo", e.target.checked)} style={{ width: "18px", height: "18px" }} />
                Producto activo en catálogo
              </label>

              <div style={{ display: "flex", gap: "12px", paddingTop: "20px" }}>
                <button type="button" onClick={() => setModal(null)} className="btn-white" style={{ flex: 1, border: '1px solid #ddd' }}>Cancelar</button>
                <button type="submit" disabled={saving} className="btn-red" style={{ flex: 2 }}>{saving ? "Guardando..." : "Guardar Producto"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "380px", width: "100%", textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>⚠️</div>
            <h3 style={{ fontWeight: 800, marginBottom: "10px" }}>¿Eliminar producto?</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "24px" }}>Esta acción es irreversible.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-red" style={{ flex: 1 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
