"use client";
import { useEffect, useState, useCallback } from "react";
import { useToast, Toast } from "@/components/Toast";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, getDocs, query, orderBy, where, doc, getDoc, deleteDoc,
  addDoc, serverTimestamp, updateDoc
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye, Edit, Trash2, Plus, ClipboardList,
  Folder, Search, Shield, Flame, Scroll, Settings, BookMarked, X
} from "lucide-react";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface OT {
  id: string;
  numero: number;
  fecha: string;
  clienteNombre: string;
  clienteEmpresa: string;
  clienteId?: string;
  sedeId?: string;
  sedeNombre?: string;
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

interface PlantillaCliente {
  id: string;
  nombre: string;
  clienteId?: string;
  clienteNombre: string;
  clienteEmpresa?: string;
  sedeId?: string;
  sedeNombre?: string;
  planillas: any[];
  createdAt?: any;
  updatedAt?: any;
}

const urlToBase64 = async (url: string) => {
  try {
    if (!url || !url.startsWith("http")) return null;
    const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const dataUrl = await new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const cnv = document.createElement("canvas");
    const maxPx = 1200;
    const ratio = Math.min(maxPx / img.naturalWidth, maxPx / img.naturalHeight, 1);
    cnv.width = Math.round(img.naturalWidth * ratio);
    cnv.height = Math.round(img.naturalHeight * ratio);
    cnv.getContext("2d")!.drawImage(img, 0, 0, cnv.width, cnv.height);
    return cnv.toDataURL("image/jpeg", 0.82);
  } catch { return null; }
};

const downloadOTPDF = async (otId: string) => {
  const snap = await getDoc(doc(db, "ordenes_trabajo", otId));
  if (!snap.exists()) { alert("No se encontró la inspección."); return; }
  const data = snap.data() as any;
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
  const otNum = String(data.numero || "").padStart(4, "0");
  const fecStr = data.fecha ? new Date(data.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";
  const estado: string = data.estado || "borrador";
  const planillasEnOT: any[] = data.planillasSeleccionadas || [];
  const fotos: string[] = data.fotos || [];
  const tecnicosOT: any[] = data.tecnicosOT || (data.tecnicos || []).map((t: string) => ({ nombre: t }));
  const nuevaObs: string = data.diagnostico || "";
  const firmaTecnico: string | null = data.firmaTecnico || null;
  const firmaCliente: string | null = data.firmaCliente || null;
  const nombreFirmaTecnico: string = data.nombreFirmaTecnico || "";
  const nombreFirmaCliente: string = data.nombreFirmaCliente || "";
  const clienteNombre: string = data.clienteNombre || "";
  const clienteEmpresa: string = data.clienteEmpresa || "";
  const clienteDireccion: string = data.clienteDireccion || "";
  const clienteTelefono: string = data.clienteTelefono || "";
  const sedeNombre: string = data.sedeNombre || "";
  const sedeRazonSocial: string = data.sedeRazonSocial || "";

  let logoPng: string | null = null;
  try {
    const resp = await fetch("/logos/logoFondoTransparente.svg");
    const svgText = await resp.text();
    const img = new Image();
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || 300; c.height = img.naturalHeight || 150;
    c.getContext("2d")!.drawImage(img, 0, 0);
    logoPng = c.toDataURL("image/png");
    URL.revokeObjectURL(url);
  } catch {}

  const HEADER_H = 30; const top = 10;
  const drawHeader = (pg: any) => {
    pg.setDrawColor(0, 34, 68); pg.setLineWidth(0.5); pg.rect(ML, top, TW, HEADER_H);
    if (logoPng) pg.addImage(logoPng, "PNG", ML + 2, top + 2, 28, 26);
    pg.line(ML + 33, top, ML + 33, top + HEADER_H);
    const rx = W - MR - 48; const cx = ML + 33 + (rx - ML - 33) / 2;
    pg.setFont("helvetica", "bold"); pg.setFontSize(11); pg.setTextColor(0, 34, 68);
    pg.text("INSPECCIÓN TÉCNICA", cx, top + 9, { align: "center" });
    pg.setFontSize(14); pg.setTextColor(163, 31, 29); pg.text(`IT-${otNum}`, cx, top + 23, { align: "center" });
    pg.line(rx, top, rx, top + HEADER_H);
    pg.setFontSize(7); pg.setTextColor(0);
    pg.text("Fecha:", rx + 2, top + 11); pg.text("Estado:", rx + 2, top + 18); pg.text("Planilla:", rx + 2, top + 25);
    pg.setFont("helvetica", "normal");
    pg.text(fecStr, rx + 18, top + 11); pg.text(estado.toUpperCase(), rx + 18, top + 18);
    pg.text(planillasEnOT[0]?.codigo || "-", rx + 18, top + 25);
  };

  drawHeader(pdf);
  let y = top + HEADER_H + 8;

  autoTable(pdf, {
    startY: y, margin: { left: ML, right: MR },
    body: [
      [{ content: "CLIENTE / RAZÓN SOCIAL:", styles: { fontStyle: "bold", cellWidth: 45 } }, clienteNombre || "-"],
      [{ content: "EMPRESA / SEDE:", styles: { fontStyle: "bold" } }, (sedeRazonSocial || clienteEmpresa || "-") + (sedeNombre ? ` - SEDE: ${sedeNombre}` : "")],
      [{ content: "DIRECCIÓN:", styles: { fontStyle: "bold" } }, clienteDireccion || "-"],
      [{ content: "TELÉFONO / CEL:", styles: { fontStyle: "bold" } }, clienteTelefono || "-"],
    ],
    styles: { fontSize: 9, cellPadding: 3 }, tableLineColor: [0, 34, 68], tableLineWidth: 0.1
  });
  y = (pdf as any).lastAutoTable.finalY + 8;

  if (tecnicosOT.length > 0) {
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.setFont("helvetica", "bold");
    pdf.text("EQUIPO TÉCNICO ASIGNADO", ML + 3, y + 5);
    y += 7.5;
    autoTable(pdf, { startY: y, margin: { left: ML, right: MR }, body: tecnicosOT.map(t => [t.nombre]), styles: { fontSize: 8.5, cellPadding: 3 } });
    y = (pdf as any).lastAutoTable.finalY + 8;
  }

  const sevColors: Record<string, number[]> = { leve: [16, 185, 129], moderado: [245, 158, 11], critico: [239, 68, 68] };
  const todasObs = [
    nuevaObs.trim() ? { texto: `[GENERAL] ${nuevaObs}`, sev: "" } : null,
    ...planillasEnOT.flatMap(p => (p.filasChecklist || []).filter((f: any) => f.observacion?.trim()).map((f: any) => ({ texto: `[${p.nombre}] ${f.descripcion}: ${f.observacion}`, sev: f.severidad || "" }))),
  ].filter(Boolean) as { texto: string; sev: string }[];

  if (todasObs.length > 0) {
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.text("RESUMEN DE OBSERVACIONES TÉCNICAS", ML + 3, y + 5);
    y += 7.5;
    autoTable(pdf, {
      startY: y, margin: { left: ML, right: MR },
      body: todasObs.map(o => [o.texto, o.sev ? o.sev.toUpperCase() : ""]),
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: { 1: { cellWidth: 35, halign: "center", fontStyle: "bold" } },
      willDrawCell: (cellData: any) => {
        if (cellData.column.index === 1 && cellData.section === "body") {
          const sev = todasObs[cellData.row.index]?.sev;
          if (sev && sevColors[sev]) pdf.setTextColor(sevColors[sev][0], sevColors[sev][1], sevColors[sev][2]);
        }
      }
    });
    y = (pdf as any).lastAutoTable.finalY + 10;
  }

  if (fotos.length > 0) {
    if (y > 220) { pdf.addPage(); drawHeader(pdf); y = top + HEADER_H + 10; }
    pdf.setFillColor(240, 240, 240); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8.5); pdf.setTextColor(0); pdf.text("REGISTRO FOTOGRÁFICO", ML + 3, y + 5);
    y += 10; let xPh = ML;
    for (const fUrl of fotos) {
      const b64 = await urlToBase64(fUrl);
      if (b64) {
        if (xPh + 45 > W - MR) { xPh = ML; y += 45; }
        if (y > 240) { pdf.addPage(); drawHeader(pdf); y = top + HEADER_H + 10; xPh = ML; }
        pdf.addImage(b64, "JPEG", xPh, y, 42, 42); xPh += 45;
      }
    }
    y += 50;
  }

  for (const p of planillasEnOT) {
    if (y > 240) { pdf.addPage(); drawHeader(pdf); y = top + HEADER_H + 10; }
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.text(`PLANILLA: ${p.nombre}`, ML + 3, y + 5);
    y += 9;
    autoTable(pdf, {
      startY: y, margin: { left: ML, right: MR },
      head: p.tipo === "checklist" ? [["Ítem", "Res.", "Observación", "Prio."]] : [p.columnas],
      body: p.tipo === "checklist"
        ? (p.filasChecklist || []).filter((f: any) => !f.esGrupo).map((f: any) => [f.descripcion, f.valor?.toUpperCase() || "", f.observacion || "-", f.severidad?.toUpperCase() || "-"])
        : (p.filasTabla || []).map((f: any) => (p.columnas || []).map((c: string) => f.celdas?.[c] || "-")),
      styles: { fontSize: p.tipo === "tabla_piso" && (p.columnas || []).length > 8 ? 6.5 : 7.5, cellPadding: 2 },
      headStyles: { fillColor: [80, 80, 80], overflow: "linebreak" }, theme: "grid"
    });
    y = (pdf as any).lastAutoTable.finalY + 10;
  }

  if (y > 230) { pdf.addPage(); drawHeader(pdf); y = top + HEADER_H + 10; }
  pdf.setDrawColor(200); pdf.line(ML, y, W - MR, y); y += 5;
  if (firmaTecnico) { pdf.addImage(firmaTecnico, "PNG", ML + 10, y, 40, 20); pdf.setFontSize(8); pdf.text(`Firma Técnico: ${nombreFirmaTecnico}`, ML + 10, y + 25); }
  if (firmaCliente) { pdf.addImage(firmaCliente, "PNG", W - MR - 50, y, 40, 20); pdf.setFontSize(8); pdf.text(`Firma Cliente: ${nombreFirmaCliente}`, W - MR - 50, y + 25); }

  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    const fy = 287;
    pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(ML, fy - 5, W - MR, fy - 5);
    pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5); pdf.setTextColor(120);
    pdf.text(`Inspección Técnica IT-${otNum} — ${fecStr}`, ML, fy);
    pdf.text(`Página ${i} de ${pageCount}`, W / 2, fy, { align: "center" });
    pdf.text("ARIFA - Protección contra Incendios", W - MR, fy, { align: "right" });
  }

  pdf.save(`IT-${otNum}.pdf`);
};

