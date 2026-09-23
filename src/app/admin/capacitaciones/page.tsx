"use client";
import { useEffect, useState, useCallback } from "react";
import { useToast, Toast } from "@/components/Toast";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, where, serverTimestamp, getDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/admin/ViewToggle";
import CopyLinkButton from "@/components/CopyLinkButton";
import { GraduationCap, Plus, Pencil, Trash2, Users, HelpCircle, Check, ClipboardCheck } from "lucide-react";
import {
  detectarTipoArchivo, TIPO_META, DEFAULT_PUNTAJE_MINIMO, DEFAULT_CANTIDAD_PREGUNTAS_EXAMEN, crearOpcionVacia,
  type ArchivoTema, type CapacitacionTema, type PersonalCapacitacion, type OpcionPregunta, type PreguntaCapacitacion,
  type IntentoExamen
} from "@/lib/capacitaciones";

const SITE_URL = "https://arifa.com.ar";

interface PendingFile {
  file: File;
  tipo: ArchivoTema["tipo"];
  previewUrl?: string;
}

const inputSt: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: "8px",
  border: "1.5px solid #ddd", fontSize: "0.92rem", outline: "none", boxSizing: "border-box",
};
const labelSt: React.CSSProperties = {
  display: "block", fontSize: "0.75rem", fontWeight: 700,
  textTransform: "uppercase" as const, letterSpacing: "0.4px", marginBottom: "5px", color: "#666",
};

const EMPTY_FORM = { nombre: "", descripcion: "", activo: true };
const EMPTY_PERSONAL_FORM = { nombre: "", apellido: "", dni: "", email: "", sedeId: "", activo: true };
const EMPTY_PREGUNTA_FORM = { enunciado: "", opciones: [crearOpcionVacia(), crearOpcionVacia()], respuestaCorrectaId: "", puntaje: 1 };

function tiposResumen(archivos: ArchivoTema[]): string {
  const labels = Array.from(new Set(archivos.map(a => TIPO_META[a.tipo]?.label || "Archivo")));
  return labels.join(" · ");
}

function celdaIntento(i?: IntentoExamen) {
  if (!i) return <span style={{ color: "#ccc" }}>—</span>;
  const fecha = i.finalizadoEn?.seconds ? new Date(i.finalizadoEn.seconds * 1000).toLocaleDateString("es-AR") : "";
  return (
    <div>
      <span style={{ fontWeight: 800, color: i.tipo === "posterior" ? (i.aprobado ? "#15803d" : "#dc2626") : "#555" }}>
        {i.porcentaje}%
      </span>
      <div style={{ fontSize: "0.7rem", color: "#999" }}>{fecha}</div>
    </div>
  );
}

