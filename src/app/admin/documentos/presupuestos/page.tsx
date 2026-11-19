"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, query, orderBy, where,
  doc, getDoc, deleteDoc, updateDoc, addDoc, serverTimestamp,
} from "@/lib/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generatePresupuestoPDF } from "@/lib/pdfGenerator";
import { Plus, Eye, Edit, Scroll, Trash2, ArrowLeft, Search, ClipboardList, BookText } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/admin/ViewToggle";

interface Presupuesto {
  id: string;
  numero: number;
  fecha: string;
  clienteNombre: string;
  clienteApellido?: string;
  clienteEmpresa?: string;
  clienteId?: string;
  sedeNombre?: string;
  total: number;
  estado: "pendiente" | "aceptado" | "cancelado";
  createdAt: any;
  creadoPorId?: string;
  creadoPorNombre?: string;
}

interface NotaPresupuesto {
  id: string;
  titulo: string;
  contenido: string;
}

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  pendiente:  { bg: "#fffbeb", color: "#b45309" },
  aceptado:   { bg: "#dcfce7", color: "#166534" },
  cancelado:  { bg: "#fee2e2", color: "#991b1b" },
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  aceptado:  "Aceptado",
  cancelado: "Cancelado",
};

const fmt = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useViewMode("presupuestos");
  const [activeTab, setActiveTab] = useState<"listado" | "notas">("listado");
  const [notas, setNotas] = useState<NotaPresupuesto[]>([]);
  const [notaModal, setNotaModal] = useState<null | "create" | "edit">(null);
  const [formNota, setFormNota] = useState({ titulo: "", contenido: "", id: "" });
  const [deletingNota, setDeletingNota] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const r = userData.rol || "cliente";
      if (r === "tecnico") { router.push("/admin"); return; }
      setRole(r);
      setCurrentUser({ uid: u.uid, ...userData });
      await fetchPresupuestos(r, u.uid);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const isStaff = (r: string) => ["admin", "superadmin", "secretaria"].includes(r);
  const isTecnicoTaller = (r: string) => r === "tecnicoTaller";

  const fetchPresupuestos = async (r: string, uid: string) => {
    try {
      let snap;
      const filtro = isStaff(r) ? null : isTecnicoTaller(r) ? "creadoPorId" : "clienteId";
      const baseQuery = filtro
        ? query(collection(db, "presupuestos"), where(filtro, "==", uid), orderBy("createdAt", "desc"))
        : query(collection(db, "presupuestos"), orderBy("createdAt", "desc"));
      try {
        snap = await getDocs(baseQuery);
      } catch {
        snap = await getDocs(
          filtro
            ? query(collection(db, "presupuestos"), where(filtro, "==", uid))
            : collection(db, "presupuestos")
        );
      }
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Presupuesto));
      if (isTecnicoTaller(r)) docs = docs.filter(p => p.creadoPorId === uid);
      else if (!isStaff(r)) docs = docs.filter(p => p.clienteId === uid);
      docs.sort((a, b) => {
        const ts = (o: any) => o.createdAt?.seconds ?? 0;
        return ts(b) - ts(a);
      });
      setPresupuestos(docs);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDoc(doc(db, "presupuestos", deleteConfirm));
      setPresupuestos(prev => prev.filter(p => p.id !== deleteConfirm));
    } catch { alert("Error al eliminar."); }
    finally { setDeleteConfirm(null); }
  };

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const snap = await getDoc(doc(db, "presupuestos", id));
      if (!snap.exists()) { alert("Presupuesto no encontrado."); return; }
      await generatePresupuestoPDF({ id: snap.id, ...snap.data() });
    } catch (e) { console.error(e); alert("Error al generar el PDF."); }
    finally { setDownloadingId(null); }
  };

  const handleEstadoChange = async (id: string, nuevoEstado: string) => {
    try {
      await updateDoc(doc(db, "presupuestos", id), { estado: nuevoEstado, updatedAt: serverTimestamp() });
      setPresupuestos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado as any } : p));
    } catch { alert("Error al actualizar estado."); }
  };

  const fetchNotas = async () => {
    try {
      const snap = await getDocs(query(collection(db, "notas_presupuesto"), orderBy("createdAt", "asc")));
      setNotas(snap.docs.map(d => ({ id: d.id, ...d.data() } as NotaPresupuesto)));
    } catch (e) { console.error(e); setNotas([]); }
  };

  const handleSaveNota = async () => {
    if (!formNota.titulo.trim() || !formNota.contenido.trim()) { alert("Completá el nombre y el texto de la nota."); return; }
    try {
      const data = { titulo: formNota.titulo.trim(), contenido: formNota.contenido.trim(), updatedAt: serverTimestamp() };
      if (formNota.id) {
        await updateDoc(doc(db, "notas_presupuesto", formNota.id), data);
      } else {
        await addDoc(collection(db, "notas_presupuesto"), { ...data, createdAt: serverTimestamp() });
      }
      setNotaModal(null);
      setFormNota({ titulo: "", contenido: "", id: "" });
      fetchNotas();
    } catch (e) { console.error(e); alert("Error al guardar la nota."); }
  };

  const handleDeleteNota = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notas_presupuesto", id));
      setNotas(prev => prev.filter(n => n.id !== id));
    } catch (e) { console.error(e); alert("Error al eliminar la nota."); }
    finally { setDeletingNota(null); }
  };

  const filtered = presupuestos.filter(p => {
    const q = search.toLowerCase();
    const matchSearch =
      String(p.numero).includes(q) ||
      p.clienteNombre?.toLowerCase().includes(q) ||
      p.clienteEmpresa?.toLowerCase().includes(q) ||
      (p.clienteApellido || "").toLowerCase().includes(q);
    const matchEstado = filtroEstado === "todos" || p.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const isReadOnly = role === "cliente";
  const isAdmin = role === "admin" || role === "superadmin";
  const canEditNotas = isAdmin || role === "secretaria";

  if (loading) return (
    <div style={{ padding: "100px", textAlign: "center", color: "var(--text-muted)" }}>Cargando presupuestos...</div>
  );

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* HEADER */}
      <header style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <button
            onClick={() => router.push("/admin/documentos")}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#888", fontWeight: 600, cursor: "pointer", marginBottom: "8px", padding: 0, fontSize: "0.85rem" }}
          >
            <ArrowLeft size={16} /> Documentos
          </button>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>
            {isReadOnly ? "Mis Presupuestos" : "Presupuestos"}
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>
            {activeTab === "listado"
              ? "Cotizaciones para clientes."
              : "Notas listas para pegar en los presupuestos (condiciones comerciales, forma de pago, etc.)."}
          </p>
        </div>
        {!isReadOnly && activeTab === "listado" && (
          <Link
            href="/admin/documentos/presupuestos/nuevo"
            className="btn-red"
            style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px", textTransform: "uppercase", fontSize: "0.8rem", textDecoration: "none" }}
          >
            <Plus size={18} strokeWidth={3} /> Nuevo Presupuesto
          </Link>
        )}
        {canEditNotas && activeTab === "notas" && (
          <button
            onClick={() => { setFormNota({ titulo: "", contenido: "", id: "" }); setNotaModal("create"); }}
            className="btn-red"
            style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px", textTransform: "uppercase", fontSize: "0.8rem", border: "none", cursor: "pointer" }}
          >
            <Plus size={18} strokeWidth={3} /> Nueva Nota
          </button>
        )}
      </header>

      {canEditNotas && (
        <div style={{ display: "flex", gap: "8px", background: "#f1f5f9", padding: "6px", borderRadius: "14px", marginBottom: "24px", width: "fit-content", flexWrap: "wrap" }}>
          <button type="button"
            onClick={() => setActiveTab("listado")}
            style={{ padding: "10px 18px", borderRadius: "10px", border: "1.5px solid", borderColor: activeTab === "listado" ? "#3b82f6" : "#bfdbfe", background: activeTab === "listado" ? "#fff" : "#eff6ff", fontWeight: 800, color: "#3b82f6", cursor: "pointer", boxShadow: activeTab === "listado" ? "0 4px 12px rgba(59,130,246,0.15)" : "none", display: "flex", alignItems: "center", gap: "8px" }}>
            <ClipboardList size={18} strokeWidth={2.5} /> Listado
          </button>
          <button type="button"
            onClick={() => { setActiveTab("notas"); fetchNotas(); }}
            style={{ padding: "10px 18px", borderRadius: "10px", border: "1.5px solid", borderColor: activeTab === "notas" ? "#16a34a" : "#bbf7d0", background: activeTab === "notas" ? "#fff" : "#f0fdf4", fontWeight: 800, color: "#16a34a", cursor: "pointer", boxShadow: activeTab === "notas" ? "0 4px 12px rgba(22,163,74,0.15)" : "none", display: "flex", alignItems: "center", gap: "8px" }}>
            <BookText size={18} strokeWidth={2.5} /> Notas estándar
          </button>
        </div>
      )}

      {activeTab === "notas" && (
        <div style={{ marginBottom: "20px" }}>
          {notas.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: "12px", padding: "60px", textAlign: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: "3rem", marginBottom: "12px", opacity: 0.3 }}>📝</div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                No hay notas creadas aún. Usá &quot;+ Nueva Nota&quot; para cargar, por ejemplo, las condiciones de Mantenimiento de extintores, Proyectos u Obras de extinción.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
              {notas.map(n => (
                <div key={n.id} style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", border: "1px solid #eee" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <span style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "0.95rem" }}>{n.titulo}</span>
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0, marginLeft: "10px" }}>
                      <button type="button" title="Editar" onClick={() => { setFormNota({ titulo: n.titulo, contenido: n.contenido, id: n.id }); setNotaModal("edit"); }} style={{ padding: "5px 7px", borderRadius: "6px", border: "1px solid #ddd", background: "#f0f7ff", color: "#0061ff", cursor: "pointer", display: "flex" }}>
                        <Edit size={14} />
                      </button>
                      <button type="button" title="Eliminar" onClick={() => setDeletingNota(n.id)} style={{ padding: "5px 7px", borderRadius: "6px", border: "1px solid #ffddd9", background: "#fff5f4", color: "var(--primary-red)", cursor: "pointer", display: "flex" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "#666", lineHeight: "1.6", margin: 0, whiteSpace: "pre-wrap", maxHeight: "100px", overflow: "hidden" }}>
                    {n.contenido}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {notaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "600px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "20px", color: "var(--primary-blue)" }}>
              {notaModal === "create" ? "Nueva nota estándar" : "Editar nota"}
            </h3>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase" }}>Nombre (lo que se ve en el botón)</label>
              <input value={formNota.titulo} onChange={e => setFormNota(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Mantenimiento de extintores" style={{ width: "100%", padding: "10px 13px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.92rem", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase" }}>Texto de la nota</label>
              <textarea value={formNota.contenido} onChange={e => setFormNota(f => ({ ...f, contenido: e.target.value }))} rows={10}
                placeholder={"Ej:\nFORMA DE PAGO: 50% de anticipo, saldo contra entrega.\nPLAZO DE ENTREGA: 5 días hábiles.\nLos precios no incluyen IVA."}
                style={{ width: "100%", padding: "10px 13px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.88rem", resize: "vertical", fontFamily: "inherit", lineHeight: "1.6", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={() => { setNotaModal(null); setFormNota({ titulo: "", contenido: "", id: "" }); }} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button type="button" onClick={handleSaveNota} className="btn-red" style={{ flex: 1, padding: "12px" }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {deletingNota && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar nota?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.9rem" }}>Los presupuestos ya hechos con esta nota no cambian.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={() => setDeletingNota(null)} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button type="button" onClick={() => handleDeleteNota(deletingNota)} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "listado" && (<>
      {/* FILTROS */}
      <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
        <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>
            Buscar
          </label>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
            <input
              type="text"
              placeholder="N°, cliente o empresa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 14px 10px 34px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.9rem" }}
            />
          </div>
        </div>
        <div style={{ width: "180px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>
            Estado
          </label>
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.85rem", background: "#fff" }}
          >
            <option value="todos">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="aceptado">Aceptado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <button
          onClick={() => { setSearch(""); setFiltroEstado("todos"); }}
          style={{ padding: "10px 15px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#666" }}
        >
          Limpiar
        </button>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {/* LISTADO */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#999" }}>
            {presupuestos.length === 0 ? "Aún no hay presupuestos cargados." : "No se encontraron resultados."}
          </div>
        ) : viewMode === "card" ? (
          <div className="doc-card-grid">
            {filtered.map(p => {
              const ec = ESTADO_COLORS[p.estado] || ESTADO_COLORS.pendiente;
              return (
                <div key={p.id} className="doc-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <div style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "1rem" }}>
                      P-{String(p.numero || "?").padStart(5, "0")}
                    </div>
                    <span style={{ fontSize: "0.68rem", padding: "3px 9px", borderRadius: "10px", fontWeight: 900, textTransform: "uppercase", background: ec.bg, color: ec.color }}>
                      {ESTADO_LABELS[p.estado] || p.estado}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#999", marginBottom: "10px" }}>
                    {p.fecha ? new Date(p.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-"}
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                      {p.clienteNombre}{p.clienteApellido ? ` ${p.clienteApellido}` : ""}
                    </div>
                    {p.clienteEmpresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{p.clienteEmpresa}</div>}
                    {p.sedeNombre && <div style={{ fontSize: "0.75rem", color: "var(--primary-blue)", fontWeight: 600 }}>📍 {p.sedeNombre}</div>}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "12px" }}>$ {fmt(p.total || 0)}</div>
                  <div style={{ display: "flex", gap: "8px", borderTop: "1px solid #f0f0f0", paddingTop: "12px" }}>
                    <Link title="Ver Vista Previa" href={`/admin/documentos/presupuestos/${p.id}`}
                      style={{ flex: 1, padding: "9px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                      <Eye size={18} strokeWidth={2.5} />
                    </Link>
                    {!isReadOnly && (
                      <Link title="Editar" href={`/admin/documentos/presupuestos/nuevo?edit=${p.id}`}
                        style={{ flex: 1, padding: "9px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                        <Edit size={18} strokeWidth={2.5} />
                      </Link>
                    )}
                    <button title="Descargar PDF" onClick={() => handleDownload(p.id)} disabled={downloadingId === p.id}
                      style={{ flex: 1, padding: "9px", borderRadius: "8px", background: "#f5f3ff", color: "#7c3aed", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: downloadingId === p.id ? 0.5 : 1 }}>
                      <Scroll size={18} strokeWidth={2.5} />
                    </button>
                    {isAdmin && (
                      <button title="Eliminar" onClick={() => setDeleteConfirm(p.id)}
                        style={{ width: "38px", borderRadius: "8px", border: "none", background: "#fef2f2", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={18} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
              <thead>
                <tr style={{ background: "#f8f9fc", borderBottom: "2px solid #eef0f3" }}>
                  {["N° PRES.", "FECHA", "CLIENTE / EMPRESA", "TOTAL", "ESTADO", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const ec = ESTADO_COLORS[p.estado] || ESTADO_COLORS.pendiente;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f2f5f9" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: "var(--primary-blue)", whiteSpace: "nowrap" }}>
                        P-{String(p.numero || "?").padStart(5, "0")}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                        {p.fecha ? new Date(p.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                          {p.clienteNombre}{p.clienteApellido ? ` ${p.clienteApellido}` : ""}
                        </div>
                        {p.clienteEmpresa && (
                          <div style={{ fontSize: "0.75rem", color: "#888" }}>{p.clienteEmpresa}</div>
                        )}
                        {p.sedeNombre && (
                          <div style={{ fontSize: "0.7rem", color: "#aaa" }}>Sede: {p.sedeNombre}</div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: "0.9rem", whiteSpace: "nowrap" }}>
                        $ {fmt(p.total || 0)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {!isReadOnly ? (
                          <select
                            value={p.estado}
                            onChange={e => handleEstadoChange(p.id, e.target.value)}
                            style={{
                              fontSize: "0.72rem", padding: "4px 8px", borderRadius: "10px",
                              fontWeight: 900, textTransform: "uppercase", border: "1.5px solid",
                              borderColor: ec.color, background: ec.bg, color: ec.color, cursor: "pointer",
                            }}
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="aceptado">Aceptado</option>
                            <option value="cancelado">Cancelado</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: "0.72rem", padding: "4px 8px", borderRadius: "10px", fontWeight: 900, textTransform: "uppercase", background: ec.bg, color: ec.color }}>
                            {ESTADO_LABELS[p.estado] || p.estado}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <Link
                            title="Ver Vista Previa"
                            href={`/admin/documentos/presupuestos/${p.id}`}
                            style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                          >
                            <Eye size={18} strokeWidth={2.5} />
                          </Link>
                          {!isReadOnly && (
                            <Link
                              title="Editar"
                              href={`/admin/documentos/presupuestos/nuevo?edit=${p.id}`}
                              style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                            >
                              <Edit size={18} strokeWidth={2.5} />
                            </Link>
                          )}
                          <button
                            title="Descargar PDF"
                            onClick={() => handleDownload(p.id)}
                            disabled={downloadingId === p.id}
                            style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", opacity: downloadingId === p.id ? 0.5 : 1 }}
                          >
                            <Scroll size={18} strokeWidth={2.5} />
                          </button>
                          {isAdmin && (
                            <button
                              title="Eliminar"
                              onClick={() => setDeleteConfirm(p.id)}
                              style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", background: "#fef2f2", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
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
        )}
      </div>
      </>)}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%", textAlign: "center" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar este presupuesto?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={handleDelete} className="btn-red" style={{ flex: 1, padding: "12px" }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