const CATEGORIAS = [
  { value: "deteccion", label: "Detección", icon: <Search size={18} strokeWidth={2.5} color="#3b82f6" /> },
  { value: "extincion", label: "Extinción", icon: <Shield size={18} strokeWidth={2.5} color="#f97316" /> },
  { value: "matafuegos", label: "Matafuegos", icon: <Flame size={18} strokeWidth={2.5} color="#ef4444" /> },
  { value: "certificaciones", label: "Certificaciones", icon: <Scroll size={18} strokeWidth={2.5} color="#7c3aed" /> },
];

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  borrador: { bg: "#f5f5f5", color: "#666" },
  en_proceso: { bg: "#fff3e0", color: "#e65100" },
  completada: { bg: "#e8f5e9", color: "#2e7d32" },
  firmada: { bg: "#e8f5e9", color: "#2e7d32" },
};

export default function OTUnifiedPage() {
  const [activeTab, setActiveTab] = useState<"ots" | "gestor" | "clientes">("ots");
  const [ots, setOts] = useState<OT[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: "ot" | "plantilla" | "plantilla_cliente" } | null>(null);

  // Plantillas de cliente
  const [plantillasCliente, setPlantillasCliente] = useState<PlantillaCliente[]>([]);
  const [filtroClientePC, setFiltroClientePC] = useState("");
  const [modalPC, setModalPC] = useState<null | "create" | "edit">(null);
  const [editingPC, setEditingPC] = useState<PlantillaCliente | null>(null);
  const [formPC, setFormPC] = useState({ nombre: "", clienteNombre: "", clienteId: "", clienteEmpresa: "", sedeId: "", sedeNombre: "" });
  const [pcClienteSearch, setPcClienteSearch] = useState("");
  const [pcClienteSeleccionado, setPcClienteSeleccionado] = useState<any>(null);
  const [pcClientesFiltrados, setPcClientesFiltrados] = useState<any[]>([]);
  const [pcClientesTodos, setPcClientesTodos] = useState<any[]>([]);
  const [pcPlanillasSeleccionadas, setPcPlanillasSeleccionadas] = useState<string[]>([]);
  const [pcSedes, setPcSedes] = useState<any[]>([]);
  const [savingPC, setSavingPC] = useState(false);
  
  const [modalGestor, setModalGestor] = useState<"create" | "edit" | null>(null);
  const [editingPlantilla, setEditingPlantilla] = useState<Plantilla | null>(null);

  const [saving, setSaving] = useState(false);
  const { toast, showToast } = useToast();
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
  const [filtroSede, setFiltroSede] = useState("Todas");
  const [currentUser, setCurrentUser] = useState<any>(null);

  const router = useRouter();

  const isStaffRole = (r: string) => ["admin", "tecnico", "superadmin", "secretaria", "supervisor"].includes(r);

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
        const qFallback = isStaffRole(r)
          ? query(collection(db, "ordenes_trabajo"))
          : query(collection(db, "ordenes_trabajo"), where("clienteId", "==", uid));
        snap = await getDocs(qFallback);
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

  const fetchPlantillasCliente = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "plantillas_cliente"), orderBy("clienteNombre")));
      setPlantillasCliente(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlantillaCliente)));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const r = userData.rol || "cliente";
      setRole(r);
      setCurrentUser({ uid: u.uid, ...userData });
      if (activeTab === "ots") fetchOTs(r, u.uid);
      else if (activeTab === "gestor") fetchPlantillas();
      else if (activeTab === "clientes") { fetchPlantillasCliente(); fetchPlantillas(); }
    });
    return () => unsub();
  }, [router, activeTab, fetchOTs, fetchPlantillas, fetchPlantillasCliente]);

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
      } else if (deleteConfirm.type === "plantilla_cliente") {
        await deleteDoc(doc(db, "plantillas_cliente", deleteConfirm.id));
        setPlantillasCliente(prev => prev.filter(p => p.id !== deleteConfirm.id));
      } else {
        await deleteDoc(doc(db, "plantillas_inspeccion", deleteConfirm.id));
        setPlantillas(prev => prev.filter(p => p.id !== deleteConfirm.id));
      }
      setDeleteConfirm(null);
    } catch (e) { showToast("Error al eliminar. Intentá de nuevo.", "error"); }
  };

  const openModalPC = (pc?: PlantillaCliente) => {
    if (pc) {
      setEditingPC(pc);
      setFormPC({ nombre: pc.nombre, clienteNombre: pc.clienteNombre, clienteId: pc.clienteId || "", clienteEmpresa: pc.clienteEmpresa || "", sedeId: pc.sedeId || "", sedeNombre: pc.sedeNombre || "" });
      setPcClienteSeleccionado(pc.clienteId ? { id: pc.clienteId, nombre: pc.clienteNombre, empresa: pc.clienteEmpresa } : null);
      setPcPlanillasSeleccionadas((pc.planillas || []).map((p: any) => p.plantillaId).filter(Boolean));
      setPcSedes([]);
      setModalPC("edit");
    } else {
      setEditingPC(null);
      setFormPC({ nombre: "", clienteNombre: "", clienteId: "", clienteEmpresa: "", sedeId: "", sedeNombre: "" });
      setPcClienteSeleccionado(null);
      setPcClienteSearch("");
      setPcPlanillasSeleccionadas([]);
      setPcSedes([]);
      setModalPC("create");
    }
  };

  const searchPcClientes = async (text: string) => {
    if (text.length < 2) { setPcClientesFiltrados([]); return; }
    let lista = pcClientesTodos;
    if (lista.length === 0) {
      const snap = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente")));
      lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPcClientesTodos(lista);
    }
    const q = text.toLowerCase();
    setPcClientesFiltrados(lista.filter((c: any) => `${c.nombre || ""} ${c.empresa || ""} ${c.email || ""}`.toLowerCase().includes(q)).slice(0, 6));
  };

  const handleSavePC = async () => {
    if (!formPC.nombre.trim() || !formPC.clienteNombre.trim()) { showToast("Nombre y cliente son obligatorios", "error"); return; }
    if (pcPlanillasSeleccionadas.length === 0) { showToast("Seleccioná al menos una planilla", "error"); return; }
    setSavingPC(true);
    try {
      const planillasToSave = pcPlanillasSeleccionadas.map(plantillaId => {
        const base = plantillas.find(p => p.id === plantillaId);
        if (!base) return null;
        const existing = editingPC?.planillas?.find((p: any) => p.plantillaId === plantillaId);
        return existing || {
          plantillaId,
          codigo: base.codigo,
          nombre: base.nombre,
          tipo: base.tipo,
          modoChecklist: base.modoChecklist || "ok_nok",
          columnas: base.columnas || [],
          infoFields: base.infoFields || [],
          infoValues: {},
          filasChecklist: base.tipo === "checklist" ? (base.items || []).map(item => ({ itemId: item.id, descripcion: item.descripcion, esGrupo: item.esGrupo || false, valor: "", observacion: "", severidad: "" })) : [],
          filasTabla: base.tipo === "tabla_piso" ? [{ celdas: Object.fromEntries((base.columnas || []).map(c => [c, ""])) }] : [],
        };
      }).filter(Boolean);

      const payload: any = {
        nombre: formPC.nombre.trim(),
        clienteId: pcClienteSeleccionado?.id || null,
        clienteNombre: formPC.clienteNombre.trim(),
        clienteEmpresa: formPC.clienteEmpresa || "",
        sedeId: formPC.sedeId || null,
        sedeNombre: formPC.sedeNombre || "",
        planillas: planillasToSave,
        updatedAt: serverTimestamp(),
      };
      if (modalPC === "edit" && editingPC) {
        await updateDoc(doc(db, "plantillas_cliente", editingPC.id), payload);
      } else {
        await addDoc(collection(db, "plantillas_cliente"), { ...payload, createdAt: serverTimestamp() });
      }
      setModalPC(null);
      await fetchPlantillasCliente();
      showToast("Plantilla guardada correctamente", "success");
    } catch (e) { showToast("Error al guardar. Intentá de nuevo.", "error"); }
    finally { setSavingPC(false); }
  };

  const handleSavePlantilla = async () => {
    if (!formPlantilla.codigo || !formPlantilla.nombre) { showToast("Código y nombre son obligatorios.", "error"); return; }
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
      showToast("Plantilla guardada correctamente", "success");
    } catch (e) { showToast("Error al guardar. Intentá de nuevo.", "error"); }
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
    const q = search.toLowerCase();
    const matchesSearch = 
      String(ot.numero).includes(q) || 
      ot.clienteNombre?.toLowerCase().includes(q) ||
      ot.clienteEmpresa?.toLowerCase().includes(q);
    
    const otDate = ot.fecha ? new Date(ot.fecha) : null;
    let matchesDate = true;
    if (otDate) {
      if (dateFrom && otDate < new Date(dateFrom)) matchesDate = false;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (otDate > toDate) matchesDate = false;
      }
    }
    const matchesSede = filtroSede === "Todas" || ot.sedeNombre === filtroSede;
    return matchesSearch && matchesDate && matchesSede;
  });

  const isStaff = isStaffRole(role ?? "");
  const isAdmin = role === "admin" || role === "superadmin" || role === "supervisor";
  const isClient = role === "cliente";
  const isReadOnly = isClient; // clientes solo pueden ver

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* HEADER */}
      <header style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>
            {isClient ? "Mis Inspecciones" : "Inspecciones Técnicas"}
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>{activeTab === "ots" ? "Gestión de inspecciones en campo." : activeTab === "gestor" ? "Gestión de plantillas base." : "Plantillas configuradas por cliente."}</p>
        </div>
        {isStaff && !isReadOnly && (
          <div style={{ display: "flex", gap: "10px" }}>
            {activeTab === "gestor" ? (
              isAdmin && <button onClick={() => { setFormPlantilla(emptyPlantilla()); setModalGestor("create"); }} className="btn-red" style={{ padding: "12px 24px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Plus size={18} /> NUEVA PLANTILLA
              </button>
            ) : activeTab === "clientes" ? (
              <button onClick={() => router.push("/admin/planillas/deteccion/nueva?template=true")} className="btn-red" style={{ padding: "12px 24px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Plus size={18} /> NUEVA PLANTILLA DE CLIENTE
              </button>
            ) : (
              <Link href="/admin/planillas/deteccion/nueva" className="btn-red" style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px", textTransform: "uppercase", fontSize: "0.8rem", textDecoration: "none" }}>
                <Plus size={18} strokeWidth={3} /> Nueva IT
              </Link>
            )}
          </div>
        )}
      </header>

      {/* TABS (Segmented Control style) */}
      <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '6px', borderRadius: '14px', marginBottom: '24px', width: 'fit-content' }}>
        <button 
          onClick={() => { setActiveTab("ots"); setSearch(""); }}
          style={{ 
            padding: '10px 18px', borderRadius: '10px', border: '1.5px solid', 
            borderColor: activeTab === "ots" ? '#3b82f6' : '#bfdbfe',
            background: activeTab === "ots" ? '#fff' : '#eff6ff', 
            fontWeight: 800, 
            color: '#3b82f6', 
            cursor: 'pointer', 
            boxShadow: activeTab === "ots" ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none', 
            display: 'flex', alignItems: 'center', gap: '8px',
            transition: '0.3s'
          }}>
          <ClipboardList size={18} strokeWidth={2.5} /> Listado IT
        </button>
        {isAdmin && !isReadOnly && (
          <button
            onClick={() => { setActiveTab("gestor"); setSearch(""); }}
            style={{
              padding: '10px 18px', borderRadius: '10px', border: '1.5px solid',
              borderColor: activeTab === "gestor" ? '#7c3aed' : '#ddd6fe',
              background: activeTab === "gestor" ? '#fff' : '#f5f3ff',
              fontWeight: 800,
              color: '#7c3aed',
              cursor: 'pointer',
              boxShadow: activeTab === "gestor" ? '0 4px 12px rgba(124, 58, 237, 0.15)' : 'none',
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: '0.3s'
            }}>
            <Folder size={18} strokeWidth={2.5} /> Planillas
          </button>
        )}
        {isAdmin && !isReadOnly && (
          <button
            onClick={() => { setActiveTab("clientes"); setFiltroClientePC(""); fetchPlantillasCliente(); fetchPlantillas(); }}
            style={{
              padding: '10px 18px', borderRadius: '10px', border: '1.5px solid',
              borderColor: activeTab === "clientes" ? '#0891b2' : '#a5f3fc',
              background: activeTab === "clientes" ? '#fff' : '#ecfeff',
              fontWeight: 800,
              color: '#0891b2',
              cursor: 'pointer',
              boxShadow: activeTab === "clientes" ? '0 4px 12px rgba(8, 145, 178, 0.15)' : 'none',
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: '0.3s'
            }}>
            <BookMarked size={18} strokeWidth={2.5} /> Plantillas de clientes
          </button>
        )}
      </div>

      {activeTab === "ots" ? (
        <>
          {/* FILTROS OT */}
          <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
            <div style={{ flex: 1, minWidth: "220px" }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>
                {isClient ? "Buscar IT" : "Buscar por IT o Cliente"}
              </label>
              <input type="text" placeholder={isClient ? "Número de OT..." : "N°, cliente o empresa..."} value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.9rem" }} />
            </div>
            <div style={{ width: "160px" }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Desde</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }} />
            </div>
            <div style={{ width: "160px" }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Hasta</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }} />
            </div>
            {/* SEDE FILTER */}
            <div style={{ width: "180px" }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Sede / Obra</label>
              <select 
                value={filtroSede} 
                onChange={e => setFiltroSede(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.85rem", background: "#fff" }}
              >
                <option value="Todas">Todas las sedes</option>
                {isClient ? (
                  currentUser?.sedes?.map((s: any) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)
                ) : (
                  (Array.from(new Set(ots.map(o => o.sedeNombre).filter(Boolean))) as string[]).map(s => <option key={s} value={s}>{s}</option>)
                )}
              </select>
            </div>
            <button onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setFiltroSede("Todas"); }} style={{ padding: "10px 15px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#666" }}>Limpiar</button>
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
                      {["N° IT", "Fecha", "Cliente", "Estado", ""].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOts.map(ot => {
                      const ec = ESTADO_COLORS[ot.estado] || ESTADO_COLORS.borrador;
                      return (
                        <tr key={ot.id} style={{ borderBottom: "1px solid #f2f5f9" }}>
                          <td style={{ padding: "14px 16px", fontWeight: 800, color: "var(--primary-blue)" }}>IT-{String(ot.numero || "?").padStart(4, "0")}</td>
                          <td style={{ padding: "14px 16px", fontSize: "0.85rem" }}>{ot.fecha ? new Date(ot.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-"}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{ot.clienteNombre}</div>
                            <div style={{ fontSize: "0.75rem", color: "#888" }}>{ot.clienteEmpresa}</div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ fontSize: "0.65rem", padding: "4px 8px", borderRadius: "10px", fontWeight: 900, textTransform: "uppercase", background: ec.bg, color: ec.color }}>{(ot.estado === "firmada" ? "completada" : ot.estado).replace("_", " ")}</span>
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                              <Link title="Ver Vista Previa" href={`/admin/planillas/deteccion/${ot.id}?view=true`}
                                style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                                <Eye size={18} strokeWidth={2.5} />
                              </Link>

                              {!isReadOnly && (
                                <Link title="Certificar" href={`/admin/certificados/nuevo?fromOt=${ot.id}`}
                                  style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                                  <Settings size={18} strokeWidth={2.5} />
                                </Link>
                              )}

                              {!isReadOnly && (
                                <Link title="Editar" href={`/admin/planillas/deteccion/${ot.id}`}
                                  style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                                  <Edit size={18} strokeWidth={2.5} />
                                </Link>
                              )}

                              <button title="Descargar PDF" onClick={() => downloadOTPDF(ot.id)}
                                style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", background: "#fff7ed", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                <Scroll size={18} strokeWidth={2.5} />
                              </button>

                              {isAdmin && !isReadOnly && (
                                <button title="Eliminar" onClick={() => setDeleteConfirm({ id: ot.id, type: "ot" })}
                                  style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", background: "#fef2f2", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
        </>
      ) : activeTab === "clientes" ? (
        <>
          {/* FILTRO */}
          <div style={{ background: "#fff", padding: "16px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: "flex", gap: "12px", alignItems: "center", border: "1px solid #eee" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Filtrar por cliente o nombre</label>
              <input type="text" placeholder="Nombre del cliente, empresa o plantilla..." value={filtroClientePC} onChange={e => setFiltroClientePC(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.9rem" }} />
            </div>
            <button onClick={() => setFiltroClientePC("")} style={{ padding: "10px 15px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#666", marginTop: "20px" }}>Limpiar</button>
          </div>

          {/* GRID DE PLANTILLAS DE CLIENTE */}
          {plantillasCliente.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#aaa", background: "#fff", borderRadius: "12px", border: "1px dashed #ddd" }}>
              <BookMarked size={40} style={{ marginBottom: "12px", opacity: 0.3 }} />
              <p style={{ fontWeight: 700 }}>No hay plantillas de cliente guardadas.</p>
              <p style={{ fontSize: "0.85rem", marginTop: "6px" }}>Creá una desde el botón "Nueva Plantilla de Cliente" o guardá la configuración de una IT existente.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
              {plantillasCliente
                .filter(pc => {
                  if (!filtroClientePC) return true;
                  const q = filtroClientePC.toLowerCase();
                  return pc.nombre.toLowerCase().includes(q) || pc.clienteNombre.toLowerCase().includes(q) || (pc.clienteEmpresa || "").toLowerCase().includes(q);
                })
                .map(pc => (
                  <div key={pc.id} style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)", border: "1px solid #eee" }}>
                    <div style={{ marginBottom: "10px" }}>
                      <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "4px" }}>{pc.nombre}</h3>
                      <div style={{ fontSize: "0.82rem", color: "#555", fontWeight: 600 }}>{pc.clienteNombre}{pc.clienteEmpresa ? ` — ${pc.clienteEmpresa}` : ""}</div>
                      {pc.sedeNombre && <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>Sede: {pc.sedeNombre}</div>}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "14px" }}>
                      {(pc.planillas || []).map((p: any, i: number) => (
                        <span key={i} style={{ fontSize: "0.65rem", fontWeight: 800, background: "#f0f4ff", color: "#3b4cca", padding: "3px 8px", borderRadius: "10px" }}>{p.nombre}</span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => router.push(`/admin/planillas/deteccion/nueva?template=true&templateId=${pc.id}`)} style={{ flex: 1, padding: "8px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        <Edit size={14} /> Editar
                      </button>
                      <button onClick={() => setDeleteConfirm({ id: pc.id, type: "plantilla_cliente" })} style={{ padding: "8px 12px", borderRadius: "6px", background: "#fee2e2", color: "#b91c1c", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* MODAL CREAR / EDITAR PLANTILLA DE CLIENTE */}
          {modalPC && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, overflowY: "auto", padding: "40px 20px" }}>
              <div style={{ background: "#fff", borderRadius: "12px", maxWidth: "680px", margin: "0 auto", padding: "30px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                  <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--primary-blue)" }}>{modalPC === "create" ? "Nueva plantilla de cliente" : "Editar plantilla de cliente"}</h2>
                  <button onClick={() => setModalPC(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}><X size={22} /></button>
                </div>

                <div style={{ display: "grid", gap: "16px" }}>
                  <div>
                    <label style={labelStyle}>Nombre de la plantilla *</label>
                    <input style={inputStyle} value={formPC.nombre} onChange={e => setFormPC(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Torre A — Central + Test detectores" />
                  </div>

                  <div style={{ position: "relative" }}>
                    <label style={labelStyle}>Cliente *</label>
                    <input style={inputStyle}
                      value={pcClienteSeleccionado ? (pcClienteSeleccionado.nombre || pcClienteSeleccionado.empresa || pcClienteSeleccionado.email) : pcClienteSearch}
                      onChange={e => { setPcClienteSearch(e.target.value); setPcClienteSeleccionado(null); searchPcClientes(e.target.value); setFormPC(f => ({ ...f, clienteNombre: e.target.value, clienteId: "", sedeId: "", sedeNombre: "" })); setPcSedes([]); }}
                      placeholder="Buscar cliente por nombre o empresa..."
                    />
                    {pcClientesFiltrados.length > 0 && !pcClienteSeleccionado && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "8px", zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "180px", overflowY: "auto" }}>
                        {pcClientesFiltrados.map((c: any) => (
                          <div key={c.id} onClick={() => {
                            setPcClienteSeleccionado(c);
                            setPcClienteSearch("");
                            setPcClientesFiltrados([]);
                            setPcSedes(c.sedes || []);
                            setFormPC(f => ({ ...f, clienteNombre: c.nombre || c.razonSocial || "", clienteId: c.id, clienteEmpresa: c.empresa || "", sedeId: "", sedeNombre: "" }));
                          }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f5f5f5" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f5f7ff"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}>
                            <div style={{ fontWeight: 700 }}>{c.nombre || c.razonSocial}</div>
                            {c.empresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{c.empresa}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {pcSedes.length > 0 && (
                    <div>
                      <label style={labelStyle}>Sede (opcional)</label>
                      <select style={inputStyle} value={formPC.sedeId} onChange={e => {
                        const s = pcSedes.find((x: any) => x.id === e.target.value);
                        setFormPC(f => ({ ...f, sedeId: s?.id || "", sedeNombre: s?.nombre || "" }));
                      }}>
                        <option value="">Sin sede específica</option>
                        {pcSedes.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={labelStyle}>Planillas a incluir *</label>
                    <div style={{ display: "grid", gap: "6px", maxHeight: "220px", overflowY: "auto", padding: "4px" }}>
                      {plantillas.map(p => {
                        const sel = pcPlanillasSeleccionadas.includes(p.id);
                        const catColors: Record<string, string> = { deteccion: "#3b82f6", extincion: "#f97316", matafuegos: "#ef4444", certificaciones: "#7c3aed" };
                        const c = catColors[p.categoria] || "#888";
                        return (
                          <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: `1.5px solid ${sel ? c : "#eee"}`, background: sel ? `${c}10` : "#fafafa", cursor: "pointer" }}>
                            <input type="checkbox" checked={sel} onChange={() => setPcPlanillasSeleccionadas(prev => sel ? prev.filter(x => x !== p.id) : [...prev, p.id])} />
                            <span style={{ fontWeight: 700, fontSize: "0.85rem", color: sel ? c : "#333" }}>{p.nombre}</span>
                            <span style={{ marginLeft: "auto", fontSize: "0.65rem", fontWeight: 800, color: c, background: `${c}15`, padding: "2px 7px", borderRadius: "8px" }}>{p.codigo}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                  <button onClick={() => setModalPC(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
                  <button onClick={handleSavePC} disabled={savingPC} className="btn-red" style={{ flex: 2, padding: "12px" }}>{savingPC ? "Guardando..." : "Guardar plantilla"}</button>
                </div>
              </div>
            </div>
          )}
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
                        <button onClick={() => openEditPlantilla(p)} style={{ flex: 1, padding: "8px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <Edit size={14} /> Editar
                        </button>
                        <button onClick={() => setDeleteConfirm({ id: p.id, type: "plantilla" })} style={{ padding: "8px 12px", borderRadius: "6px", background: "#fee2e2", color: "#b91c1c", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Trash2 size={14} />
                        </button>
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
                <input style={inputStyle} value={formPlantilla.frecuencia} onChange={e => setFormPlantilla(f => ({ ...f, frecuencia: e.target.value as any }))} />
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
                    <button onClick={addColumn} style={{ padding: "8px 15px", borderRadius: "8px", background: "var(--primary-blue)", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={16} />
                    </button>
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

      <Toast {...toast} />
    </div>
  );
}

const labelStyle = { display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "5px", textTransform: "uppercase" as any };
const inputStyle = { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.9rem", marginBottom: "10px" };
const removeBtnStyle = { padding: "8px 12px", borderRadius: "8px", background: "#fee2e2", color: "#b91c1c", border: "none", cursor: "pointer" };