export default function AdminCapacitaciones() {
  const [temas, setTemas] = useState<CapacitacionTema[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [currentUserDoc, setCurrentUserDoc] = useState<any>(null);
  const { toast, showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"materiales" | "personal" | "preguntas" | "resultados">("materiales");

  // Materiales
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [keptFiles, setKeptFiles] = useState<ArchivoTema[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [viewMode, setViewMode] = useViewMode("capacitaciones");

  // Personal
  const [clientesBusqueda, setClientesBusqueda] = useState<any[]>([]);
  const [personalSearch, setPersonalSearch] = useState("");
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<any | null>(null);
  const [temasAsignadosDraft, setTemasAsignadosDraft] = useState<string[]>([]);
  const [savingTemasAsignados, setSavingTemasAsignados] = useState(false);
  const [personalRoster, setPersonalRoster] = useState<PersonalCapacitacion[]>([]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalModal, setPersonalModal] = useState<"create" | "edit" | null>(null);
  const [personalForm, setPersonalForm] = useState({ ...EMPTY_PERSONAL_FORM });
  const [personalEditId, setPersonalEditId] = useState<string | null>(null);
  const [personalDeleteConfirm, setPersonalDeleteConfirm] = useState<string | null>(null);

  // Preguntas
  const [preguntasTemaId, setPreguntasTemaId] = useState("");
  const [preguntasConfig, setPreguntasConfig] = useState({ puntajeMinimo: DEFAULT_PUNTAJE_MINIMO, cantidadPreguntasExamen: DEFAULT_CANTIDAD_PREGUNTAS_EXAMEN });
  const [savingConfig, setSavingConfig] = useState(false);
  const [preguntas, setPreguntas] = useState<PreguntaCapacitacion[]>([]);
  const [preguntasLoading, setPreguntasLoading] = useState(false);
  const [preguntaModal, setPreguntaModal] = useState<"create" | "edit" | null>(null);
  const [preguntaForm, setPreguntaForm] = useState<{ enunciado: string; opciones: OpcionPregunta[]; respuestaCorrectaId: string; puntaje: number }>({ ...EMPTY_PREGUNTA_FORM });
  const [preguntaEditId, setPreguntaEditId] = useState<string | null>(null);
  const [preguntaDeleteConfirm, setPreguntaDeleteConfirm] = useState<string | null>(null);

  // Resultados
  const [resultadosSearch, setResultadosSearch] = useState("");
  const [resultadosEmpresa, setResultadosEmpresa] = useState<any | null>(null);
  const [resultadosPersonal, setResultadosPersonal] = useState<Record<string, PersonalCapacitacion>>({});
  const [intentos, setIntentos] = useState<IntentoExamen[]>([]);
  const [intentosLoading, setIntentosLoading] = useState(false);
  const [habilitarConfirm, setHabilitarConfirm] = useState<{ posterior1Id?: string; posterior2Id?: string } | null>(null);

  const fetchTemas = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "capacitaciones_temas"), orderBy("createdAt", "desc")));
      setTemas(snap.docs.map(d => ({ id: d.id, ...d.data() } as CapacitacionTema)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUid(u.uid);
        const userDoc = await getDoc(doc(db, "usuarios", u.uid));
        const data = userDoc.exists() ? userDoc.data() : { rol: "cliente" };
        setRole(data.rol || "cliente");
        setCurrentUserDoc(data);
      }
    });
    fetchTemas();
    return () => unsub();
  }, [fetchTemas]);

  const canManage = role === "admin" || role === "superadmin" || role === "secretaria";
  const isCliente = role === "cliente";
  const canSeePersonalTab = canManage || isCliente;
  const canSeePreguntasTab = canManage;
  const tabsVisibles = ["materiales", ...(canSeePersonalTab ? ["personal"] : []), ...(canSeePreguntasTab ? ["preguntas"] : []), ...(canSeePersonalTab ? ["resultados"] : [])];
  const mostrarTabBar = tabsVisibles.length > 1;

  // ─── Materiales ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setKeptFiles([]);
    setPendingFiles([]);
    setModal("create");
  };

  const openEdit = (t: CapacitacionTema) => {
    setForm({ nombre: t.nombre, descripcion: t.descripcion, activo: t.activo });
    setEditId(t.id);
    setKeptFiles(t.archivos || []);
    setPendingFiles([]);
    setModal("edit");
  };

  const handleFilesSelected = (files: File[]) => {
    const mapped: PendingFile[] = files.map(file => {
      const tipo = detectarTipoArchivo(file);
      return { file, tipo, previewUrl: tipo === "imagen" ? URL.createObjectURL(file) : undefined };
    });
    setPendingFiles(prev => [...prev, ...mapped]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { showToast("El nombre del tema es obligatorio.", "error"); return; }
    setSaving(true);
    try {
      const temaId = editId ?? doc(collection(db, "capacitaciones_temas")).id;

      const nuevos: ArchivoTema[] = [];
      for (const pf of pendingFiles) {
        const fileRef = ref(storage, `capacitaciones/${temaId}/${Date.now()}_${pf.file.name}`);
        const snap = await uploadBytes(fileRef, pf.file);
        const url = await getDownloadURL(snap.ref);
        nuevos.push({ url, nombre: pf.file.name, tipo: pf.tipo, mimeType: pf.file.type || "" });
      }
      const archivosFinal = [...keptFiles, ...nuevos];

      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        activo: form.activo,
        archivos: archivosFinal,
        updatedAt: serverTimestamp(),
      };

      if (editId) {
        const original = temas.find(t => t.id === editId);
        const removidos = (original?.archivos || []).filter(f => !keptFiles.some(k => k.url === f.url));
        for (const f of removidos) {
          try { await deleteObject(ref(storage, f.url)); } catch (err) { console.warn("Error borrando de storage", err); }
        }
        await updateDoc(doc(db, "capacitaciones_temas", editId), payload);
      } else {
        await setDoc(doc(db, "capacitaciones_temas", temaId), {
          ...payload,
          createdAt: serverTimestamp(),
          puntajeMinimo: DEFAULT_PUNTAJE_MINIMO,
          cantidadPreguntasExamen: DEFAULT_CANTIDAD_PREGUNTAS_EXAMEN,
        });
      }

      setModal(null);
      setPendingFiles([]);
      setKeptFiles([]);
      await fetchTemas();
      showToast("Tema guardado correctamente", "success");
    } catch { showToast("Error al guardar. Intentá de nuevo.", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const docRef = doc(db, "capacitaciones_temas", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const archivos: ArchivoTema[] = docSnap.data().archivos || [];
        for (const a of archivos) {
          try { await deleteObject(ref(storage, a.url)); } catch (err) { console.error("Error eliminando archivo de storage:", err); }
        }
      }
      await deleteDoc(docRef);
      setTemas(prev => prev.filter(t => t.id !== id));
      setDeleteConfirm(null);
      showToast("Tema eliminado", "success");
    } catch { showToast("Error al eliminar. Intentá de nuevo.", "error"); }
  };

  const toggleActivo = async (t: CapacitacionTema) => {
    await updateDoc(doc(db, "capacitaciones_temas", t.id), { activo: !t.activo });
    setTemas(prev => prev.map(x => x.id === t.id ? { ...x, activo: !x.activo } : x));
  };

  const thumbUrl = (t: CapacitacionTema) => (t.archivos || []).find(a => a.tipo === "imagen")?.url || null;

  // ─── Personal ───────────────────────────────────────────────────────────
  const fetchClientesBusqueda = async () => {
    try {
      const snap = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente")));
      setClientesBusqueda(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const fetchPersonalRoster = async (empresaId: string) => {
    setPersonalLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "capacitaciones_personal"), where("empresaId", "==", empresaId)));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PersonalCapacitacion));
      list.sort((a, b) => (a.apellido || "").localeCompare(b.apellido || ""));
      setPersonalRoster(list);
    } catch (e) { console.error(e); setPersonalRoster([]); }
    finally { setPersonalLoading(false); }
  };

  const onOpenPersonalTab = () => {
    setActiveTab("personal");
    if (isCliente) {
      if (!empresaSeleccionada && uid && currentUserDoc) {
        const self = { id: uid, ...currentUserDoc };
        setEmpresaSeleccionada(self);
        setTemasAsignadosDraft(self.temasAsignados || []);
        fetchPersonalRoster(uid);
      }
    } else if (clientesBusqueda.length === 0) {
      fetchClientesBusqueda();
    }
  };

  const clientesFiltrados = personalSearch.length < 2 ? [] : clientesBusqueda.filter(c =>
    `${c.nombre || ""} ${c.apellido || ""} ${c.empresa || ""} ${c.email || ""}`.toLowerCase().includes(personalSearch.toLowerCase())
  );

  const onSelectEmpresa = (c: any) => {
    setEmpresaSeleccionada(c);
    setTemasAsignadosDraft(c.temasAsignados || []);
    setPersonalSearch("");
    fetchPersonalRoster(c.id);
  };

  const clearEmpresaSeleccionada = () => {
    setEmpresaSeleccionada(null);
    setPersonalSearch("");
    setTemasAsignadosDraft([]);
    setPersonalRoster([]);
  };

  const handleSaveTemasAsignados = async () => {
    if (!empresaSeleccionada) return;
    setSavingTemasAsignados(true);
    try {
      await updateDoc(doc(db, "usuarios", empresaSeleccionada.id), {
        temasAsignados: temasAsignadosDraft,
        updatedAt: new Date().toISOString(),
      });
      setEmpresaSeleccionada((prev: any) => prev ? { ...prev, temasAsignados: temasAsignadosDraft } : prev);
      showToast("Temas asignados actualizados", "success");
    } catch { showToast("Error al guardar. Intentá de nuevo.", "error"); }
    finally { setSavingTemasAsignados(false); }
  };

  const openCreatePersonal = () => {
    setPersonalForm({ ...EMPTY_PERSONAL_FORM });
    setPersonalEditId(null);
    setPersonalModal("create");
  };

  const openEditPersonal = (p: PersonalCapacitacion) => {
    setPersonalForm({ nombre: p.nombre, apellido: p.apellido, dni: p.dni, email: p.email || "", sedeId: p.sedeId || "", activo: p.activo });
    setPersonalEditId(p.id);
    setPersonalModal("edit");
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaSeleccionada) return;
    if (!personalForm.nombre.trim() || !personalForm.apellido.trim() || !personalForm.dni.trim()) {
      showToast("Nombre, apellido y DNI son obligatorios.", "error"); return;
    }
    try {
      const sede = (empresaSeleccionada.sedes || []).find((s: any) => s.id === personalForm.sedeId);
      const payload = {
        empresaId: empresaSeleccionada.id,
        empresaNombre: empresaSeleccionada.empresa || "",
        nombre: personalForm.nombre.trim(),
        apellido: personalForm.apellido.trim(),
        dni: personalForm.dni.trim(),
        email: personalForm.email.trim(),
        sedeId: personalForm.sedeId || "",
        sedeNombre: sede?.nombre || "",
        activo: personalForm.activo,
        updatedAt: serverTimestamp(),
      };
      if (personalEditId) {
        await updateDoc(doc(db, "capacitaciones_personal", personalEditId), payload);
      } else {
        await addDoc(collection(db, "capacitaciones_personal"), { ...payload, createdAt: serverTimestamp() });
      }
      setPersonalModal(null);
      await fetchPersonalRoster(empresaSeleccionada.id);
      showToast("Personal guardado correctamente", "success");
    } catch { showToast("Error al guardar. Intentá de nuevo.", "error"); }
  };

  const handleDeletePersonal = async (id: string) => {
    try {
      await deleteDoc(doc(db, "capacitaciones_personal", id));
      setPersonalRoster(prev => prev.filter(p => p.id !== id));
      setPersonalDeleteConfirm(null);
      showToast("Persona eliminada", "success");
    } catch { showToast("Error al eliminar. Intentá de nuevo.", "error"); }
  };

  // ─── Preguntas ──────────────────────────────────────────────────────────
  const onSelectTemaPreguntas = async (temaId: string) => {
    setPreguntasTemaId(temaId);
    if (!temaId) { setPreguntas([]); return; }
    const t = temas.find(x => x.id === temaId);
    setPreguntasConfig({
      puntajeMinimo: t?.puntajeMinimo ?? DEFAULT_PUNTAJE_MINIMO,
      cantidadPreguntasExamen: t?.cantidadPreguntasExamen ?? DEFAULT_CANTIDAD_PREGUNTAS_EXAMEN,
    });
    setPreguntasLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "capacitaciones_preguntas"), where("temaId", "==", temaId)));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PreguntaCapacitacion));
      list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setPreguntas(list);
    } catch (e) { console.error(e); setPreguntas([]); }
    finally { setPreguntasLoading(false); }
  };

  const handleSaveConfig = async () => {
    if (!preguntasTemaId) return;
    setSavingConfig(true);
    try {
      await updateDoc(doc(db, "capacitaciones_temas", preguntasTemaId), {
        puntajeMinimo: Number(preguntasConfig.puntajeMinimo),
        cantidadPreguntasExamen: Number(preguntasConfig.cantidadPreguntasExamen),
        updatedAt: serverTimestamp(),
      });
      setTemas(prev => prev.map(t => t.id === preguntasTemaId ? { ...t, ...preguntasConfig } : t));
      showToast("Configuración guardada", "success");
    } catch { showToast("Error al guardar. Intentá de nuevo.", "error"); }
    finally { setSavingConfig(false); }
  };

  const addOpcion = () => setPreguntaForm(f => ({ ...f, opciones: [...f.opciones, crearOpcionVacia()] }));

  const removeOpcion = (id: string) => setPreguntaForm(f => {
    if (f.opciones.length <= 2) return f;
    const opciones = f.opciones.filter(o => o.id !== id);
    const respuestaCorrectaId = f.respuestaCorrectaId === id ? "" : f.respuestaCorrectaId;
    return { ...f, opciones, respuestaCorrectaId };
  });

  const updateOpcionTexto = (id: string, texto: string) =>
    setPreguntaForm(f => ({ ...f, opciones: f.opciones.map(o => o.id === id ? { ...o, texto } : o) }));

  const openCreatePregunta = () => {
    setPreguntaForm({ enunciado: "", opciones: [crearOpcionVacia(), crearOpcionVacia()], respuestaCorrectaId: "", puntaje: 1 });
    setPreguntaEditId(null);
    setPreguntaModal("create");
  };

  const openEditPregunta = (p: PreguntaCapacitacion) => {
    setPreguntaForm({ enunciado: p.enunciado, opciones: p.opciones, respuestaCorrectaId: p.respuestaCorrectaId, puntaje: p.puntaje });
    setPreguntaEditId(p.id);
    setPreguntaModal("edit");
  };

  const handleSavePregunta = async (e: React.FormEvent) => {
    e.preventDefault();
    const opcionesValidas = preguntaForm.opciones.filter(o => o.texto.trim());
    if (!preguntaForm.enunciado.trim()) { showToast("El enunciado es obligatorio.", "error"); return; }
    if (opcionesValidas.length < 2) { showToast("Cargá al menos 2 opciones con texto.", "error"); return; }
    if (!preguntaForm.respuestaCorrectaId || !opcionesValidas.some(o => o.id === preguntaForm.respuestaCorrectaId)) {
      showToast("Marcá cuál es la opción correcta.", "error"); return;
    }
    if (!preguntaForm.puntaje || preguntaForm.puntaje <= 0) { showToast("El puntaje debe ser mayor a 0.", "error"); return; }
    try {
      const payload = {
        temaId: preguntasTemaId,
        enunciado: preguntaForm.enunciado.trim(),
        opciones: opcionesValidas,
        respuestaCorrectaId: preguntaForm.respuestaCorrectaId,
        puntaje: Number(preguntaForm.puntaje),
        updatedAt: serverTimestamp(),
      };
      if (preguntaEditId) {
        await updateDoc(doc(db, "capacitaciones_preguntas", preguntaEditId), payload);
      } else {
        await addDoc(collection(db, "capacitaciones_preguntas"), { ...payload, createdAt: serverTimestamp() });
      }
      setPreguntaModal(null);
      await onSelectTemaPreguntas(preguntasTemaId);
      showToast("Pregunta guardada correctamente", "success");
    } catch { showToast("Error al guardar. Intentá de nuevo.", "error"); }
  };

  const handleDeletePregunta = async (id: string) => {
    try {
      await deleteDoc(doc(db, "capacitaciones_preguntas", id));
      setPreguntas(prev => prev.filter(p => p.id !== id));
      setPreguntaDeleteConfirm(null);
      showToast("Pregunta eliminada", "success");
    } catch { showToast("Error al eliminar. Intentá de nuevo.", "error"); }
  };

  // ─── Resultados ─────────────────────────────────────────────────────────
  const fetchResultados = async (empresaId: string) => {
    setIntentosLoading(true);
    try {
      const [personalSnap, intentosSnap] = await Promise.all([
        getDocs(query(collection(db, "capacitaciones_personal"), where("empresaId", "==", empresaId))),
        getDocs(query(collection(db, "capacitaciones_intentos"), where("empresaId", "==", empresaId))),
      ]);
      const personalMap: Record<string, PersonalCapacitacion> = {};
      personalSnap.docs.forEach(d => { personalMap[d.id] = { id: d.id, ...d.data() } as PersonalCapacitacion; });
      setResultadosPersonal(personalMap);
      setIntentos(intentosSnap.docs.map(d => ({ id: d.id, ...d.data() } as IntentoExamen)).filter(i => i.estado === "finalizado"));
    } catch (e) { console.error(e); setIntentos([]); setResultadosPersonal({}); }
    finally { setIntentosLoading(false); }
  };

  const onOpenResultadosTab = () => {
    setActiveTab("resultados");
    if (isCliente) {
      if (!resultadosEmpresa && uid && currentUserDoc) {
        const self = { id: uid, ...currentUserDoc };
        setResultadosEmpresa(self);
        fetchResultados(uid);
      }
    } else if (clientesBusqueda.length === 0) {
      fetchClientesBusqueda();
    }
  };

  const resultadosClientesFiltrados = resultadosSearch.length < 2 ? [] : clientesBusqueda.filter(c =>
    `${c.nombre || ""} ${c.apellido || ""} ${c.empresa || ""} ${c.email || ""}`.toLowerCase().includes(resultadosSearch.toLowerCase())
  );

  const onSelectResultadosEmpresa = (c: any) => {
    setResultadosEmpresa(c);
    setResultadosSearch("");
    fetchResultados(c.id);
  };

  const clearResultadosEmpresa = () => {
    setResultadosEmpresa(null);
    setResultadosSearch("");
    setIntentos([]);
    setResultadosPersonal({});
  };

  interface FilaResultado {
    personalId: string; temaId: string; personaNombre: string; temaNombre: string;
    previo?: IntentoExamen; posterior1?: IntentoExamen; posterior2?: IntentoExamen;
    estadoFinal: "en_curso" | "aprobado" | "requiere_recapacitacion";
  }

  const filasResultados: FilaResultado[] = (() => {
    const grupos: Record<string, IntentoExamen[]> = {};
    intentos.forEach(i => {
      const key = `${i.personalId}|${i.temaId}`;
      (grupos[key] ||= []).push(i);
    });
    return Object.entries(grupos).map(([key, list]) => {
      const [personalId, temaId] = key.split("|");
      const persona = resultadosPersonal[personalId];
      const tema = temas.find(t => t.id === temaId);
      const activosIntento = list.filter(i => !i.excluido);
      const previo = activosIntento.find(i => i.tipo === "previo");
      const posteriores = activosIntento.filter(i => i.tipo === "posterior").sort((a, b) => a.numeroIntento - b.numeroIntento);
      const aprobado = posteriores.some(i => i.aprobado);
      const requiereRecapacitacion = !aprobado && posteriores.length >= 2;
      return {
        personalId, temaId,
        personaNombre: persona ? `${persona.nombre} ${persona.apellido}` : "—",
        temaNombre: tema?.nombre || "—",
        previo, posterior1: posteriores[0], posterior2: posteriores[1],
        estadoFinal: aprobado ? "aprobado" as const : requiereRecapacitacion ? "requiere_recapacitacion" as const : "en_curso" as const,
      };
    }).sort((a, b) => a.personaNombre.localeCompare(b.personaNombre) || a.temaNombre.localeCompare(b.temaNombre));
  })();

  const handleHabilitarRecapacitacion = async () => {
    if (!habilitarConfirm) return;
    try {
      const ids = [habilitarConfirm.posterior1Id, habilitarConfirm.posterior2Id].filter(Boolean) as string[];
      await Promise.all(ids.map(id => updateDoc(doc(db, "capacitaciones_intentos", id), { excluido: true })));
      showToast("Recapacitación habilitada. La persona ya puede rendir un nuevo examen posterior.", "success");
      setHabilitarConfirm(null);
      if (resultadosEmpresa) await fetchResultados(resultadosEmpresa.id);
    } catch { showToast("Error al habilitar. Intentá de nuevo.", "error"); }
  };

  if (loading && !role) return <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Cargando capacitaciones...</div>;

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Capacitaciones</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
            {activeTab === "materiales" && `${temas.length} tema${temas.length !== 1 ? "s" : ""} de capacitación.`}
            {activeTab === "personal" && "Personal a capacitar por empresa."}
            {activeTab === "preguntas" && "Banco de preguntas y configuración de examen por tema."}
            {activeTab === "resultados" && "Resultados de exámenes por persona y tema."}
          </p>
        </div>
        {activeTab === "materiales" && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <CopyLinkButton url={`${SITE_URL}/capacitaciones`} label="Copiar enlace de biblioteca" />
            <ViewToggle mode={viewMode} onChange={setViewMode} />
            {canManage && (
              <button onClick={openCreate} className="btn-red" style={{ padding: "12px 22px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Plus size={16} /> Nuevo Tema
              </button>
            )}
          </div>
        )}
      </header>

      {mostrarTabBar && (
        <div style={{ display: "flex", gap: "8px", background: "#f1f5f9", padding: "6px", borderRadius: "14px", marginBottom: "24px", width: "fit-content" }}>
          <button type="button"
            onClick={() => setActiveTab("materiales")}
            style={{ padding: "10px 18px", borderRadius: "10px", border: "1.5px solid", borderColor: activeTab === "materiales" ? "#3b82f6" : "#bfdbfe", background: activeTab === "materiales" ? "#fff" : "#eff6ff", fontWeight: 800, color: "#3b82f6", cursor: "pointer", boxShadow: activeTab === "materiales" ? "0 4px 12px rgba(59,130,246,0.15)" : "none", display: "flex", alignItems: "center", gap: "8px", transition: "0.3s" }}>
            <GraduationCap size={18} strokeWidth={2.5} /> Materiales
          </button>
          {canSeePersonalTab && (
            <button type="button"
              onClick={onOpenPersonalTab}
              style={{ padding: "10px 18px", borderRadius: "10px", border: "1.5px solid", borderColor: activeTab === "personal" ? "#16a34a" : "#bbf7d0", background: activeTab === "personal" ? "#fff" : "#f0fdf4", fontWeight: 800, color: "#16a34a", cursor: "pointer", boxShadow: activeTab === "personal" ? "0 4px 12px rgba(22,163,74,0.15)" : "none", display: "flex", alignItems: "center", gap: "8px", transition: "0.3s" }}>
              <Users size={18} strokeWidth={2.5} /> Personal
            </button>
          )}
          {canSeePreguntasTab && (
            <button type="button"
              onClick={() => setActiveTab("preguntas")}
              style={{ padding: "10px 18px", borderRadius: "10px", border: "1.5px solid", borderColor: activeTab === "preguntas" ? "#7c3aed" : "#ddd6fe", background: activeTab === "preguntas" ? "#fff" : "#f5f3ff", fontWeight: 800, color: "#7c3aed", cursor: "pointer", boxShadow: activeTab === "preguntas" ? "0 4px 12px rgba(124,58,237,0.15)" : "none", display: "flex", alignItems: "center", gap: "8px", transition: "0.3s" }}>
              <HelpCircle size={18} strokeWidth={2.5} /> Preguntas
            </button>
          )}
          {canSeePersonalTab && (
            <button type="button"
              onClick={onOpenResultadosTab}
              style={{ padding: "10px 18px", borderRadius: "10px", border: "1.5px solid", borderColor: activeTab === "resultados" ? "#d97706" : "#fde68a", background: activeTab === "resultados" ? "#fff" : "#fffbeb", fontWeight: 800, color: "#d97706", cursor: "pointer", boxShadow: activeTab === "resultados" ? "0 4px 12px rgba(217,119,6,0.15)" : "none", display: "flex", alignItems: "center", gap: "8px", transition: "0.3s" }}>
              <ClipboardCheck size={18} strokeWidth={2.5} /> Resultados
            </button>
          )}
        </div>
      )}

      {activeTab === "materiales" && (
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#bbb" }}>Cargando...</div>
        ) : temas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#bbb" }}>
            <GraduationCap size={40} style={{ marginBottom: "12px" }} />
            <div>Todavía no hay temas de capacitación cargados.</div>
          </div>
        ) : viewMode === "card" ? (
          <div className="doc-card-grid">
            {temas.map(t => (
              <div key={t.id} className="doc-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ width: "100%", aspectRatio: "16/10", background: "#f5f5f5", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {thumbUrl(t) ? (
                    <img src={thumbUrl(t)!} alt={t.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <GraduationCap size={36} color="#ccc" />
                  )}
                </div>
                <div style={{ padding: "16px" }}>
                  <div style={{ fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.95rem" }}>{t.nombre}</div>
                  <div style={{ fontSize: "0.78rem", color: "#888", marginTop: "4px", marginBottom: "10px" }}>
                    {(t.archivos || []).length} material{(t.archivos || []).length !== 1 ? "es" : ""}{t.archivos?.length ? ` · ${tiposResumen(t.archivos)}` : ""}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f0f0f0", paddingTop: "12px" }}>
                    <button
                      onClick={() => canManage && toggleActivo(t)}
                      disabled={!canManage}
                      style={{ padding: "4px 10px", borderRadius: "20px", border: "none", cursor: canManage ? "pointer" : "default", fontSize: "0.68rem", fontWeight: 900, background: t.activo ? "#dcfce7" : "#fee2e2", color: t.activo ? "#15803d" : "#dc2626" }}>
                      {t.activo ? "✓ Activo" : "✕ Inactivo"}
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <CopyLinkButton variant="icon" url={`${SITE_URL}/capacitaciones/${t.id}`} label="Copiar enlace del tema" />
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}><Pencil size={16} /></button>
                          <button onClick={() => setDeleteConfirm(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "640px" }}>
              <thead style={{ background: "#fafafa", borderBottom: "1.5px solid #eee" }}>
                <tr>
                  {["Tema", "Materiales", "Estado", "Acciones"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "13px 16px", fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {temas.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "6px", background: "#f5f5f5", overflow: "hidden", border: "1px solid #eee", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {thumbUrl(t) ? (
                            <img src={thumbUrl(t)!} alt={t.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <GraduationCap size={18} color="#ccc" />
                          )}
                        </div>
                        <div style={{ fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.9rem" }}>{t.nombre}</div>
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: "0.82rem", color: "#555" }}>
                      {(t.archivos || []).length} · {tiposResumen(t.archivos || []) || "—"}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <button
                        onClick={() => canManage && toggleActivo(t)}
                        disabled={!canManage}
                        style={{ padding: "4px 10px", borderRadius: "20px", border: "none", cursor: canManage ? "pointer" : "default", fontSize: "0.68rem", fontWeight: 900, background: t.activo ? "#dcfce7" : "#fee2e2", color: t.activo ? "#15803d" : "#dc2626" }}>
                        {t.activo ? "✓ Activo" : "✕ Inactivo"}
                      </button>
                    </td>
                    <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <CopyLinkButton variant="icon" url={`${SITE_URL}/capacitaciones/${t.id}`} label="Copiar enlace del tema" />
                        {canManage && (
                          <>
                            <button onClick={() => openEdit(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}><Pencil size={16} /></button>
                            <button onClick={() => setDeleteConfirm(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {activeTab === "personal" && canSeePersonalTab && (
        <div>
          {!isCliente && (
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", padding: "20px", marginBottom: "20px" }}>
              <label style={labelSt}>Buscar Empresa Cliente</label>
              <div style={{ position: "relative" }}>
                <input
                  style={inputSt}
                  placeholder="Nombre, empresa o email..."
                  value={empresaSeleccionada
                    ? `${empresaSeleccionada.nombre || ""} ${empresaSeleccionada.apellido || ""}${empresaSeleccionada.empresa ? ` (${empresaSeleccionada.empresa})` : ""}`.trim()
                    : personalSearch}
                  onChange={e => {
                    setPersonalSearch(e.target.value);
                    setEmpresaSeleccionada(null);
                    setTemasAsignadosDraft([]);
                    setPersonalRoster([]);
                  }}
                />
                {clientesFiltrados.length > 0 && !empresaSeleccionada && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "10px", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "220px", overflowY: "auto", marginTop: "5px" }}>
                    {clientesFiltrados.map(c => (
                      <div key={c.id} onClick={() => onSelectEmpresa(c)} style={{ padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}>
                        <div style={{ fontWeight: 700, color: "var(--primary-blue)" }}>{c.nombre} {c.apellido}</div>
                        {c.empresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{c.empresa}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {empresaSeleccionada && (
                  <button type="button" onClick={clearEmpresaSeleccionada}
                    style={{ position: "absolute", right: "12px", top: "12px", background: "none", border: "none", cursor: "pointer", color: "#999" }}>✕</button>
                )}
              </div>
            </div>
          )}

          {empresaSeleccionada ? (
            <>
              <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", padding: "20px", marginBottom: "20px" }}>
                <h3 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "14px", fontSize: "0.95rem" }}>
                  Temas asignados a {empresaSeleccionada.empresa || `${empresaSeleccionada.nombre} ${empresaSeleccionada.apellido}`}
                </h3>
                {canManage ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: "10px", marginBottom: "16px" }}>
                      {temas.filter(t => t.activo).map(t => (
                        <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: "1px solid #eee", cursor: "pointer", background: temasAsignadosDraft.includes(t.id) ? "#eff6ff" : "#fafafa" }}>
                          <input type="checkbox" checked={temasAsignadosDraft.includes(t.id)}
                            onChange={() => setTemasAsignadosDraft(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                            style={{ width: "16px", height: "16px" }} />
                          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{t.nombre}</span>
                        </label>
                      ))}
                      {temas.filter(t => t.activo).length === 0 && (
                        <span style={{ color: "#999", fontSize: "0.85rem" }}>No hay temas activos para asignar.</span>
                      )}
                    </div>
                    <button onClick={handleSaveTemasAsignados} disabled={savingTemasAsignados} className="btn-red" style={{ padding: "10px 20px" }}>
                      {savingTemasAsignados ? "Guardando..." : "Guardar asignación"}
                    </button>
                  </>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(empresaSeleccionada.temasAsignados || []).length === 0 ? (
                      <span style={{ color: "#999", fontSize: "0.85rem" }}>Todavía no tenés temas asignados.</span>
                    ) : (
                      temas.filter(t => (empresaSeleccionada.temasAsignados || []).includes(t.id)).map(t => (
                        <span key={t.id} style={{ fontSize: "0.75rem", background: "#eff6ff", color: "var(--primary-blue)", padding: "5px 12px", borderRadius: "20px", fontWeight: 700 }}>{t.nombre}</span>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
                  <h3 style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "0.95rem" }}>Personal a Capacitar</h3>
                  <button onClick={openCreatePersonal} className="btn-red" style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem" }}>
                    <Plus size={14} /> Agregar Persona
                  </button>
                </div>
                {personalLoading ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#bbb" }}>Cargando...</div>
                ) : personalRoster.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#bbb" }}>Todavía no hay personal cargado para esta empresa.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                      <thead style={{ background: "#fafafa", borderBottom: "1.5px solid #eee" }}>
                        <tr>
                          {["Nombre", "DNI", "Email", "Sede", "Estado", "Acciones"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "13px 16px", fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {personalRoster.map(p => (
                          <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                            <td style={{ padding: "13px 16px", fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.88rem" }}>{p.nombre} {p.apellido}</td>
                            <td style={{ padding: "13px 16px", fontSize: "0.85rem", color: "#555" }}>{p.dni}</td>
                            <td style={{ padding: "13px 16px", fontSize: "0.85rem", color: "#555" }}>{p.email || "—"}</td>
                            <td style={{ padding: "13px 16px", fontSize: "0.85rem", color: "#555" }}>{p.sedeNombre || "—"}</td>
                            <td style={{ padding: "13px 16px" }}>
                              <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "0.68rem", fontWeight: 900, background: p.activo ? "#dcfce7" : "#fee2e2", color: p.activo ? "#15803d" : "#dc2626" }}>
                                {p.activo ? "✓ Activo" : "✕ Inactivo"}
                              </span>
                            </td>
                            <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                              <button onClick={() => openEditPersonal(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}><Pencil size={16} /></button>
                              <button onClick={() => setPersonalDeleteConfirm(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", marginLeft: "8px" }}><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            !isCliente && (
              <div style={{ textAlign: "center", padding: "60px", color: "#bbb" }}>Buscá una empresa para ver y gestionar su personal.</div>
            )
          )}
        </div>
      )}

      {activeTab === "preguntas" && canSeePreguntasTab && (
        <div>
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", padding: "20px", marginBottom: "20px" }}>
            <label style={labelSt}>Tema</label>
            <select style={{ ...inputSt, background: "#fff" }} value={preguntasTemaId} onChange={e => onSelectTemaPreguntas(e.target.value)}>
              <option value="">-- Elegí un tema --</option>
              {temas.map(t => <option key={t.id} value={t.id}>{t.nombre}{!t.activo ? " (inactivo)" : ""}</option>)}
            </select>
          </div>

          {preguntasTemaId && (
            <>
              <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", padding: "20px", marginBottom: "20px" }}>
                <h3 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "14px", fontSize: "0.95rem" }}>Configuración del examen</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "16px" }}>
                  <div>
                    <label style={labelSt}>Puntaje mínimo de aprobación (%)</label>
                    <input style={inputSt} type="number" min={0} max={100} value={preguntasConfig.puntajeMinimo}
                      onChange={e => setPreguntasConfig(c => ({ ...c, puntajeMinimo: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label style={labelSt}>Cantidad de preguntas por examen</label>
                    <input style={inputSt} type="number" min={1} value={preguntasConfig.cantidadPreguntasExamen}
                      onChange={e => setPreguntasConfig(c => ({ ...c, cantidadPreguntasExamen: Number(e.target.value) }))} />
                  </div>
                </div>
                {preguntas.length > 0 && preguntas.length < preguntasConfig.cantidadPreguntasExamen && (
                  <p style={{ fontSize: "0.78rem", color: "#d97706", marginBottom: "12px" }}>
                    ⚠️ Hay {preguntas.length} pregunta{preguntas.length !== 1 ? "s" : ""} cargada{preguntas.length !== 1 ? "s" : ""}, menos que las {preguntasConfig.cantidadPreguntasExamen} configuradas para el examen.
                  </p>
                )}
                <button onClick={handleSaveConfig} disabled={savingConfig} className="btn-red" style={{ padding: "10px 20px" }}>
                  {savingConfig ? "Guardando..." : "Guardar configuración"}
                </button>
              </div>

              <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
                  <h3 style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "0.95rem" }}>Banco de Preguntas</h3>
                  <button onClick={openCreatePregunta} className="btn-red" style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem" }}>
                    <Plus size={14} /> Nueva Pregunta
                  </button>
                </div>
                {preguntasLoading ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#bbb" }}>Cargando...</div>
                ) : preguntas.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#bbb" }}>Todavía no hay preguntas cargadas para este tema.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: "16px", padding: "16px" }}>
                    {preguntas.map(p => (
                      <div key={p.id} style={{ background: "#fafafa", borderRadius: "12px", padding: "16px", border: "1px solid #eee" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b", flex: 1 }}>{p.enunciado}</div>
                          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                            <button onClick={() => openEditPregunta(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}><Pencil size={14} /></button>
                            <button onClick={() => setPreguntaDeleteConfirm(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "10px" }}>
                          {p.opciones.map(o => (
                            <div key={o.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: o.id === p.respuestaCorrectaId ? "#15803d" : "#666", fontWeight: o.id === p.respuestaCorrectaId ? 700 : 400 }}>
                              {o.id === p.respuestaCorrectaId ? <Check size={14} color="#15803d" /> : <span style={{ width: "14px" }} />}
                              {o.texto}
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#999", fontWeight: 700 }}>{p.puntaje} punto{p.puntaje !== 1 ? "s" : ""}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "resultados" && canSeePersonalTab && (
        <div>
          {!isCliente && (
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", padding: "20px", marginBottom: "20px" }}>
              <label style={labelSt}>Buscar Empresa Cliente</label>
              <div style={{ position: "relative" }}>
                <input
                  style={inputSt}
                  placeholder="Nombre, empresa o email..."
                  value={resultadosEmpresa
                    ? `${resultadosEmpresa.nombre || ""} ${resultadosEmpresa.apellido || ""}${resultadosEmpresa.empresa ? ` (${resultadosEmpresa.empresa})` : ""}`.trim()
                    : resultadosSearch}
                  onChange={e => {
                    setResultadosSearch(e.target.value);
                    setResultadosEmpresa(null);
                    setIntentos([]);
                    setResultadosPersonal({});
                  }}
                />
                {resultadosClientesFiltrados.length > 0 && !resultadosEmpresa && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "10px", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "220px", overflowY: "auto", marginTop: "5px" }}>
                    {resultadosClientesFiltrados.map(c => (
                      <div key={c.id} onClick={() => onSelectResultadosEmpresa(c)} style={{ padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}>
                        <div style={{ fontWeight: 700, color: "var(--primary-blue)" }}>{c.nombre} {c.apellido}</div>
                        {c.empresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{c.empresa}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {resultadosEmpresa && (
                  <button type="button" onClick={clearResultadosEmpresa}
                    style={{ position: "absolute", right: "12px", top: "12px", background: "none", border: "none", cursor: "pointer", color: "#999" }}>✕</button>
                )}
              </div>
            </div>
          )}

          {resultadosEmpresa ? (
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              {intentosLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#bbb" }}>Cargando...</div>
              ) : filasResultados.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#bbb" }}>Todavía no hay exámenes rendidos para esta empresa.</div>
              ) : (
                <div className="admin-table-wrap">
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                    <thead style={{ background: "#fafafa", borderBottom: "1.5px solid #eee" }}>
                      <tr>
                        {["Persona", "Tema", "Previo", "Posterior 1", "Posterior 2", "Estado Final", "Acciones"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "13px 16px", fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filasResultados.map(f => (
                        <tr key={`${f.personalId}|${f.temaId}`} style={{ borderBottom: "1px solid #f5f5f5" }}>
                          <td style={{ padding: "13px 16px", fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.88rem" }}>{f.personaNombre}</td>
                          <td style={{ padding: "13px 16px", fontSize: "0.85rem", color: "#555" }}>{f.temaNombre}</td>
                          <td style={{ padding: "13px 16px" }}>{celdaIntento(f.previo)}</td>
                          <td style={{ padding: "13px 16px" }}>{celdaIntento(f.posterior1)}</td>
                          <td style={{ padding: "13px 16px" }}>{celdaIntento(f.posterior2)}</td>
                          <td style={{ padding: "13px 16px" }}>
                            <span style={{
                              padding: "4px 10px", borderRadius: "20px", fontSize: "0.68rem", fontWeight: 900,
                              background: f.estadoFinal === "aprobado" ? "#dcfce7" : f.estadoFinal === "requiere_recapacitacion" ? "#fee2e2" : "#f1f5f9",
                              color: f.estadoFinal === "aprobado" ? "#15803d" : f.estadoFinal === "requiere_recapacitacion" ? "#dc2626" : "#64748b",
                            }}>
                              {f.estadoFinal === "aprobado" ? "✓ Aprobado" : f.estadoFinal === "requiere_recapacitacion" ? "Requiere recapacitación" : "En curso"}
                            </span>
                          </td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                            {canManage && f.estadoFinal === "requiere_recapacitacion" && (
                              <button
                                onClick={() => setHabilitarConfirm({ posterior1Id: f.posterior1?.id, posterior2Id: f.posterior2?.id })}
                                className="btn-blue" style={{ padding: "6px 12px", fontSize: "0.75rem" }}>
                                Habilitar nueva capacitación
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            !isCliente && (
              <div style={{ textAlign: "center", padding: "60px", color: "#bbb" }}>Buscá una empresa para ver sus resultados de examen.</div>
            )
          )}
        </div>
      )}

      {/* Modal Materiales - z-index 150 < sidebar 200 */}
      {modal && canManage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 150, overflowY: "auto", padding: "40px 16px", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "14px", maxWidth: "640px", width: "100%", padding: "32px", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--primary-blue)" }}>
                {modal === "create" ? "Nuevo Tema de Capacitación" : "Editar Tema"}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#aaa" }}>×</button>
            </header>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={labelSt}>Nombre del Tema *</label>
                <input style={inputSt} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Trabajo en Altura" required />
              </div>
              <div>
                <label style={labelSt}>Descripción</label>
                <textarea style={{ ...inputSt, height: "80px", resize: "none" }} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>

              <div>
                <label style={labelSt}>Materiales (imágenes, PDF, video, PowerPoint)</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "10px", marginBottom: "12px" }}>
                  {keptFiles.map((a, idx) => {
                    const meta = TIPO_META[a.tipo];
                    const Icon = meta.icon;
                    return (
                      <div key={`kept-${idx}`} style={{ position: "relative", aspectRatio: "1", borderRadius: "8px", border: "1px solid #eee", overflow: "hidden", background: "#f8f9fa", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px", textAlign: "center" }}>
                        {a.tipo === "imagen" ? (
                          <img src={a.url} alt={a.nombre} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                        ) : (
                          <>
                            <Icon size={26} color={meta.color} />
                            <span style={{ fontSize: "0.6rem", color: "#666", marginTop: "6px", wordBreak: "break-word", lineHeight: 1.2, maxHeight: "2.4em", overflow: "hidden" }}>{a.nombre}</span>
                          </>
                        )}
                        <button type="button" onClick={() => setKeptFiles(prev => prev.filter((_, i) => i !== idx))}
                          style={{ position: "absolute", top: "4px", right: "4px", width: "20px", height: "20px", borderRadius: "50%", border: "none", background: "rgba(220,38,38,0.85)", color: "#fff", cursor: "pointer", fontSize: "12px", zIndex: 2 }}>×</button>
                      </div>
                    );
                  })}
                  {pendingFiles.map((pf, idx) => {
                    const meta = TIPO_META[pf.tipo];
                    const Icon = meta.icon;
                    return (
                      <div key={`pending-${idx}`} style={{ position: "relative", aspectRatio: "1", borderRadius: "8px", border: "1px solid #eee", overflow: "hidden", background: "#f8f9fa", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px", textAlign: "center" }}>
                        {pf.previewUrl ? (
                          <img src={pf.previewUrl} alt={pf.file.name} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                        ) : (
                          <>
                            <Icon size={26} color={meta.color} />
                            <span style={{ fontSize: "0.6rem", color: "#666", marginTop: "6px", wordBreak: "break-word", lineHeight: 1.2, maxHeight: "2.4em", overflow: "hidden" }}>{pf.file.name}</span>
                          </>
                        )}
                        <button type="button" onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                          style={{ position: "absolute", top: "4px", right: "4px", width: "20px", height: "20px", borderRadius: "50%", border: "none", background: "rgba(220,38,38,0.85)", color: "#fff", cursor: "pointer", fontSize: "12px", zIndex: 2 }}>×</button>
                      </div>
                    );
                  })}
                  <div style={{ aspectRatio: "1", borderRadius: "8px", border: "2px dashed #ccc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", background: "#fafafa" }}>
                    <span style={{ fontSize: "1.2rem", color: "#999" }}>➕</span>
                    <span style={{ fontSize: "0.55rem", fontWeight: 800, color: "#999", textTransform: "uppercase" }}>Añadir</span>
                    <input type="file" multiple accept="image/*,application/pdf,video/*,.ppt,.pptx"
                      onChange={e => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) handleFilesSelected(files);
                        e.target.value = "";
                      }}
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
                  </div>
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 }}>
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} style={{ width: "18px", height: "18px" }} />
                Tema visible públicamente
              </label>

              <div style={{ display: "flex", gap: "12px", paddingTop: "20px" }}>
                <button type="button" onClick={() => setModal(null)} className="btn-white" style={{ flex: 1, border: "1px solid #ddd" }}>Cancelar</button>
                <button type="submit" disabled={saving} className="btn-red" style={{ flex: 2 }}>{saving ? "Guardando..." : "Guardar Tema"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "380px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "15px" }}>⚠️</div>
            <h3 style={{ fontWeight: 800, marginBottom: "10px" }}>¿Eliminar tema?</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "24px" }}>Se borrarán también todos sus archivos. Esta acción es irreversible.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-red" style={{ flex: 1 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Personal */}
      {personalModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 150, overflowY: "auto", padding: "40px 16px", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "14px", maxWidth: "480px", width: "100%", padding: "32px", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--primary-blue)" }}>{personalModal === "create" ? "Nueva Persona" : "Editar Persona"}</h2>
              <button onClick={() => setPersonalModal(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#aaa" }}>×</button>
            </header>
            <form onSubmit={handleSavePersonal} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label style={labelSt}>Nombre *</label>
                  <input style={inputSt} value={personalForm.nombre} onChange={e => setPersonalForm(f => ({ ...f, nombre: e.target.value }))} required />
                </div>
                <div>
                  <label style={labelSt}>Apellido *</label>
                  <input style={inputSt} value={personalForm.apellido} onChange={e => setPersonalForm(f => ({ ...f, apellido: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label style={labelSt}>DNI *</label>
                <input style={inputSt} value={personalForm.dni} onChange={e => setPersonalForm(f => ({ ...f, dni: e.target.value }))} required />
              </div>
              <div>
                <label style={labelSt}>Email (opcional)</label>
                <input style={inputSt} type="email" value={personalForm.email} onChange={e => setPersonalForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              {(empresaSeleccionada?.sedes || []).length > 0 && (
                <div>
                  <label style={labelSt}>Sede (opcional)</label>
                  <select style={{ ...inputSt, background: "#fff" }} value={personalForm.sedeId} onChange={e => setPersonalForm(f => ({ ...f, sedeId: e.target.value }))}>
                    <option value="">-- Sin especificar --</option>
                    {empresaSeleccionada.sedes.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 }}>
                <input type="checkbox" checked={personalForm.activo} onChange={e => setPersonalForm(f => ({ ...f, activo: e.target.checked }))} style={{ width: "18px", height: "18px" }} />
                Persona activa
              </label>
              <div style={{ display: "flex", gap: "12px", paddingTop: "10px" }}>
                <button type="button" onClick={() => setPersonalModal(null)} className="btn-white" style={{ flex: 1, border: "1px solid #ddd" }}>Cancelar</button>
                <button type="submit" className="btn-red" style={{ flex: 2 }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {personalDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "380px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "15px" }}>⚠️</div>
            <h3 style={{ fontWeight: 800, marginBottom: "10px" }}>¿Eliminar a esta persona?</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "24px" }}>Esta acción es irreversible.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setPersonalDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDeletePersonal(personalDeleteConfirm)} className="btn-red" style={{ flex: 1 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pregunta */}
      {preguntaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 150, overflowY: "auto", padding: "40px 16px", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "14px", maxWidth: "560px", width: "100%", padding: "32px", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--primary-blue)" }}>{preguntaModal === "create" ? "Nueva Pregunta" : "Editar Pregunta"}</h2>
              <button onClick={() => setPreguntaModal(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#aaa" }}>×</button>
            </header>
            <form onSubmit={handleSavePregunta} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelSt}>Enunciado *</label>
                <textarea style={{ ...inputSt, height: "70px", resize: "none" }} value={preguntaForm.enunciado} onChange={e => setPreguntaForm(f => ({ ...f, enunciado: e.target.value }))} required />
              </div>
              <div>
                <label style={labelSt}>Opciones (marcá la correcta)</label>
                {preguntaForm.opciones.map((op, idx) => (
                  <div key={op.id} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <input type="radio" name="respuestaCorrecta" checked={preguntaForm.respuestaCorrectaId === op.id}
                      onChange={() => setPreguntaForm(f => ({ ...f, respuestaCorrectaId: op.id }))}
                      style={{ width: "18px", height: "18px", flexShrink: 0 }} />
                    <input style={inputSt} value={op.texto} onChange={e => updateOpcionTexto(op.id, e.target.value)} placeholder={`Opción ${idx + 1}`} />
                    <button type="button" onClick={() => removeOpcion(op.id)} disabled={preguntaForm.opciones.length <= 2}
                      style={{ background: "none", border: "none", cursor: preguntaForm.opciones.length <= 2 ? "default" : "pointer", color: preguntaForm.opciones.length <= 2 ? "#ccc" : "#dc2626", flexShrink: 0 }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addOpcion} style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary-blue)", background: "none", border: "none", cursor: "pointer", padding: "6px 0" }}>
                  + Agregar opción
                </button>
              </div>
              <div>
                <label style={labelSt}>Puntaje</label>
                <input style={inputSt} type="number" min={1} value={preguntaForm.puntaje} onChange={e => setPreguntaForm(f => ({ ...f, puntaje: Number(e.target.value) }))} />
              </div>
              <div style={{ display: "flex", gap: "12px", paddingTop: "10px" }}>
                <button type="button" onClick={() => setPreguntaModal(null)} className="btn-white" style={{ flex: 1, border: "1px solid #ddd" }}>Cancelar</button>
                <button type="submit" className="btn-red" style={{ flex: 2 }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {preguntaDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "380px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "15px" }}>⚠️</div>
            <h3 style={{ fontWeight: 800, marginBottom: "10px" }}>¿Eliminar esta pregunta?</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "24px" }}>Esta acción es irreversible.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setPreguntaDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDeletePregunta(preguntaDeleteConfirm)} className="btn-red" style={{ flex: 1 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {habilitarConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "380px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "15px" }}>⚠️</div>
            <h3 style={{ fontWeight: 800, marginBottom: "10px" }}>¿Habilitar nueva capacitación?</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "24px" }}>La persona va a poder rendir un nuevo examen posterior (intento 1 de 2) para este tema.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setHabilitarConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleHabilitarRecapacitacion} className="btn-red" style={{ flex: 1 }}>Habilitar</button>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} />
    </div>
  );
}
