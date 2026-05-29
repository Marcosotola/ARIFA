"use client";
import { useEffect, useState, useRef } from "react";
import { useToast, Toast } from "@/components/Toast";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, getDoc, where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

import {
  Plus,
  Edit,
  Trash2,
  Eye,
  FileText,
  Camera,
  Calendar,
  Building2,
  MapPin,
  X,
  Search,
  CheckCircle2,
  Clock,
  Images,
  Download,
  ExternalLink,
  File,
  Info
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type TipoDoc = "Visita" | "Capacitación" | "ATS" | "Programa de Seguridad" | "RGRL" | "RAR" | "Plan de Capacitación Anual" | "Medición de Contaminantes" | "Plan de acción" | "Expediente CIEC" | "Expediente Bomberos";
const TIPOS: TipoDoc[] = ["Visita", "Capacitación", "ATS", "Programa de Seguridad", "RGRL", "RAR", "Plan de Capacitación Anual", "Medición de Contaminantes", "Plan de acción", "Expediente CIEC", "Expediente Bomberos"];

interface HySDoc {
  id: string;
  cliente: string;
  clienteId?: string;
  sedeId?: string;
  sedeNombre?: string;
  sedeRazonSocial?: string;
  fecha: string;
  tipo: TipoDoc[];
  descripcion?: string;
  imagenes: string[];
  creadoPor?: string;
  createdAt?: any;
  updatedAt?: any;
  fechaVencimiento?: string;
  subtipoMedicion?: string;
  clienteDniCuit?: string;
  clienteTelefono?: string;
  clienteDireccion?: string;
  capacitaciones?: { tema: string, fechaPlanificada: string, cargada: boolean, archivo?: string }[];
  nroExpediente?: string;
  fechaEntrega?: string;
  fechaInspeccion?: string;
  fechaEntregaAnexos?: string;
}

const inputSt: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: "8px", border: "1.5px solid #ddd", fontSize: "0.92rem", outline: "none", boxSizing: "border-box" };
const labelSt: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#555", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.4px" };

