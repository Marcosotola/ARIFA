"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useToast, Toast } from "@/components/Toast";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, doc, getDoc,
  query, orderBy, serverTimestamp, where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import dynamic from "next/dynamic";
import { 
  ClipboardList, Search, BarChart, FileText, Camera, PenTool, 
  ArrowLeft, Check, Save, Plus, X, Shield, Flame, ChevronRight, ChevronLeft, Download
} from "lucide-react";
import type SignatureCanvasType from "react-signature-canvas";

const SignatureCanvas = dynamic(() => import("react-signature-canvas"), { ssr: false }) as any;

// ─── Types & Helpers ─────────────────────────────────────────────────────────
interface PlantillaItem { id: string; descripcion: string; esGrupo?: boolean; tipoColumna?: string; }
interface Plantilla {
  id: string; codigo: string; nombre: string; categoria: string;
  frecuencia: string; tipo: "checklist" | "tabla_piso";
  modoChecklist?: "ok_nok" | "si_no";
  items?: PlantillaItem[]; columnas?: string[]; infoFields?: string[];
}
interface FilaChecklist { 
    itemId: string; descripcion: string; esGrupo?: boolean; tipoColumna?: string; 
    valor: string; observacion: string; 
    severidad?: "leve" | "moderado" | "critico" | ""; 
}
interface FilaTabla { celdas: Record<string, string>; }
interface PlanillaEnOT {
  plantillaId: string; codigo: string; nombre: string; tipo: string;
  modoChecklist?: string;
  columnas: string[]; infoFields: string[]; infoValues: Record<string, string>;
  filasChecklist: FilaChecklist[];
  filasTabla: FilaTabla[];
}
interface Cliente { id: string; nombre?: string; empresa?: string; razonSocial?: string; direccion?: string; telefono?: string; email?: string; sedes?: any[]; }
interface Tecnico { id: string; nombre?: string; email: string; }
interface TecnicoAsignado { id?: string; nombre: string; manual: boolean; }

const PASOS = ["Encabezado", "Selección", "Gestión", "Obs.", "Fotos", "Firmas"];
const PASOS_ICONS = [
  { icon: ClipboardList, color: "#3b82f6" }, 
  { icon: Search, color: "#10b981" }, 
  { icon: BarChart, color: "#f59e0b" }, 
  { icon: FileText, color: "#7c3aed" }, 
  { icon: Camera, color: "#ec4899" }, 
  { icon: PenTool, color: "#ef4444" }
];

const labelSt: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#555", marginBottom: "5px", textTransform: "uppercase" };
const inputSt: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.92rem", outline: "none" };
const cardSt: React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", marginBottom: "20px" };

function sanitize(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, sanitize(v)]));
  }
  return obj === undefined ? null : obj;
}

const urlToBase64 = async (url: string) => {
    try {
        if (!url || !url.startsWith("http")) return null;
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        const resp = await fetch(proxyUrl);
        if (!resp.ok) throw new Error("Proxy error");
        const blob = await resp.blob();
        return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch { return null; }
};

function OTFormContent() {
  const params = useParams();
  const router = useRouter();
  const isNueva = params.id === "nueva";
  const [role, setRole] = useState<string | null>(null);
  const [paso, setPaso] = useState(0);
  const [saving, setSaving] = useState(false);
  const { toast, showToast } = useToast();
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();
  const isReadOnly = role?.toLowerCase() === "cliente" || searchParams.get("view") === "true";
  const isAdmin = ["admin", "superadmin"].includes(role?.toLowerCase() || "");
  const isAutoDownload = searchParams.get("download") === "true";

  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tecnicosDB, setTecnicosDB] = useState<Tecnico[]>([]);
  const [nextNum, setNextNum] = useState(1);

  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteEmpresa, setClienteEmpresa] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [tecnicosOT, setTecnicosOT] = useState<TecnicoAsignado[]>([]);
  const [estado, setEstado] = useState("borrador");

  const [filtroCat, setFiltroCat] = useState<"Todos" | "Detección" | "Extinción" | "Matafuegos">("Todos");
  const [busquedaPlanilla, setBusquedaPlanilla] = useState("");
  const [planillasEnOT, setPlanillasEnOT] = useState<PlanillaEnOT[]>([]);
  const [nuevaObs, setNuevaObs] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);

  const sigTecRef = useRef<any>(null);
  const sigCliRef = useRef<any>(null);
  const [firmaTecnico, setFirmaTecnico] = useState<string | null>(null);
  const [firmaCliente, setFirmaCliente] = useState<string | null>(null);
  const [nombreFirmaTecnico, setNombreFirmaTecnico] = useState("");
  const [nombreFirmaCliente, setNombreFirmaCliente] = useState("");
  const [filteredSedes, setFilteredSedes] = useState<any[]>([]);
  const [sedeId, setSedeId] = useState("");
  const [sedeNombre, setSedeNombre] = useState("");
  const [sedeRazonSocial, setSedeRazonSocial] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({ 
    nombre: "", 
    apellido: "",
    email: "", 
    empresa: "", 
    dniCuit: "", 
    telefono: "", 
    direccion: "",
    sedes: [] as any[]
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      setRole(userDoc.exists() ? userDoc.data().rol : "cliente");
      const [,,allCli] = await Promise.all([loadPlantillas(), loadTecnicos(), loadClientes(), loadNextNum()]);
      if (!isNueva) await loadOT(allCli);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!loading && isAutoDownload && !isNueva) {
      handlePDF();
    }
  }, [loading, isAutoDownload]);

  const loadPlantillas = async () => {
    const snap = await getDocs(query(collection(db, "plantillas_inspeccion"), orderBy("codigo")));
    const dbPlats = snap.docs.map(d => ({ id: d.id, ...d.data() } as Plantilla));
    setPlantillas(dbPlats);
  };

   const loadClientes = async () => {
    const snap = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente")));
    const clis = snap.docs.map(d => ({ id: d.id, ...d.data() } as Cliente));
    setClientes(clis);
    return clis;
  };

  const loadTecnicos = async () => {
    const snap = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "tecnico")));
    setTecnicosDB(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tecnico)));
  };

  const loadNextNum = async () => {
    const snap = await getDocs(collection(db, "ordenes_trabajo"));
    const nums = snap.docs.map(d => (d.data() as any).numero || 0);
    const m = nums.length ? Math.max(...nums) : 0;
    setNextNum(m + 1);
    if (isNueva) setNumero(String(m + 1));
  };

  const clientesFiltrados = clientes.filter(c =>
    clienteSearch.length < 2 ? false :
    `${c.nombre || ""} ${c.razonSocial || ""} ${c.empresa || ""} ${c.email || ""}`.toLowerCase().includes(clienteSearch.toLowerCase())
  );

   const loadOT = async (allCli?: Cliente[]) => {
    const list = allCli || clientes;
    const d = await getDoc(doc(db, "ordenes_trabajo", params.id as string));
    if (!d.exists()) return;
    const data = d.data() as any;
    setNumero(String(data.numero || ""));
    setFecha(data.fecha || "");
    setEstado(data.estado || "borrador");
    if (data.clienteId) {
      const fullClient = list.find(c => c.id === data.clienteId);
      if (fullClient) {
        setClienteSeleccionado(fullClient);
        setFilteredSedes((fullClient as any).sedes || []);
      } else {
        setClienteSeleccionado({ 
          id: data.clienteId, 
          nombre: data.clienteNombre, 
          empresa: data.clienteEmpresa, 
          direccion: data.clienteDireccion 
        });
      }
    }
    setClienteNombre(data.clienteNombre || "");
    setClienteEmpresa(data.clienteEmpresa || "");
    setClienteDireccion(data.clienteDireccion || "");
    setClienteTelefono(data.clienteTelefono || "");
    setSedeId(data.sedeId || "");
    setSedeNombre(data.sedeNombre || "");
    setSedeRazonSocial(data.sedeRazonSocial || "");
    
    // Migración de datos viejos de técnicos
    if (data.tecnicosOT) { setTecnicosOT(data.tecnicosOT); }
    else if (data.tecnicos) { 
        setTecnicosOT(data.tecnicos.map((t: string) => ({ nombre: t, manual: data.tecnicoManual || false }))); 
    }

    setPlanillasEnOT(data.planillasSeleccionadas || []);
    setNuevaObs(data.diagnostico || "");
    setFotos(data.fotos || []);
    setFirmaTecnico(data.firmaTecnico || null);
    setFirmaCliente(data.firmaCliente || null);
    setNombreFirmaTecnico(data.nombreFirmaTecnico || "");
    setNombreFirmaCliente(data.nombreFirmaCliente || "");
  };

  useEffect(() => {
    if (paso === 5) {
      setTimeout(() => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        [sigTecRef, sigCliRef].forEach(r => {
            const c = r.current?.getCanvas();
            if (c) { 
                c.width = c.offsetWidth * ratio; 
                c.height = c.offsetHeight * ratio; 
                c.getContext("2d")?.scale(ratio, ratio); 
            }
        });
        if (firmaTecnico) { try { sigTecRef.current?.fromDataURL(firmaTecnico); } catch(e) {} }
        if (firmaCliente) { try { sigCliRef.current?.fromDataURL(firmaCliente); } catch(e) {} }
      }, 500);
    }
  }, [paso, firmaTecnico, firmaCliente]);

  const togglePlanilla = (p: Plantilla, checked: boolean) => {
    if (checked) {
      const nueva: PlanillaEnOT = {
        plantillaId: p.id, codigo: p.codigo, nombre: p.nombre, tipo: p.tipo,
        modoChecklist: p.modoChecklist || "ok_nok",
        columnas: p.columnas || [], infoFields: p.infoFields || [], infoValues: {},
        filasChecklist: p.tipo === "checklist" ? (p.items || []).map(it => ({ itemId: it.id, descripcion: it.descripcion, esGrupo: it.esGrupo || false, tipoColumna: it.tipoColumna || "checklist", valor: "", observacion: "", severidad: "" })) : [],
        filasTabla: p.tipo === "tabla_piso" ? [{ celdas: Object.fromEntries((p.columnas || []).map(c => [c, ""])) }] : [],
      };
      setPlanillasEnOT(prev => [...prev, nueva]);
    } else {
      setPlanillasEnOT(prev => prev.filter(x => x.plantillaId !== p.id));
    }
  };

  const updateCelda = (pIdx: number, fIdx: number, col: string, val: string) => {
    const n = [...planillasEnOT];
    n[pIdx].filasTabla[fIdx].celdas[col] = val;
    setPlanillasEnOT(n);
  };

  const handleCreateNewClient = async () => {
    if (!newClientData.nombre || !newClientData.email) { showToast("Nombre y Email son obligatorios.", "error"); return; }
    try {
      const docRef = await addDoc(collection(db, "usuarios"), {
        ...newClientData,
        rol: "cliente",
        createdAt: serverTimestamp()
      });
      const created = { id: docRef.id, ...newClientData };
      setClientes(prev => [...prev, created]);
      setClienteSeleccionado(created);
      setFilteredSedes(newClientData.sedes || []);
      setClienteDireccion(newClientData.direccion || "");
      setClienteTelefono(newClientData.telefono || "");
      setClienteEmpresa(newClientData.empresa || "");
      setShowNewClientModal(false);
      setClienteSearch("");
      setNewClientData({ nombre: "", apellido: "", email: "", empresa: "", dniCuit: "", telefono: "", direccion: "", sedes: [] });
    } catch (e) {
      console.error(e);
      showToast("Error al crear cliente. Intentá de nuevo.", "error");
    }
  };

  const updateChecklist = (pIdx: number, iIdx: number, field: string, val: string) =>
    setPlanillasEnOT(prev => prev.map((x, i) => i === pIdx ? { ...x, filasChecklist: x.filasChecklist.map((f, j) => j === iIdx ? { ...f, [field]: val } : f) } : x));

  const handleFotoUpload = async (e: any) => {
    const files = Array.from(e.target.files || []);
    for (const file of files as File[]) {
      const r = ref(storage, `ots/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      setFotos(prev => [...prev, url]);
    }
  };

  const repararURLsFotos = async () => {
    if (!fotos.length) return;
    showToast("Actualizando URLs...", "info");
    let changed = 0;
    const refreshed: string[] = [];
    for (const url of fotos) {
      try {
        const pathMatch = url.match(/\/o\/(.+?)\?/);
        if (!pathMatch) { refreshed.push(url); continue; }
        const storagePath = decodeURIComponent(pathMatch[1]);
        const freshUrl = await getDownloadURL(ref(storage, storagePath));
        refreshed.push(freshUrl);
        if (freshUrl !== url) changed++;
      } catch {
        refreshed.push(url);
      }
    }
    setFotos(refreshed);
    if (!isNueva) {
      try {
        await updateDoc(doc(db, "ordenes_trabajo", params.id as string), { fotos: refreshed });
        showToast(`${changed} URL${changed !== 1 ? "s" : ""} actualizadas y guardadas`, "success");
      } catch { showToast("URLs actualizadas en pantalla (no se pudo guardar en Firestore)", "info"); }
    }
  };

  const handleSave = async (estadoOverride?: string) => {
    setSaving(true);
    try {
      const p: any = {
        numero: parseInt(numero) || nextNum, fecha,
        clienteId: clienteSeleccionado?.id || null,
        clienteNombre: (clienteSeleccionado?.nombre || clienteNombre) || "",
        clienteEmpresa: (clienteSeleccionado?.empresa || clienteEmpresa) || "",
        clienteDireccion: clienteDireccion || "",
        clienteTelefono: clienteTelefono || "",
        tecnicosOT: tecnicosOT, // Nueva estructura
        estado: estadoOverride || estado || "borrador",
        diagnostico: nuevaObs,
        sedeId,
        sedeNombre,
        sedeRazonSocial,
        planillasSeleccionadas: planillasEnOT, fotos,
        firmaTecnico, firmaCliente, nombreFirmaTecnico, nombreFirmaCliente, updatedAt: serverTimestamp()
      };
      const payload = sanitize(p);
      if (isNueva) { await addDoc(collection(db, "ordenes_trabajo"), { ...payload, createdAt: serverTimestamp() }); }
      else { await updateDoc(doc(db, "ordenes_trabajo", params.id as string), payload); }
      showToast("Orden de trabajo guardada correctamente", "success");
      setTimeout(() => router.push("/admin/planillas"), 1200);
    } catch (e: any) { showToast("Error al guardar. Intentá de nuevo.", "error"); }
    finally { setSaving(false); }
  };

  const handlePDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
    const otNum = String(numero).padStart(4, "0");
    const fecStr = fecha ? new Date(fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";

    let logoPng: string | null = null;
    try {
      const resp = await fetch("/logos/logoFondoTransparente.svg");
      const img = new Image();
      const svgText = await resp.text();
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || 300; c.height = img.naturalHeight || 150;
      c.getContext("2d")!.drawImage(img, 0, 0);
      logoPng = c.toDataURL("image/png");
      URL.revokeObjectURL(url);
    } catch { }

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

    // --- CLIENT DATA ---
    autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR },
        body: [
            [{ content: "CLIENTE / RAZÓN SOCIAL:", styles: { fontStyle: "bold", cellWidth: 45 } }, (clienteSeleccionado?.nombre || clienteNombre || "-")],
            [{ content: "EMPRESA / SEDE:", styles: { fontStyle: "bold" } }, (sedeRazonSocial || clienteSeleccionado?.empresa || clienteEmpresa || "-") + (sedeNombre ? ` - SEDE: ${sedeNombre}` : "")],
            [{ content: "DIRECCIÓN:", styles: { fontStyle: "bold" } }, clienteDireccion || (clienteSeleccionado?.direccion || "-")],
            [{ content: "TELÉFONO / CEL:", styles: { fontStyle: "bold" } }, clienteTelefono || "-"],
        ],
        styles: { fontSize: 9, cellPadding: 3 }, tableLineColor: [0,34,68], tableLineWidth: 0.1
    });
    y = (pdf as any).lastAutoTable.finalY + 8;

    // --- TECHNICIANS SECTION ---
    if (tecnicosOT.length > 0) {
        pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
        pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.setFont("helvetica", "bold");
        pdf.text("EQUIPO TÉCNICO ASIGNADO", ML + 3, y + 5);
        y += 7.5;
        autoTable(pdf, {
            startY: y, margin: { left: ML, right: MR },
            body: tecnicosOT.map(t => [t.nombre]),
            styles: { fontSize: 8.5, cellPadding: 3 }
        });
        y = (pdf as any).lastAutoTable.finalY + 8;
    }

    // --- OBSERVATIONS SUMMARY ---
    const sevColors: any = { leve: [16, 185, 129], moderado: [245, 158, 11], critico: [239, 68, 68] };
    const todasObs = [
        nuevaObs.trim() ? { texto: `[CONGRAL] ${nuevaObs}`, sev: "" } : null,
        ...planillasEnOT.flatMap(p => p.filasChecklist.filter(f => f.observacion && f.observacion.trim()).map(f => ({ texto: `[${p.nombre}] ${f.descripcion}: ${f.observacion}`, sev: f.severidad || "" }))),
    ].filter(Boolean) as any[];

    if (todasObs.length > 0) {
        pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
        pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.text("RESUMEN DE OBSERVACIONES TÉCNICAS", ML + 3, y + 5);
        y += 7.5;
        autoTable(pdf, {
            startY: y, margin: { left: ML, right: MR },
            body: todasObs.map(o => [o.texto, o.sev ? o.sev.toUpperCase() : ""]),
            styles: { fontSize: 8.5, cellPadding: 3 },
            columnStyles: { 1: { cellWidth: 35, halign: 'center', fontStyle: 'bold' } },
            willDrawCell: (data) => {
                if (data.column.index === 1 && data.section === 'body') {
                    const sev = todasObs[data.row.index]?.sev;
                    if (sev && sevColors[sev]) { pdf.setTextColor(sevColors[sev][0], sevColors[sev][1], sevColors[sev][2]); }
                }
            }
        });
        y = (pdf as any).lastAutoTable.finalY + 10;
    }

    // --- PHOTOS ---
    if (fotos.length > 0) {
        if (y > 220) { pdf.addPage(); drawHeader(pdf); y = top + HEADER_H + 10; }
        pdf.setFillColor(240, 240, 240); pdf.rect(ML, y, TW, 7, "F");
        pdf.setFontSize(8.5); pdf.setTextColor(0); pdf.text("REGISTRO FOTOGRÁFICO", ML + 3, y + 5);
        y += 10;
        let xPh = ML;
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

    // --- DETAIL TABLES ---
    for (const p of planillasEnOT) {
        if (y > 240) { pdf.addPage(); drawHeader(pdf); y = top + HEADER_H + 10; }
        pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
        pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.text(`PLANILLA: ${p.nombre}`, ML + 3, y + 5);
        y += 9;
        autoTable(pdf, {
            startY: y, margin: { left: ML, right: MR },
            head: p.tipo === "checklist" ? [["Ítem", "Res.", "Observación", "Prio."]] : [p.columnas],
            body: p.tipo === "checklist" ? p.filasChecklist.filter(f => !f.esGrupo).map(f => [f.descripcion, f.valor.toUpperCase(), f.observacion || "-", f.severidad?.toUpperCase() || "-"]) : p.filasTabla.map(f => p.columnas.map(c => f.celdas[c] || "-")),
            styles: { fontSize: p.tipo === "tabla_piso" && p.columnas.length > 8 ? 6.5 : 7.5, cellPadding: 2 },
            headStyles: { fillColor: [80, 80, 80], overflow: 'linebreak' }, theme: 'grid'
        });
        y = (pdf as any).lastAutoTable.finalY + 10;
    }

    // --- SIGNATURES ---
    if (y > 230) { pdf.addPage(); drawHeader(pdf); y = top + HEADER_H + 10; }
    pdf.setDrawColor(200); pdf.line(ML, y, W-MR, y); y += 5;
    if (firmaTecnico) {
        pdf.addImage(firmaTecnico, "PNG", ML + 10, y, 40, 20);
        pdf.setFontSize(8); pdf.text(`Firma Técnico: ${nombreFirmaTecnico}`, ML + 10, y + 25);
    }
    if (firmaCliente) {
        pdf.addImage(firmaCliente, "PNG", W - MR - 50, y, 40, 20);
        pdf.setFontSize(8); pdf.text(`Firma Cliente: ${nombreFirmaCliente}`, W - MR - 50, y + 25);
    }
    pdf.save(`IT-${otNum}.pdf`);
  };

  const addTecnico = (manual: boolean, nombre: string, id?: string) => {
    if (!nombre.trim()) return;
    setTecnicosOT(prev => [...prev, { id, nombre, manual }]);
  };

  if (loading) return <div style={{ padding: "80px", textAlign: "center" }}>Sincronizando ARIFA...</div>;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", paddingBottom: "100px" }}>
      <header style={{ marginBottom: "25px", display: "flex", justifyContent: "space-between", alignItems: 'center' }}>
        <div>
            <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", marginBottom: "15px" }}>
            <ArrowLeft size={18} /> Volver
          </button>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--primary-blue)" }}>{isNueva ? "Nueva IT" : `IT-${numero}`}</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            {!isNueva && <button onClick={handlePDF} className="btn-blue" style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📄 Descargar PDF
            </button>}
            {!isReadOnly && <button onClick={() => handleSave("completada")} disabled={saving} className="btn-red" style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {saving ? "Guardando..." : <><Check size={18} /> Finalizar</>}
            </button>}
        </div>
      </header>

      {isReadOnly ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: 'var(--primary-blue)', marginBottom: '15px', fontSize: '1.2rem' }}>Resumen del Servicio</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '0.9rem' }}>
              <div><span style={{ fontWeight: 700, color: '#666' }}>Fecha:</span> {fecha ? new Date(fecha + "T12:00:00").toLocaleDateString('es-AR') : '-'}</div>
              <div><span style={{ fontWeight: 700, color: '#666' }}>Estado:</span> <span style={{ textTransform: 'uppercase', fontWeight: 800, fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1' }}>{estado.replace('_', ' ')}</span></div>
              <div style={{ gridColumn: 'span 2' }}><span style={{ fontWeight: 700, color: '#666' }}>Cliente:</span> {clienteSeleccionado?.nombre || clienteNombre}</div>
              <div style={{ gridColumn: 'span 2' }}><span style={{ fontWeight: 700, color: '#666' }}>Ubicación:</span> {clienteSeleccionado?.direccion || clienteDireccion}</div>
            </div>
          </div>

          {planillasEnOT.map((p, pIdx) => (
            <div key={p.plantillaId} style={{ ...cardSt, borderLeft: '5px solid var(--primary-blue)' }}>
              <h3 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px" }}>{p.nombre}</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #eee" }}>
                      <th style={{ padding: "10px", textAlign: "left", fontSize: "0.75rem", color: "#666" }}>{p.tipo === 'checklist' ? 'Ítem' : p.columnas[0]}</th>
                      <th style={{ padding: "10px", textAlign: "center", fontSize: "0.75rem", color: "#666" }}>Resultado</th>
                      <th style={{ padding: "10px", textAlign: "left", fontSize: "0.75rem", color: "#666" }}>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.tipo === 'checklist' ? (
                      p.filasChecklist.map((f, iIdx) => (
                        <tr key={iIdx} style={{ borderBottom: '1px solid #f9f9f9' }}>
                          <td style={{ padding: '10px', fontSize: '0.85rem', fontWeight: f.esGrupo ? 800 : 400, background: f.esGrupo ? '#f1f5f9' : 'transparent' }}>{f.descripcion}</td>
                          {!f.esGrupo && (
                            <>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <span style={{ 
                                  fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '10px',
                                  background: f.valor === 'ok' || f.valor === 'si' ? '#ecfdf5' : f.valor === 'nok' || f.valor === 'no' ? '#fef2f2' : '#f1f5f9',
                                  color: f.valor === 'ok' || f.valor === 'si' ? '#059669' : f.valor === 'nok' || f.valor === 'no' ? '#dc2626' : '#64748b',
                                  textTransform: 'uppercase'
                                }}>{f.valor || '-'}</span>
                              </td>
                              <td style={{ padding: '10px', fontSize: '0.8rem', color: '#666' }}>{f.observacion || '-'}</td>
                            </>
                          )}
                          {f.esGrupo && <td colSpan={2}></td>}
                        </tr>
                      ))
                    ) : (
                      p.filasTabla.map((f, fIdx) => (
                        <tr key={fIdx} style={{ borderBottom: '1px solid #f9f9f9' }}>
                          {p.columnas.map((c, cIdx) => (
                            <td key={cIdx} style={{ padding: '10px', fontSize: '0.85rem' }}>{f.celdas[c] || '-'}</td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {nuevaObs && (
            <div style={cardSt}>
              <h3 style={{ fontWeight: 800, color: 'var(--primary-blue)', marginBottom: '10px', fontSize: '1rem' }}>Observaciones Generales</h3>
              <p style={{ fontSize: '0.9rem', color: '#555', whiteSpace: 'pre-wrap' }}>{nuevaObs}</p>
            </div>
          )}

          {fotos.length > 0 && (
            <div style={cardSt}>
              <h3 style={{ fontWeight: 800, color: 'var(--primary-blue)', marginBottom: '15px', fontSize: '1rem' }}>Registro Fotográfico</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' }}>
                {fotos.map((f, i) => (
                  <img key={i} src={f} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} onClick={() => window.open(f, '_blank')} />
                ))}
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center', padding: '20px' }}>
            <button onClick={handlePDF} className="btn-red" style={{ padding: '15px 40px', fontSize: '1.1rem', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}><Download size={20} /> Descargar Documento Oficial (PDF)</button>
          </div>
        </div>
      ) : (
        <div className="ot-editor-container">
          <div style={{ display: "flex", background: "#fff", borderRadius: "12px", overflow: "hidden", marginBottom: "25px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            {PASOS.map((p, i) => {
              const { icon: Icon, color: stepColor } = PASOS_ICONS[i];
              const isActive = i === paso;
              return (
                <button key={p} onClick={() => setPaso(i)} style={{ 
                  flex: 1, padding: "14px 5px", border: "none", cursor: "pointer", 
                  background: isActive ? stepColor : "#fff", 
                  color: isActive ? "#fff" : "#64748b", 
                  fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} strokeWidth={isActive ? 3 : 2} color={isActive ? "#fff" : stepColor} />
                  </div>
                  <div style={{ fontSize: "0.65rem", opacity: isActive ? 1 : 0.8 }}>{p}</div>
                </button>
              );
            })}
          </div>

      {paso === 0 && (
        <div style={cardSt}>
          <h2 style={{ fontWeight: 800, marginBottom: "20px" }}>Encabezado del Servicio</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div><label style={labelSt}>N° OT</label><input style={inputSt} value={numero} onChange={e => setNumero(e.target.value)} /></div>
            <div><label style={labelSt}>Fecha</label><input style={inputSt} type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            
            <div style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                    <label style={labelSt}>Cliente</label>
                    <button 
                      type="button"
                      onClick={() => setShowNewClientModal(true)}
                      style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#fff', background: 'var(--primary-blue)', border: 'none', fontWeight: 800, padding: '8px 14px', borderRadius: '8px', transition: '0.2s', boxShadow: '0 4px 12px rgba(0, 97, 255, 0.2)' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Plus size={14} strokeWidth={3} /> NUEVO CLIENTE
                    </button>
                </div>
                <div style={{ position: "relative" }}>
                    <input 
                      style={inputSt}
                      placeholder="Nombre, empresa o email..."
                      value={clienteSeleccionado ? (clienteSeleccionado.nombre || clienteSeleccionado.razonSocial || clienteSeleccionado.empresa || clienteSeleccionado.email) : clienteSearch}
                      onChange={e => {
                        setClienteSearch(e.target.value);
                        setClienteSeleccionado(null);
                        setFilteredSedes([]);
                        setSedeId("");
                        setSedeNombre("");
                      }}
                    />
                    {clientesFiltrados.length > 0 && !clienteSeleccionado && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "8px", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "200px", overflowY: "auto", marginTop: "5px" }}>
                        {clientesFiltrados.map(c => (
                          <div key={c.id} onClick={() => {
                            setClienteSeleccionado(c);
                            setClienteSearch("");
                            setFilteredSedes((c as any).sedes || []);
                            setClienteDireccion(c.direccion || "");
                            setClienteTelefono(c.telefono || "");
                            setClienteEmpresa(c.empresa || "");
                          }}
                            style={{ padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#f8f9ff")}
                            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                            <div style={{ fontWeight: 700, color: "var(--primary-blue)" }}>{c.nombre || c.razonSocial || c.email}</div>
                            {c.empresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{c.empresa}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {clienteSeleccionado && (
                      <button 
                        onClick={() => { setClienteSeleccionado(null); setClienteSearch(""); }}
                        style={{ position: 'absolute', right: '12px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '1.2rem' }}>
                        ✕
                      </button>
                    )}
                  </div>
            </div>

            {clienteSeleccionado && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelSt}>Sede / Obra / Consorcio</label>
                <select 
                  style={inputSt} 
                  value={sedeId} 
                  onChange={e => {
                    const s = filteredSedes.find(x => x.id === e.target.value);
                    if (s) {
                      setSedeId(s.id);
                      setSedeNombre(s.nombre);
                      setSedeRazonSocial(s.razonSocial || "");
                      setClienteDireccion(s.direccion || clienteSeleccionado.direccion || "");
                    } else {
                      setSedeId("");
                      setSedeNombre("");
                      setSedeRazonSocial("");
                      setClienteDireccion(clienteSeleccionado.direccion || "");
                    }
                  }}
                >
                  <option value="">{filteredSedes.length === 0 ? "Sin sedes registradas" : "Seleccionar Sede (Opcional)"}</option>
                  {filteredSedes.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.direccion})</option>)}
                </select>
              </div>
            )}

            <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
                <label style={labelSt}>Equipo Técnico Asignado</label>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    {tecnicosOT.length === 0 && <p style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>No hay técnicos asignados.</p>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: tecnicosOT.length > 0 ? '15px' : '0' }}>
                        {tecnicosOT.map((t, idx) => (
                            <div key={idx} style={{ background: '#eff6ff', color: '#1e40af', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #bfdbfe' }}>
                                {t.nombre}
                                <span onClick={() => setTecnicosOT(prev => prev.filter((_, i) => i !== idx))} style={{ cursor: 'pointer', opacity: 0.6 }}>❌</span>
                            </div>
                        ))}
                    </div>
                        <select style={{ ...inputSt, width: '100%' }} onChange={e => {
                            const t = tecnicosDB.find(x => x.id === e.target.value);
                            if (t) { addTecnico(false, t.nombre || t.email, t.id); e.target.value = ""; }
                        }}>
                             <option value="">+ Seleccionar Técnico Registrado...</option>
                             {tecnicosDB.map(t => <option key={t.id} value={t.id}>{t.nombre || t.email}</option>)}
                        </select>
                </div>
            </div>
          </div>
          <button onClick={() => setPaso(1)} className="btn-blue" style={{ marginTop: "25px", width: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Siguiente Step <ChevronRight size={18} /></button>
        </div>
      )}

      {paso === 1 && (
        <div style={cardSt}>
          <h2 style={{ fontWeight: 800, marginBottom: "15px" }}>Selección de Planillas</h2>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: 'wrap' }}>
            {["Todos", "Detección", "Extinción", "Matafuegos"].map((cat: any) => {
              const colors: any = { Detección: "#3b82f6", Extinción: "#f97316", Matafuegos: "#ef4444", Todos: "#64748b" };
              return (
                <button key={cat} onClick={() => setFiltroCat(cat)} style={{ 
                  padding: "8px 16px", borderRadius: "20px", fontWeight: 800, fontSize: "0.7rem", cursor: 'pointer',
                  border: filtroCat === cat ? `2px solid ${colors[cat]}` : "2px solid #eee", 
                  background: filtroCat === cat ? colors[cat] : "#fff", 
                  color: filtroCat === cat ? "#fff" : "#666" 
                }}>{cat === "Detección" ? <Search size={14} /> : cat === "Extinción" ? <Shield size={14} /> : cat === "Matafuegos" ? <Flame size={14} /> : null} {cat.toUpperCase()}</button>
              );
            })}
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {plantillas.filter(p => filtroCat === "Todos" || p.categoria === (filtroCat === "Detección" ? "deteccion" : filtroCat === "Extinción" ? "extincion" : "matafuegos")).filter(p => p.nombre.toLowerCase().includes(busquedaPlanilla.toLowerCase())).map(p => {
                const sel = planillasEnOT.some(x => x.plantillaId === p.id);
                const color = p.categoria === "deteccion" ? "#3b82f6" : p.categoria === "extincion" ? "#f97316" : "#ef4444";
                return (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px", borderRadius: "12px", border: `2px solid ${sel ? color : "#eee"}`, background: sel ? `${color}08` : "#fff", cursor: "pointer" }}>
                    <input type="checkbox" checked={sel} onChange={e => togglePlanilla(p, e.target.checked)} style={{ accentColor: color }} />
                    <div>
                        <div style={{ fontWeight: 800, color: sel ? color : "#334155" }}>{p.nombre}</div>
                        <div style={{ fontSize: "0.6rem", color: color, fontWeight: 900 }}>{p.categoria.toUpperCase()}</div>
                    </div>
                    </label>
                );
            })}
          </div>
          <button onClick={() => setPaso(2)} className="btn-blue" style={{ marginTop: "25px", width: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Cargar Planillas <ChevronRight size={18} /></button>
        </div>
      )}

      {paso === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {planillasEnOT.map((p, pIdx) => (
            <div key={p.plantillaId} style={{ ...cardSt, borderLeft: '5px solid var(--primary-blue)' }}>
              <h3 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px" }}>{p.nombre}</h3>
              {p.tipo === "checklist" ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f0f4ff", borderBottom: "2px solid var(--primary-blue)" }}>
                        <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "0.8rem", fontWeight: 800, color: "var(--primary-blue)", minWidth: "200px" }}>Ítem</th>
                        <th style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.75rem", fontWeight: 900, color: "#16a34a", width: "55px" }}>
                          {p.modoChecklist === "si_no" ? "SI" : "OK"}
                        </th>
                        <th style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.75rem", fontWeight: 900, color: "#dc2626", width: "55px" }}>
                          {p.modoChecklist === "si_no" ? "NO" : "NOK"}
                        </th>
                        <th style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.75rem", fontWeight: 900, color: "#6b7280", width: "55px" }}>N/A</th>
                        <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "0.8rem", fontWeight: 800, color: "#555" }}>Observación / Prioridad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.filasChecklist.map((f, iIdx) => (
                        <tr key={iIdx} style={{ borderBottom: "1px solid #eee", background: f.esGrupo ? "#f8fafc" : "#fff" }}>
                          {f.esGrupo ? (
                            <td colSpan={5} style={{ padding: "10px 12px", fontSize: "0.85rem", fontWeight: 800, color: "var(--primary-blue)", background: "#eef2ff", letterSpacing: "0.3px" }}>
                              {f.descripcion}
                            </td>
                          ) : (
                            <>
                              <td style={{ padding: "10px 12px", fontSize: "0.85rem" }}>{f.descripcion}</td>
                              <td style={{ textAlign: "center", padding: "10px 8px" }}>
                                <input
                                  type="radio"
                                  name={`${pIdx}-${iIdx}`}
                                  checked={f.valor === (p.modoChecklist === "si_no" ? "si" : "ok")}
                                  onChange={() => updateChecklist(pIdx, iIdx, "valor", p.modoChecklist === "si_no" ? "si" : "ok")}
                                  style={{ accentColor: "#16a34a", width: "16px", height: "16px", cursor: "pointer" }}
                                />
                              </td>
                              <td style={{ textAlign: "center", padding: "10px 8px" }}>
                                <input
                                  type="radio"
                                  name={`${pIdx}-${iIdx}`}
                                  checked={f.valor === (p.modoChecklist === "si_no" ? "no" : "nok")}
                                  onChange={() => updateChecklist(pIdx, iIdx, "valor", p.modoChecklist === "si_no" ? "no" : "nok")}
                                  style={{ accentColor: "#dc2626", width: "16px", height: "16px", cursor: "pointer" }}
                                />
                              </td>
                              <td style={{ textAlign: "center", padding: "10px 8px" }}>
                                <input
                                  type="radio"
                                  name={`${pIdx}-${iIdx}`}
                                  checked={f.valor === "na"}
                                  onChange={() => updateChecklist(pIdx, iIdx, "valor", "na")}
                                  style={{ accentColor: "#6b7280", width: "16px", height: "16px", cursor: "pointer" }}
                                />
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                  <input
                                    style={{ ...inputSt, padding: "6px 8px", fontSize: "0.8rem" }}
                                    value={f.observacion}
                                    onChange={e => updateChecklist(pIdx, iIdx, "observacion", e.target.value)}
                                    placeholder="Observación..."
                                  />
                                  {(f.valor === "nok" || f.valor === "no") && (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      {["leve", "moderado", "critico"].map(s => (
                                        <button key={s} onClick={() => updateChecklist(pIdx, iIdx, "severidad", s)} style={{
                                          fontSize: '0.6rem', padding: '3px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                          background: f.severidad === s ? (s === 'leve' ? '#10b981' : s === 'moderado' ? '#f59e0b' : '#ef4444') : '#f1f5f9',
                                          color: f.severidad === s ? '#fff' : '#64748b', fontWeight: 800
                                        }}>{s.toUpperCase()}</button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: "0.75rem", borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: "#f8f9fa" }}>
                      {p.columnas.map(c => <th key={c} style={{ padding: "10px", textAlign: 'left', fontWeight: 800, color: "var(--primary-blue)", borderBottom: "2px solid #eee" }}>{c}</th>)}
                      <th style={{ padding: "10px", textAlign: 'left', fontWeight: 800, color: "#555", borderBottom: "2px solid #eee" }}>Observaciones</th>
                    </tr></thead>
                    <tbody>{p.filasTabla.map((f, fIdx) => (
                        <tr key={fIdx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          {p.columnas.map(c => <td key={c} style={{ padding: "4px" }}><input style={{...inputSt, padding: '5px'}} value={f.celdas[c] || ""} onChange={e => updateCelda(pIdx, fIdx, c, e.target.value)} /></td>)}
                          <td style={{ padding: "4px" }}><input style={{...inputSt, padding: '5px'}} value={f.celdas["__obs__"] || ""} onChange={e => updateCelda(pIdx, fIdx, "__obs__", e.target.value)} placeholder="Obs..." /></td>
                        </tr>
                      ))}</tbody>
                  </table>
                  <button onClick={() => setPlanillasEnOT(prev => prev.map((x, idx) => idx === pIdx ? {...x, filasTabla: [...x.filasTabla, {celdas: {}}]} : x))} style={{ marginTop: '10px', background: '#f1f5f9', border: 'none', padding: '10px', width: '100%', borderRadius: '8px', fontWeight: 800 }}>+ AGREGAR FILA</button>
                </div>
              )}
            </div>
          ))}
          <button onClick={() => setPaso(3)} className="btn-blue" style={{ width: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Siguiente: Observaciones <ChevronRight size={18} /></button>
        </div>
      )}

      {paso === 3 && (
        <div style={cardSt}>
          <h2 style={{ fontWeight: 800, marginBottom: "15px" }}>Observaciones Finales</h2>
          <textarea style={{ ...inputSt, height: "180px" }} value={nuevaObs} onChange={e => setNuevaObs(e.target.value)} placeholder="Conclusiones generales..." />
          <button onClick={() => setPaso(4)} className="btn-blue" style={{ marginTop: "20px", width: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Siguiente: Fotos <ChevronRight size={18} /></button>
        </div>
      )}

      {paso === 4 && (
        <div style={cardSt}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ fontWeight: 800 }}>Registro Fotográfico</h2>
            {fotos.length > 0 && (
              <button onClick={repararURLsFotos} style={{ background: "none", border: "1px solid #f59e0b", color: "#b45309", borderRadius: "6px", padding: "5px 12px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
                Reparar URLs de fotos
              </button>
            )}
          </div>
          <input type="file" multiple onChange={handleFotoUpload} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: '15px' }}>
            {fotos.map((f, i) => (
                <div key={i} style={{ position: 'relative' }}>
                    <img src={f} style={{ width: "100%", borderRadius: "8px", height: '110px', objectFit: 'cover' }} />
                    <button onClick={() => setFotos(prev => prev.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: 5, right: 5, background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px' }}>❌</button>
                </div>
            ))}
          </div>
          <button onClick={() => setPaso(5)} className="btn-blue" style={{ marginTop: "25px", width: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Siguiente: Firmas <ChevronLeft size={18} /></button>
        </div>
      )}

      {paso === 5 && (
        <div style={cardSt}>
           <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "30px" }}>Firmas</h2>
           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", marginBottom: "40px" }}>
             <div>
               <label style={labelSt}>FIRMA TÉCNICO</label>
               <input style={{ ...inputSt, marginBottom: "10px" }} value={nombreFirmaTecnico} onChange={e => setNombreFirmaTecnico(e.target.value)} />
               <div style={{ border: "2px solid #eee", height: "160px", borderRadius: "12px" }}>
                 <SignatureCanvas ref={sigTecRef} penColor="black" canvasProps={{ style: { width: "100%", height: "100%" } }} onEnd={() => setFirmaTecnico(sigTecRef.current.toDataURL())} />
               </div>
             </div>
             <div>
               <label style={labelSt}>FIRMA CLIENTE</label>
               <input style={{ ...inputSt, marginBottom: "10px" }} value={nombreFirmaCliente} onChange={e => setNombreFirmaCliente(e.target.value)} />
               <div style={{ border: "2px solid #eee", height: "160px", borderRadius: "12px" }}>
                 <SignatureCanvas ref={sigCliRef} penColor="black" canvasProps={{ style: { width: "100%", height: "100%" } }} onEnd={() => setFirmaCliente(sigCliRef.current.toDataURL())} />
               </div>
             </div>
           </div>
           <button onClick={() => handleSave("completada")} disabled={saving} className="btn-red" style={{ width: "100%", padding: "20px", fontSize: "1.2rem", borderRadius: '15px', fontWeight: 900 }}>GUARDAR Y FINALIZAR</button>
        </div>
      )}
    </div>
  )}

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
                  }} style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "#4px", padding: "8px", cursor: "pointer" }}>✕</button>
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
      <Toast {...toast} />
</div>
  );
}

export default function OTPage() { return <Suspense><OTFormContent /></Suspense>; }