const TIPO_COLORS: Record<TipoDoc, { bg: string; color: string; dot: string }> = {
  "Visita":              { bg: "#e0f2fe", color: "#0369a1", dot: "#0ea5e9" },
  "Capacitación":        { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e" },
  "ATS":                 { bg: "#fef9c3", color: "#854d0e", dot: "#eab308" },
  "Programa de Seguridad":{ bg: "#fdf2f8", color: "#86198f", dot: "#d946ef" },
  "RGRL":                { bg: "#ede9fe", color: "#5b21b6", dot: "#8b5cf6" },
  "RAR":                 { bg: "#ffedd5", color: "#9a3412", dot: "#f97316" },
  "Plan de Capacitación Anual": { bg: "#dcfce7", color: "#166534", dot: "#22c55e" },
  "Medición de Contaminantes": { bg: "#f1f5f9", color: "#334155", dot: "#64748b" },
  "Plan de acción":      { bg: "#fee2e2", color: "#991b1b", dot: "#ef4444" },
  "Expediente CIEC":     { bg: "#ccfbf1", color: "#0f766e", dot: "#14b8a6" },
  "Expediente Bomberos": { bg: "#ffe4e6", color: "#be123c", dot: "#f43f5e" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const isPdf = (url: string): boolean => {
  try {
    return decodeURIComponent(url.split('?')[0]).toLowerCase().endsWith('.pdf');
  } catch { return false; }
};

const getFileName = (url: string): string => {
  try {
    const encoded = url.split('/o/')[1]?.split('?')[0] || '';
    return decodeURIComponent(encoded).split('/').pop() || 'archivo';
  } catch { return 'archivo'; }
};

const downloadFile = async (url: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = getFileName(url);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch { alert("Error al descargar el archivo."); }
};

export default function HySPage() {
  const [docs, setDocs] = useState<HySDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<HySDoc | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [galleryDoc, setGalleryDoc] = useState<HySDoc | null>(null);
  const [detailDoc, setDetailDoc] = useState<HySDoc | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast, showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filtroTipo, setFiltroTipo] = useState<TipoDoc | "Todos">("Todos");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroSede, setFiltroSede] = useState("Todas");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");

  // Form
  const [usuarios, setUsuarios] = useState<{id: string, nombre: string, apellido: string, email: string, empresa?: string, sedes?: any[]}[]>([]);
  const [fCliente, setFCliente] = useState("");
  const [fClienteId, setFClienteId] = useState("");
  const [fSedeId, setFSedeId] = useState("");
  const [fSedeNombre, setFSedeNombre] = useState("");
  const [fSedeRazonSocial, setFSedeRazonSocial] = useState("");
  const [fFecha, setFFecha] = useState(new Date().toISOString().split("T")[0]);
  const [fTipos, setFTipos] = useState<TipoDoc[]>([]);
  const [fDescripcion, setFDescripcion] = useState("");
  const [fImagenes, setFImagenes] = useState<string[]>([]);
  const [fFechaVencimiento, setFFechaVencimiento] = useState("");
  const [fSubtipoMedicion, setFSubtipoMedicion] = useState("");
  const [fCapacitaciones, setFCapacitaciones] = useState<{ tema: string, fechaPlanificada: string, cargada: boolean, archivo?: string }[]>([]);
  const [fNroExpediente, setFNroExpediente] = useState("");
  const [fFechaEntrega, setFFechaEntrega] = useState("");
  const [fFechaInspeccion, setFFechaInspeccion] = useState("");
  const [fFechaEntregaAnexos, setFFechaEntregaAnexos] = useState("");

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
  const [fDniCuit, setFDniCuit] = useState("");
  const [fTelefono, setFTelefono] = useState("");
  const [fDireccion, setFDireccion] = useState("");

  const [filteredSedes, setFilteredSedes] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      const snap = await getDoc(doc(db, "usuarios", u.uid));
      const userData = snap.exists() ? snap.data() : {};
      const r = userData.rol || "cliente";
      setRole(r);
      setCurrentUser({ uid: u.uid, ...userData });
      await fetchDocs(r, userData, u.uid);
      if (r !== "cliente") await fetchUsuarios();
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

  const fetchDocs = async (r?: string, userData?: any, uid: string = "") => {
    setLoading(true);
    try {
      const isStaff = ["admin", "superadmin", "tecnico", "tecnicoHyS"].includes(r || "");
      const q = isStaff
        ? query(collection(db, "hys_documentos"), orderBy("createdAt", "desc"))
        : query(collection(db, "hys_documentos"), where("clienteId", "==", uid), orderBy("createdAt", "desc"));

      let snap;
      try {
        snap = await getDocs(q);
      } catch (e) {
        const qFallback = isStaff
          ? query(collection(db, "hys_documentos"))
          : query(collection(db, "hys_documentos"), where("clienteId", "==", uid));
        snap = await getDocs(qFallback);
      }
      let all = snap.docs.map(d => {
        const data = d.data();
        const tipoArr = Array.isArray(data.tipo) ? data.tipo : (data.tipo ? [data.tipo] : []);
        return { id: d.id, ...data, tipo: tipoArr } as HySDoc;
      });
      if (r === "cliente" && userData) {
        const uid = userData.uid;
        const emp = userData.empresa?.toLowerCase() || "";
        const nom = userData.nombre?.toLowerCase() || "";
        if (!uid && !emp && !nom) {
          all = [];
        } else {
          all = all.filter(d =>
            d.clienteId === uid ||
            (emp && d.cliente?.toLowerCase().includes(emp)) ||
            (nom && d.cliente?.toLowerCase().includes(nom))
          );
        }
      }
      setDocs(all);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setFCliente(""); setFClienteId(""); setFSedeId(""); setFSedeNombre(""); setFSedeRazonSocial(""); setFFecha(new Date().toISOString().split("T")[0]);
    setFDniCuit(""); setFTelefono(""); setFDireccion("");
    setFTipos([]); setFDescripcion(""); setFImagenes([]); setFilteredSedes([]);
    setFFechaVencimiento(""); setFSubtipoMedicion(""); setFCapacitaciones([]);
    setFNroExpediente(""); setFFechaEntrega(""); setFFechaInspeccion(""); setFFechaEntregaAnexos("");
    setSelectedDoc(null); setModal("create");
    setShowSuggestions(false);
  };

  const openEdit = (d: HySDoc) => {
    setFCliente(d.cliente); setFClienteId(d.clienteId || ""); setFFecha(d.fecha);
    setFTipos(d.tipo || []); setFDescripcion(d.descripcion || ""); setFImagenes([...d.imagenes]);
    setFSedeId(d.sedeId || ""); setFSedeNombre(d.sedeNombre || ""); setFSedeRazonSocial(d.sedeRazonSocial || "");
    setFDniCuit(d.clienteDniCuit || ""); setFTelefono(d.clienteTelefono || ""); setFDireccion(d.clienteDireccion || "");
    setFFechaVencimiento(d.fechaVencimiento || ""); setFSubtipoMedicion(d.subtipoMedicion || "");
    setFCapacitaciones(d.capacitaciones || []);
    setFNroExpediente(d.nroExpediente || ""); setFFechaEntrega(d.fechaEntrega || "");
    setFFechaInspeccion(d.fechaInspeccion || ""); setFFechaEntregaAnexos(d.fechaEntregaAnexos || "");
    const u = usuarios.find(x => x.id === d.clienteId);
    setFilteredSedes(u?.sedes || []);
    setSelectedDoc(d); setModal("edit");
    setShowSuggestions(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    } catch { showToast("Error al subir el archivo. Intentá de nuevo.", "error"); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImagen = (idx: number) => setFImagenes(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!fCliente.trim()) { showToast("El campo cliente es obligatorio.", "error"); return; }
    if (!fFecha) { showToast("La fecha es obligatoria.", "error"); return; }
    setSaving(true);
    try {
      const hasExpediente = fTipos.includes("Expediente CIEC") || fTipos.includes("Expediente Bomberos");
      const payload: any = {
        cliente: fCliente.trim(),
        clienteId: fClienteId || null,
        clienteDniCuit: fDniCuit,
        clienteTelefono: fTelefono,
        clienteDireccion: fDireccion,
        sedeId: fSedeId || null,
        sedeNombre: fSedeNombre || "",
        sedeRazonSocial: fSedeRazonSocial || "",
        fecha: fFecha,
        tipo: fTipos,
        descripcion: fDescripcion.trim(),
        imagenes: fImagenes,
        fechaVencimiento: fFechaVencimiento || null,
        subtipoMedicion: fSubtipoMedicion || "",
        capacitaciones: fCapacitaciones || [],
        nroExpediente: hasExpediente ? fNroExpediente : "",
        fechaEntrega: hasExpediente ? (fFechaEntrega || null) : null,
        fechaInspeccion: hasExpediente ? (fFechaInspeccion || null) : null,
        fechaEntregaAnexos: hasExpediente ? (fFechaEntregaAnexos || null) : null,
        updatedAt: serverTimestamp(),
      };
      if (modal === "create") {
        payload.creadoPor = auth.currentUser?.email || "";
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "hys_documentos"), payload);
      } else if (modal === "edit" && selectedDoc) {
        await updateDoc(doc(db, "hys_documentos", selectedDoc.id), payload);
      }

      if (fClienteId) {
        await updateDoc(doc(db, "usuarios", fClienteId), {
          nombre: fCliente,
          dniCuit: fDniCuit,
          telefono: fTelefono,
          direccion: fDireccion,
          updatedAt: serverTimestamp()
        }).catch(err => console.error("Error updating client profile:", err));
      }

      setModal(null);
      await fetchDocs(role as string, currentUser);
      showToast("Documento guardado correctamente", "success");
    } catch (e) { showToast("Error al guardar. Intentá de nuevo.", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const docSnap = await getDoc(doc(db, "hys_documentos", id));
      if (docSnap.exists()) {
        const imagenes: string[] = docSnap.data().imagenes || [];
        for (const url of imagenes) {
          try { await deleteObject(ref(storage, url)); } catch {}
        }
      }
      await deleteDoc(doc(db, "hys_documentos", id));
      setDeleteConfirm(null);
      setDocs(prev => prev.filter(d => d.id !== id));
    } catch { showToast("Error al eliminar. Intentá de nuevo.", "error"); }
  };

  const onSelectCliente = (u: any) => {
    setFClienteId(u.id);
    setFCliente(u.nombre || u.razonSocial || "");
    setFDniCuit(u.dniCuit || u.cuit || "");
    setFTelefono(u.telefono || u.celular || "");
    setFDireccion(u.direccion || u.domicilio || "");
    setFilteredSedes(u.sedes || []);
    setFSedeId(""); setFSedeNombre(""); setFSedeRazonSocial("");
    setShowSuggestions(false);
  };

  const handleCreateNewClient = async () => {
    if (!newClientData.nombre || !newClientData.email) { showToast("Nombre y Email son obligatorios.", "error"); return; }
    try {
      const docRef = await addDoc(collection(db, "usuarios"), {
        ...newClientData,
        rol: "cliente",
        createdAt: serverTimestamp()
      });
      const newC = { id: docRef.id, ...newClientData, rol: "cliente" };
      setUsuarios([...usuarios, newC]);
      onSelectCliente(newC);
      setShowNewClientModal(false);
      setNewClientData({ nombre: "", apellido: "", email: "", empresa: "", dniCuit: "", telefono: "", direccion: "", sedes: [] });
    } catch (e) {
      showToast("Error al crear cliente. Intentá de nuevo.", "error");
    }
  };

  // ── Filters ──────────────────────────────────────────────────────────────────
  const filtered = docs.filter(d => {
    if (filtroTipo !== "Todos" && !d.tipo.includes(filtroTipo)) return false;
    if (filtroCliente && !d.cliente.toLowerCase().includes(filtroCliente.toLowerCase())) return false;
    if (filtroSede !== "Todas" && d.sedeNombre !== filtroSede) return false;
    if (filtroFechaDesde && d.fecha < filtroFechaDesde) return false;
    if (filtroFechaHasta && d.fecha > filtroFechaHasta) return false;
    return true;
  });

  const fmtFecha = (s: string) => {
    try { return new Date(s + "T12:00:00").toLocaleDateString("es-AR"); } catch { return s; }
  };

  const isReadOnly = role === "cliente";
  const isAdmin = role === "admin" || role === "superadmin" || role === "tecnicoHyS";
  const sedesDisponibles = (isReadOnly && currentUser?.sedes
    ? currentUser.sedes.map((s: any) => s.nombre)
    : Array.from(new Set(docs.map(d => d.sedeNombre).filter(Boolean)))) as string[];

  // Thumbnail para tabla: imagen o ícono PDF
  const FileThumbnail = ({ url, size = 44 }: { url: string; size?: number }) => {
    if (isPdf(url)) {
      return (
        <div style={{ width: size, height: size, borderRadius: "6px", background: "#fef2f2", border: "2px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
          <File size={size * 0.45} color="#ef4444" />
        </div>
      );
    }
    return (
      <div style={{ width: size, height: size, borderRadius: "6px", overflow: "hidden", cursor: "pointer", border: "2px solid #eee", flexShrink: 0 }}>
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  };

  return (
    <div style={{ maxWidth: "1350px", margin: "0 auto" }}>
      {/* ── Header ── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>
            HyS
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
            {isReadOnly ? "Higiene y Seguridad de tus instalaciones." : "Gestión de documentos de Higiene y Seguridad."}
          </p>
        </div>
        {!isReadOnly && (
          <button onClick={openCreate} className="btn-red" style={{ padding: "12px 22px", display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} strokeWidth={3} /> Nuevo Documento
          </button>
        )}
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
          {!isReadOnly && (
            <div>
              <label style={labelSt}>Cliente</label>
              <input style={inputSt} value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} placeholder="Filtrar por cliente..." />
            </div>
          )}
          <div>
            <label style={labelSt}>Sede / Obra</label>
            <select style={{ ...inputSt, background: "#fff" }} value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
              <option value="Todas">Todas</option>
              {sedesDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
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
            <button onClick={() => { setFiltroTipo("Todos"); setFiltroCliente(""); setFiltroSede("Todas"); setFiltroFechaDesde(""); setFiltroFechaHasta(""); }} style={{ padding: "10px 18px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", color: "#666" }}>
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        {TIPOS.map(t => {
          const count = docs.filter(d => d.tipo.includes(t)).length;
          const { color, dot } = TIPO_COLORS[t];
          return (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: 700, color: "#666" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: dot }} />
              {t}: <span style={{ color }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* ── Table / Cards View ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "60px", textAlign: "center", color: "#bbb", border: "1px dashed #ddd" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📂</div>
          <div style={{ fontWeight: 700 }}>No hay documentos que coincidan con los filtros.</div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hide-on-mobile" style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", overflow: "hidden", border: "1px solid #eee", marginBottom: "20px" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                <thead style={{ background: "#fafafa", borderBottom: "1.5px solid #eee" }}>
                  <tr>
                    {["Fecha", "Cliente / Sede", "Tipo", "Descripción", "Archivos", "Acciones"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: "0.72rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    return (
                      <tr key={d.id} style={{ borderBottom: "1px solid #f5f5f5" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#fafcff")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                        <td style={{ padding: "14px 18px", whiteSpace: "nowrap", fontSize: "0.88rem", fontWeight: 600 }}>{fmtFecha(d.fecha)}</td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.92rem" }}>{d.cliente}</div>
                          {d.sedeNombre && <div style={{ fontSize: "0.75rem", color: "var(--primary-red)", fontWeight: 700 }}>🏢 {d.sedeNombre}</div>}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {d.tipo.map(t => {
                              const colors = TIPO_COLORS[t] || { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" };
                              const { bg, color, dot } = colors;
                              return (
                                <span key={t} style={{ background: bg, color, fontSize: "0.72rem", fontWeight: 800, padding: "4px 11px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                  {t}
                                </span>
                              );
                            })}
                          </div>
                          {d.fechaVencimiento && (
                            <div style={{ marginTop: '5px', fontSize: '0.72rem', color: '#c62828', fontWeight: 800 }}>
                              📅 Venc: {fmtFecha(d.fechaVencimiento)}
                            </div>
                          )}
                          {d.subtipoMedicion && (
                            <div style={{ fontSize: '0.72rem', color: '#666', fontWeight: 600 }}>
                              🔬 Med: {d.subtipoMedicion}
                            </div>
                          )}
                          {d.nroExpediente && (
                            <div style={{ fontSize: '0.72rem', color: '#0f766e', fontWeight: 700 }}>
                              📋 Exp: {d.nroExpediente}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "14px 18px", fontSize: "0.85rem", color: "#555", maxWidth: "250px" }}>
                          {d.descripcion ? (
                            <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}>{d.descripcion}</span>
                          ) : <span style={{ color: "#ccc" }}>—</span>}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          {d.imagenes.length > 0 ? (
                            <div style={{ display: "flex", gap: "6px", flexWrap: "nowrap", alignItems: "center" }}>
                              {d.imagenes.slice(0, 3).map((url, i) => (
                                <div key={i} onClick={() => isPdf(url) ? setGalleryDoc(d) : setLightbox(url)}>
                                  <FileThumbnail url={url} size={44} />
                                </div>
                              ))}
                              {d.imagenes.length > 3 && (
                                <div onClick={() => setGalleryDoc(d)}
                                  style={{ width: "44px", height: "44px", borderRadius: "6px", background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.72rem", fontWeight: 800, color: "var(--primary-blue)", flexShrink: 0 }}>
                                  +{d.imagenes.length - 3}
                                </div>
                              )}
                            </div>
                          ) : <span style={{ color: "#ccc", fontSize: "0.82rem" }}>Sin archivos</span>}
                        </td>
                        <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setDetailDoc(d)}
                              style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f4ff", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", border: 'none', cursor: 'pointer' }} title="Ver detalles">
                              <Info size={18} strokeWidth={2.5} />
                            </button>
                            {d.imagenes.length > 0 && (
                              <button onClick={() => setGalleryDoc(d)}
                                style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", border: 'none', cursor: 'pointer' }} title="Ver archivos">
                                <Eye size={18} strokeWidth={2.5} />
                              </button>
                            )}
                            {!isReadOnly && (
                              <button onClick={() => openEdit(d)}
                                style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", border: 'none', cursor: 'pointer' }} title="Editar">
                                <Edit size={18} strokeWidth={2.5} />
                              </button>
                            )}
                            {isAdmin && !isReadOnly && (
                              <button onClick={() => setDeleteConfirm(d.id)}
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
          </div>

          {/* Mobile Cards */}
          <div className="show-on-mobile" style={{ display: "none", flexDirection: "column", gap: "12px" }}>
            {filtered.map(d => {
              return (
                <div key={d.id} style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#999", fontWeight: 600, marginBottom: "2px" }}>{fmtFecha(d.fecha)}</div>
                      <div style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "1rem" }}>{d.cliente}</div>
                      {d.sedeNombre && <div style={{ fontSize: "0.8rem", color: "var(--primary-red)", fontWeight: 700 }}>🏢 {d.sedeNombre}</div>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                      {d.tipo.map(t => {
                        const colors = TIPO_COLORS[t] || { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" };
                        const { bg, color, dot } = colors;
                        return (
                          <span key={t} style={{ background: bg, color, fontSize: "0.65rem", fontWeight: 900, padding: "4px 10px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "4px", textTransform: "uppercase" }}>
                            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: dot }} />
                            {t}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    {d.fechaVencimiento && (
                      <div style={{ fontSize: '0.75rem', color: '#c62828', fontWeight: 800 }}>
                        📅 Venc: {fmtFecha(d.fechaVencimiento)}
                      </div>
                    )}
                    {d.subtipoMedicion && (
                      <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: 700 }}>
                        🔬 Med: {d.subtipoMedicion}
                      </div>
                    )}
                    {d.nroExpediente && (
                      <div style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 700 }}>
                        📋 Exp: {d.nroExpediente}
                      </div>
                    )}
                  </div>

                  {d.descripcion && (
                    <p style={{ fontSize: "0.85rem", color: "#555", margin: "10px 0", lineHeight: "1.4" }}>{d.descripcion}</p>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "12px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {d.imagenes.slice(0, 4).map((url, i) => (
                        <div key={i} onClick={() => isPdf(url) ? setGalleryDoc(d) : setLightbox(url)}>
                          <FileThumbnail url={url} size={38} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => setDetailDoc(d)} style={{ background: "#f0f4ff", border: "none", padding: "8px", borderRadius: "8px", cursor: "pointer", color: "#6366f1" }}>
                        <Info size={18} />
                      </button>
                      {d.imagenes.length > 0 && (
                        <button onClick={() => setGalleryDoc(d)} style={{ background: "#f0fdf4", border: "none", padding: "8px", borderRadius: "8px", cursor: "pointer", color: "#16a34a" }}>
                          <Eye size={18} />
                        </button>
                      )}
                      {!isReadOnly && (
                        <button onClick={() => openEdit(d)} style={{ background: "#f0f7ff", border: "none", padding: "8px", borderRadius: "8px", cursor: "pointer", color: "#0061ff" }}>
                          <Edit size={18} />
                        </button>
                      )}
                      {isAdmin && !isReadOnly && (
                        <button onClick={() => setDeleteConfirm(d.id)} style={{ background: "#fff1f0", border: "none", padding: "8px", borderRadius: "8px", cursor: "pointer", color: "#ef4444" }}>
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", cursor: "zoom-out" }}>
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: "20px", right: "24px", background: "none", border: "none", color: "#fff", fontSize: "2rem", cursor: "pointer" }}>✕</button>
          <img src={lightbox} alt="Vista completa" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "8px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} />
        </div>
      )}

      {/* ── Gallery Modal ── */}
      {galleryDoc && (
        <div onClick={e => { if (e.target === e.currentTarget) setGalleryDoc(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 3000, overflowY: "auto", padding: "40px 20px" }}>
          <div style={{ background: "#fff", borderRadius: "14px", maxWidth: "820px", margin: "0 auto", padding: "28px", boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary-blue)", margin: 0 }}>Archivos adjuntos</h3>
                <p style={{ fontSize: "0.82rem", color: "#888", margin: "4px 0 0" }}>
                  {galleryDoc.cliente}{galleryDoc.sedeNombre ? ` · ${galleryDoc.sedeNombre}` : ""} — {fmtFecha(galleryDoc.fecha)}
                </p>
                <p style={{ fontSize: "0.78rem", color: "#aaa", margin: "2px 0 0" }}>
                  {galleryDoc.imagenes.length} archivo{galleryDoc.imagenes.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button onClick={() => setGalleryDoc(null)}
                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>✕</button>
            </div>

            {galleryDoc.imagenes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px", color: "#bbb" }}>Sin archivos adjuntos</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {galleryDoc.imagenes.map((url, i) => {
                  const pdf = isPdf(url);
                  const name = getFileName(url);
                  return (
                    <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                      {/* Barra superior con nombre y acciones */}
                      <div style={{ padding: "10px 16px", background: pdf ? "#fef2f2" : "#f8fafc", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                          {pdf
                            ? <File size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                            : <Images size={16} color="#6b7280" style={{ flexShrink: 0 }} />
                          }
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            style={{ background: "#f0f7ff", color: "var(--primary-blue)", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", gap: "5px" }}>
                            <ExternalLink size={13} /> {pdf ? "Abrir PDF" : "Ver"}
                          </a>
                          <button onClick={() => downloadFile(url)}
                            style={{ background: "#f0fdf4", color: "#16a34a", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                            <Download size={13} /> Descargar
                          </button>
                        </div>
                      </div>
                      {/* Contenido */}
                      {pdf ? (
                        <iframe
                          src={url}
                          style={{ width: "100%", height: "520px", border: "none", display: "block", background: "#f9fafb" }}
                          title={`PDF ${i + 1}`}
                        />
                      ) : (
                        <img
                          src={url}
                          alt={`Archivo ${i + 1}`}
                          style={{ width: "100%", display: "block", maxHeight: "620px", objectFit: "contain", background: "#111", cursor: "zoom-in" }}
                          onClick={() => setLightbox(url)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailDoc && (
        <div onClick={e => { if (e.target === e.currentTarget) setDetailDoc(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 3000, overflowY: "auto", padding: "40px 20px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", maxWidth: "680px", margin: "0 auto", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>

            {/* Encabezado */}
            <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                    {detailDoc.tipo.map(t => {
                      const { bg, color, dot } = TIPO_COLORS[t] || { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" };
                      return (
                        <span key={t} style={{ background: bg, color, fontSize: "0.75rem", fontWeight: 800, padding: "5px 12px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dot }} />{t}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#888", fontWeight: 600 }}>📅 {fmtFecha(detailDoc.fecha)}</div>
                </div>
                <button onClick={() => setDetailDoc(null)}
                  style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', flexShrink: 0, marginLeft: "12px" }}>✕</button>
              </div>
            </div>

            <div style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: "0" }}>

              {/* Cliente / Sede */}
              <div style={{ padding: "20px 0", borderBottom: "1px solid #f5f5f5" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Cliente</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--primary-blue)" }}>{detailDoc.cliente}</div>
                    {detailDoc.sedeNombre && <div style={{ fontSize: "0.82rem", color: "var(--primary-red)", fontWeight: 700, marginTop: "3px" }}>🏢 {detailDoc.sedeNombre}</div>}
                    {detailDoc.sedeRazonSocial && <div style={{ fontSize: "0.78rem", color: "#888", marginTop: "2px" }}>{detailDoc.sedeRazonSocial}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {detailDoc.clienteDniCuit && <div style={{ fontSize: "0.82rem", color: "#555" }}>🪪 {detailDoc.clienteDniCuit}</div>}
                    {detailDoc.clienteTelefono && <div style={{ fontSize: "0.82rem", color: "#555" }}>📞 {detailDoc.clienteTelefono}</div>}
                    {detailDoc.clienteDireccion && <div style={{ fontSize: "0.82rem", color: "#555" }}>📍 {detailDoc.clienteDireccion}</div>}
                  </div>
                </div>
              </div>

              {/* Descripción / Observaciones */}
              {detailDoc.descripcion && (
                <div style={{ padding: "20px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Descripción / Observaciones</div>
                  <p style={{ fontSize: "0.9rem", color: "#444", lineHeight: "1.6", margin: 0, whiteSpace: "pre-wrap" }}>{detailDoc.descripcion}</p>
                </div>
              )}

              {/* Vencimiento / Medición (RGRL, RAR, Medición) */}
              {(detailDoc.fechaVencimiento || detailDoc.subtipoMedicion) && (
                <div style={{ padding: "20px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Vencimiento y Medición</div>
                  <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                    {detailDoc.fechaVencimiento && (
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#999", fontWeight: 700, marginBottom: "3px" }}>PRÓX. VENCIMIENTO</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#c62828" }}>📅 {fmtFecha(detailDoc.fechaVencimiento)}</div>
                      </div>
                    )}
                    {detailDoc.subtipoMedicion && (
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#999", fontWeight: 700, marginBottom: "3px" }}>TIPO DE MEDICIÓN</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#334155" }}>🔬 {detailDoc.subtipoMedicion}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Expediente CIEC / Bomberos */}
              {(detailDoc.tipo.includes("Expediente CIEC") || detailDoc.tipo.includes("Expediente Bomberos")) && (
                <div style={{ padding: "20px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#0f766e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                    Datos del Expediente
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    {detailDoc.nroExpediente && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ fontSize: "0.72rem", color: "#999", fontWeight: 700, marginBottom: "3px" }}>Nº DE EXPEDIENTE</div>
                        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#0f766e" }}>📋 {detailDoc.nroExpediente}</div>
                      </div>
                    )}
                    {detailDoc.fechaEntrega && (
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#999", fontWeight: 700, marginBottom: "3px" }}>FECHA DE ENTREGA</div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#374151" }}>{fmtFecha(detailDoc.fechaEntrega)}</div>
                      </div>
                    )}
                    {detailDoc.fechaInspeccion && (
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#999", fontWeight: 700, marginBottom: "3px" }}>FECHA DE INSPECCIÓN</div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#374151" }}>{fmtFecha(detailDoc.fechaInspeccion)}</div>
                      </div>
                    )}
                    {detailDoc.fechaEntregaAnexos && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ fontSize: "0.72rem", color: "#999", fontWeight: 700, marginBottom: "3px" }}>FECHA DE ENTREGA DE ANEXOS</div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#374151" }}>{fmtFecha(detailDoc.fechaEntregaAnexos)}</div>
                      </div>
                    )}
                    {!detailDoc.nroExpediente && !detailDoc.fechaEntrega && !detailDoc.fechaInspeccion && !detailDoc.fechaEntregaAnexos && (
                      <div style={{ gridColumn: "1 / -1", fontSize: "0.85rem", color: "#bbb", fontStyle: "italic" }}>Sin datos de expediente cargados.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Plan de Capacitación */}
              {detailDoc.tipo.includes("Plan de Capacitación Anual") && (detailDoc.capacitaciones?.length ?? 0) > 0 && (
                <div style={{ padding: "20px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                    Cronograma de Capacitaciones
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {detailDoc.capacitaciones!.map((cap, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #eee" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: cap.cargada ? "#22c55e" : "#f59e0b" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#333" }}>{cap.tema || "Sin tema"}</div>
                          {cap.fechaPlanificada && <div style={{ fontSize: "0.75rem", color: "#888" }}>{fmtFecha(cap.fechaPlanificada)}</div>}
                        </div>
                        <span style={{ fontSize: "0.72rem", fontWeight: 800, padding: "3px 10px", borderRadius: "20px", background: cap.cargada ? "#dcfce7" : "#fef9c3", color: cap.cargada ? "#15803d" : "#854d0e", flexShrink: 0 }}>
                          {cap.cargada ? "Realizada" : "Pendiente"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Archivos */}
              {detailDoc.imagenes.length > 0 && (
                <div style={{ padding: "20px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Archivos adjuntos ({detailDoc.imagenes.length})
                    </div>
                    <button onClick={() => { setDetailDoc(null); setGalleryDoc(detailDoc); }}
                      style={{ background: "#f0fdf4", color: "#16a34a", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Eye size={13} /> Ver todos
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {detailDoc.imagenes.map((url, i) => (
                      <div key={i} onClick={() => { setDetailDoc(null); isPdf(url) ? setGalleryDoc(detailDoc) : setLightbox(url); }}
                        style={{ cursor: "pointer" }}>
                        <FileThumbnail url={url} size={56} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botones footer */}
              <div style={{ display: "flex", gap: "10px", paddingTop: "20px", borderTop: "1px solid #f0f0f0", marginTop: "4px" }}>
                {!isReadOnly && (
                  <button onClick={() => { setDetailDoc(null); openEdit(detailDoc); }} className="btn-red"
                    style={{ flex: 1, padding: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                    <Edit size={16} /> Editar
                  </button>
                )}
                <button onClick={() => setDetailDoc(null)}
                  style={{ flex: 1, padding: "11px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "380px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "10px" }}>¿Eliminar documento?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "0.9rem" }}>Esta acción eliminará el documento y todos sus archivos asociados. No se puede deshacer.</p>
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
              <button
                onClick={() => setModal(null)}
                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: '0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Cliente + Fecha */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ position: "relative" }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={labelSt}>Cliente *</label>
                    <button type="button" onClick={() => setShowNewClientModal(true)} style={{ background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                      <Plus size={14} /> NUEVO CLIENTE
                    </button>
                  </div>
                  <input
                    style={inputSt}
                    placeholder="Buscar cliente registrado..."
                    value={fCliente}
                    onChange={e => {
                      setFCliente(e.target.value);
                      setShowSuggestions(true);
                      if (!e.target.value) setFClienteId("");
                    }}
                    onFocus={() => { fetchUsuarios(); setShowSuggestions(true); }}
                  />
                  {showSuggestions && fCliente.length > 1 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "8px", zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: "200px", overflowY: "auto", marginTop: "5px" }}>
                      {usuarios
                        .filter(u => `${u.nombre} ${u.apellido || ""} ${u.empresa || ""} ${u.email || ""}`.toLowerCase().includes(fCliente.toLowerCase()))
                        .map(u => (
                          <div key={u.id} onClick={() => onSelectCliente(u)} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #eee" }} onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{u.nombre} {u.apellido}</div>
                            {u.empresa && <div style={{ fontSize: "0.75rem", color: "#666" }}>{u.empresa}</div>}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelSt}>Fecha *</label>
                  <input type="date" style={inputSt} value={fFecha} onChange={e => setFFecha(e.target.value)} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={labelSt}>Sede / Ubicación</label>
                  <select style={inputSt} value={fSedeId} onChange={e => {
                    const s = filteredSedes.find(x => x.id === e.target.value);
                    setFSedeId(e.target.value);
                    setFSedeNombre(s ? s.nombre : "");
                    setFSedeRazonSocial(s ? (s.razonSocial || "") : "");
                  }}>
                    <option value="">-- Seleccionar Sede --</option>
                    {filteredSedes.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.direccion})</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelSt}>DNI / CUIT</label>
                  <input style={inputSt} value={fDniCuit} onChange={e => setFDniCuit(e.target.value)} placeholder="DNI o CUIT" />
                </div>

                <div>
                  <label style={labelSt}>Teléfono</label>
                  <input style={inputSt} value={fTelefono} onChange={e => setFTelefono(e.target.value)} placeholder="Teléfono" />
                </div>

                <div>
                  <label style={labelSt}>Domicilio</label>
                  <input style={inputSt} value={fDireccion} onChange={e => setFDireccion(e.target.value)} placeholder="Dirección completa" />
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label style={labelSt}>Tipo de Documento (Podés seleccionar varios) *</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                  {TIPOS.map(t => {
                    const active = fTipos.includes(t);
                    const { bg, color, dot } = TIPO_COLORS[t];
                    return (
                      <button key={t} type="button"
                        onClick={() => {
                          if (active) setFTipos(prev => prev.filter(x => x !== t));
                          else setFTipos(prev => [...prev, t]);
                        }}
                        style={{ padding: "10px 14px", borderRadius: "8px", border: `2px solid ${active ? dot : "#eee"}`, background: active ? bg : "#fff", color: active ? color : "#666", fontWeight: active ? 800 : 500, cursor: "pointer", textAlign: "left", fontSize: "0.88rem", transition: "0.2s", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: active ? dot : "#ddd", flexShrink: 0 }} />
                        {t}
                        {active && <CheckCircle2 size={14} style={{ marginLeft: 'auto' }} />}
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

              {/* Campos dinámicos: RGRL / RAR / Medición */}
              {(fTipos.includes("RGRL") || fTipos.includes("RAR") || fTipos.includes("Medición de Contaminantes")) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={labelSt}>Próximo Vencimiento / Medición</label>
                    <input type="date" style={inputSt} value={fFechaVencimiento} onChange={e => setFFechaVencimiento(e.target.value)} />
                  </div>
                  {fTipos.includes("Medición de Contaminantes") && (
                    <div>
                      <label style={labelSt}>Tipo de Medición</label>
                      <select style={inputSt} value={fSubtipoMedicion} onChange={e => setFSubtipoMedicion(e.target.value)}>
                        <option value="">Seleccionar...</option>
                        <option value="Ruido">Ruido</option>
                        <option value="Iluminacion">Iluminación</option>
                        <option value="PAT">PAT (Puesta a Tierra)</option>
                        <option value="Carga de Fuego">Carga de Fuego</option>
                        <option value="Otro">Otro (especificar en desc.)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Campos dinámicos: Plan de Capacitación Anual */}
              {fTipos.includes("Plan de Capacitación Anual") && (
                <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "10px", border: "1.5px solid #eee" }}>
                  <label style={labelSt}>Cronograma de Capacitaciones</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                    {fCapacitaciones.map((cap, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr auto", gap: "8px", alignItems: "center", background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #ddd" }}>
                        <input style={{ ...inputSt, padding: "6px 10px" }} value={cap.tema} onChange={e => {
                          const newCaps = [...fCapacitaciones];
                          newCaps[i].tema = e.target.value;
                          setFCapacitaciones(newCaps);
                        }} placeholder="Tema..." />
                        <input type="date" style={{ ...inputSt, padding: "6px 10px" }} value={cap.fechaPlanificada} onChange={e => {
                          const newCaps = [...fCapacitaciones];
                          newCaps[i].fechaPlanificada = e.target.value;
                          setFCapacitaciones(newCaps);
                        }} />
                        <select style={{ ...inputSt, padding: "6px 10px" }} value={cap.cargada ? "si" : "no"} onChange={e => {
                          const newCaps = [...fCapacitaciones];
                          newCaps[i].cargada = e.target.value === "si";
                          setFCapacitaciones(newCaps);
                        }}>
                          <option value="no">Pendiente</option>
                          <option value="si">Realizada</option>
                        </select>
                        <button onClick={() => setFCapacitaciones(fCapacitaciones.filter((_, idx) => idx !== i))} style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "4px", padding: "6px", cursor: "pointer" }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setFCapacitaciones([...fCapacitaciones, { tema: "", fechaPlanificada: "", cargada: false }])}
                    style={{ background: "var(--primary-blue)", color: "#fff", border: "none", borderRadius: "6px", padding: "8px 12px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 700 }}>
                    + Agregar Capacitación
                  </button>
                </div>
              )}

              {/* Campos dinámicos: Expediente CIEC / Bomberos */}
              {(fTipos.includes("Expediente CIEC") || fTipos.includes("Expediente Bomberos")) && (
                <div style={{ background: "#f0fdfa", padding: "16px", borderRadius: "10px", border: "1.5px solid #99f6e4" }}>
                  <label style={{ ...labelSt, color: "#0f766e" }}>
                    Datos del Expediente ({fTipos.filter(t => t === "Expediente CIEC" || t === "Expediente Bomberos").join(" / ")})
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={labelSt}>Nº de Expediente</label>
                      <input style={inputSt} value={fNroExpediente} onChange={e => setFNroExpediente(e.target.value)} placeholder="Ej: EXP-2024-001234" />
                    </div>
                    <div>
                      <label style={labelSt}>Fecha de Entrega</label>
                      <input type="date" style={inputSt} value={fFechaEntrega} onChange={e => setFFechaEntrega(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelSt}>Fecha de Inspección</label>
                      <input type="date" style={inputSt} value={fFechaInspeccion} onChange={e => setFFechaInspeccion(e.target.value)} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={labelSt}>Fecha de Entrega de Anexos</label>
                      <input type="date" style={inputSt} value={fFechaEntregaAnexos} onChange={e => setFFechaEntregaAnexos(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Archivos (imágenes + PDFs) */}
              <div>
                <label style={labelSt}>Archivos adjuntos — imágenes y PDFs ({fImagenes.length})</label>
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple style={{ display: "none" }} onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  style={{ width: "100%", padding: "18px", borderRadius: "10px", border: "2px dashed #ddd", background: "#fafafa", cursor: "pointer", fontSize: "0.92rem", color: "#999", marginBottom: "12px", transition: "0.2s" }}>
                  {uploading ? "⏳ Subiendo archivos..." : "📎 Agregar fotos, planillas o PDFs"}
                </button>
                {fImagenes.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "10px" }}>
                    {fImagenes.map((url, i) => (
                      <div key={i} style={{ position: "relative", borderRadius: "8px", overflow: "hidden", aspectRatio: "1", background: "#f0f0f0", border: "2px solid #eee" }}>
                        {isPdf(url) ? (
                          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fef2f2", gap: "4px", cursor: "default" }}>
                            <File size={28} color="#ef4444" />
                            <span style={{ fontSize: "0.6rem", color: "#ef4444", fontWeight: 700 }}>PDF</span>
                          </div>
                        ) : (
                          <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }} onClick={() => setLightbox(url)} />
                        )}
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
                <button onClick={handleSave} disabled={saving || fTipos.length === 0} className="btn-red" style={{ flex: 2, padding: "12px", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {saving ? "Guardando..." : <><FileText size={18} /> Guardar Documento</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Styles ── */}
      <style jsx>{`
        @media (max-width: 768px) {
          .hide-on-mobile { display: none !important; }
          .show-on-mobile { display: flex !important; }
          .modal-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {/* Nuevo Cliente Modal */}
      {showNewClientModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
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
                  {newClientData.sedes.length === 0 && (
                    <p style={{ fontSize: "0.8rem", color: "#999", fontStyle: "italic", textAlign: "center" }}>Sin sedes agregadas</p>
                  )}
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
      <Toast {...toast} />
    </div>
  );
}
