"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, doc, getDoc,
  query, orderBy, serverTimestamp, where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import dynamic from "next/dynamic";
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
interface Cliente { id: string; nombre?: string; empresa?: string; razonSocial?: string; direccion?: string; telefono?: string; email?: string; }
interface Tecnico { id: string; nombre?: string; email: string; }
interface TecnicoAsignado { id?: string; nombre: string; manual: boolean; }

const PASOS = ["Encabezado", "Selección", "Gestión", "Obs.", "Fotos", "Firmas"];
const PASOS_ICONS = ["📋", "🔍", "📊", "📝", "📷", "✍️"];

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
  const [loading, setLoading] = useState(true);

  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tecnicosDB, setTecnicosDB] = useState<Tecnico[]>([]);
  const [nextNum, setNextNum] = useState(1);

  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [clienteManual, setClienteManual] = useState(false);
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      setRole(userDoc.exists() ? userDoc.data().rol : "cliente");
      await Promise.all([loadPlantillas(), loadClientes(), loadTecnicos(), loadNextNum()]);
      if (!isNueva) await loadOT();
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loadPlantillas = async () => {
    const snap = await getDocs(query(collection(db, "plantillas_inspeccion"), orderBy("codigo")));
    const dbPlats = snap.docs.map(d => ({ id: d.id, ...d.data() } as Plantilla));
    setPlantillas(dbPlats);
  };

  const loadClientes = async () => {
    const snap = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente")));
    setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cliente)));
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

  const loadOT = async () => {
    const d = await getDoc(doc(db, "ordenes_trabajo", params.id as string));
    if (!d.exists()) return;
    const data = d.data() as any;
    setNumero(String(data.numero || ""));
    setFecha(data.fecha || "");
    setEstado(data.estado || "borrador");
    if (data.clienteId) setClienteSeleccionado({ id: data.clienteId, nombre: data.clienteNombre, empresa: data.clienteEmpresa, direccion: data.clienteDireccion });
    setClienteManual(data.clienteManual || false);
    setClienteNombre(data.clienteNombre || "");
    setClienteEmpresa(data.clienteEmpresa || "");
    setClienteDireccion(data.clienteDireccion || "");
    setClienteTelefono(data.clienteTelefono || "");
    
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

  const updateCelda = (pIdx: number, fIdx: number, col: string, val: string) =>
    setPlanillasEnOT(prev => prev.map((x, i) => i === pIdx ? { ...x, filasTabla: x.filasTabla.map((f, j) => j === fIdx ? { ...f, celdas: { ...f.celdas, [col]: val } } : f) } : x));

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

  const handleSave = async (estadoOverride?: string) => {
    setSaving(true);
    try {
      const p: any = {
        numero: parseInt(numero) || nextNum, fecha,
        clienteId: clienteSeleccionado?.id || null,
        clienteNombre: (clienteSeleccionado?.nombre || clienteNombre) || "",
        clienteEmpresa: (clienteSeleccionado?.empresa || clienteEmpresa) || "",
        clienteDireccion: (clienteSeleccionado?.direccion || clienteDireccion) || "",
        clienteTelefono: clienteTelefono || "",
        clienteManual,
        tecnicosOT: tecnicosOT, // Nueva estructura
        estado: estadoOverride || estado || "borrador",
        diagnostico: nuevaObs,
        planillasSeleccionadas: planillasEnOT, fotos,
        firmaTecnico, firmaCliente, nombreFirmaTecnico, nombreFirmaCliente, updatedAt: serverTimestamp()
      };
      const payload = sanitize(p);
      if (isNueva) { await addDoc(collection(db, "ordenes_trabajo"), { ...payload, createdAt: serverTimestamp() }); }
      else { await updateDoc(doc(db, "ordenes_trabajo", params.id as string), payload); }
      router.push("/admin/planillas/deteccion");
    } catch (e: any) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const handlePDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
    const otNum = String(numero).padStart(4, "0");
    const fecStr = fecha ? new Date(fecha).toLocaleDateString("es-AR") : "-";

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
        pg.text("ORDEN DE TRABAJO", cx, top + 9, { align: "center" });
        pg.setFontSize(14); pg.setTextColor(163, 31, 29); pg.text(`OT-${otNum}`, cx, top + 23, { align: "center" });
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
            [{ content: "EMPRESA:", styles: { fontStyle: "bold" } }, (clienteSeleccionado?.empresa || clienteEmpresa || "-")],
            [{ content: "DIRECCIÓN:", styles: { fontStyle: "bold" } }, clienteSeleccionado?.direccion || clienteDireccion || "-"],
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
    pdf.save(`OT-${otNum}.pdf`);
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
            <button onClick={() => router.push("/admin/planillas/deteccion")} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: '5px' }}>← Volver</button>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--primary-blue)" }}>{isNueva ? "Nueva OT" : `OT-${numero}`}</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            {!isNueva && <button onClick={handlePDF} className="btn-blue" style={{ background: '#f1f5f9', color: '#0f172a' }}>📥 PDF</button>}
            <button onClick={() => handleSave(estado === "firmada" ? "firmada" : "completada")} disabled={saving} className="btn-red">{saving ? "Guardando..." : "Finalizar"}</button>
        </div>
      </header>

      <div style={{ display: "flex", background: "#fff", borderRadius: "12px", overflow: "hidden", marginBottom: "25px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
        {PASOS.map((p, i) => (
          <button key={p} onClick={() => setPaso(i)} style={{ flex: 1, padding: "14px 5px", border: "none", cursor: "pointer", background: i === paso ? "var(--primary-blue)" : "#fff", color: i === paso ? "#fff" : "#94a3b8", fontWeight: 700 }}>
            <div style={{ fontSize: "1.1rem" }}>{PASOS_ICONS[i]}</div>
            <div style={{ fontSize: "0.65rem" }}>{p}</div>
          </button>
        ))}
      </div>

      {paso === 0 && (
        <div style={cardSt}>
          <h2 style={{ fontWeight: 800, marginBottom: "20px" }}>Encabezado del Servicio</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div><label style={labelSt}>N° OT</label><input style={inputSt} value={numero} onChange={e => setNumero(e.target.value)} /></div>
            <div><label style={labelSt}>Fecha</label><input style={inputSt} type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            
            <div style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={labelSt}>Cliente</label>
                    <label style={{ fontSize: '0.75rem', color: 'var(--primary-blue)', fontWeight: 700, cursor: 'pointer' }}><input type="checkbox" checked={clienteManual} onChange={e => setClienteManual(e.target.checked)} /> Carga Manual</label>
                </div>
                {!clienteManual ? (
                  <select style={inputSt} value={clienteSeleccionado?.id || ""} onChange={e => setClienteSeleccionado(clientes.find(x => x.id === e.target.value) || null)}>
                    <option value="">Seleccionar Cliente...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre || c.razonSocial}</option>)}
                  </select>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input style={inputSt} placeholder="Nombre Cliente" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} />
                        <input style={inputSt} placeholder="Empresa / Razón" value={clienteEmpresa} onChange={e => setClienteEmpresa(e.target.value)} />
                        <input style={inputSt} placeholder="Dirección" value={clienteDireccion} onChange={e => setClienteDireccion(e.target.value)} />
                        <input style={inputSt} placeholder="Teléfono" value={clienteTelefono} onChange={e => setClienteTelefono(e.target.value)} />
                    </div>
                )}
            </div>

            <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
                <label style={labelSt}>Equipo Técnico Asignado</label>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    {tecnicosOT.length === 0 && <p style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>No hay técnicos asignados.</p>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: tecnicosOT.length > 0 ? '15px' : '0' }}>
                        {tecnicosOT.map((t, idx) => (
                            <div key={idx} style={{ background: '#eff6ff', color: '#1e40af', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #bfdbfe' }}>
                                {t.nombre}
                                <span onClick={() => setTecnicosOT(prev => prev.filter((_, i) => i !== idx))} style={{ cursor: 'pointer', opacity: 0.6 }}>✕</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select style={{ ...inputSt, flex: 2 }} onChange={e => {
                            const t = tecnicosDB.find(x => x.id === e.target.value);
                            if (t) { addTecnico(false, t.nombre || t.email, t.id); e.target.value = ""; }
                        }}>
                             <option value="">+ Seleccionar Técnico Registrado...</option>
                             {tecnicosDB.map(t => <option key={t.id} value={t.id}>{t.nombre || t.email}</option>)}
                        </select>
                        <button onClick={() => {
                            const m = prompt("Nombre completo del técnico:");
                            if (m) addTecnico(true, m);
                        }} style={{ flex: 1, background: '#fff', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>+ Carga Manual</button>
                    </div>
                </div>
            </div>
          </div>
          <button onClick={() => setPaso(1)} className="btn-blue" style={{ marginTop: "25px", width: "100%" }}>Siguiente Step →</button>
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
                }}>{cat.toUpperCase()}</button>
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
          <button onClick={() => setPaso(2)} className="btn-blue" style={{ marginTop: "25px", width: "100%" }}>Cargar Planillas →</button>
        </div>
      )}

      {paso === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {planillasEnOT.map((p, pIdx) => (
            <div key={p.plantillaId} style={{ ...cardSt, borderLeft: '5px solid var(--primary-blue)' }}>
              <h3 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px" }}>{p.nombre}</h3>
              {p.tipo === "checklist" ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {p.filasChecklist.map((f, iIdx) => (
                      <tr key={iIdx} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "10px", fontSize: "0.85rem", fontWeight: f.esGrupo ? 800 : 400 }}>{f.descripcion}</td>
                        {!f.esGrupo && (
                            <>
                                <td style={{ width: "30px" }}><input type="radio" checked={f.valor === "ok"} onChange={() => updateChecklist(pIdx, iIdx, "valor", "ok")} /></td>
                                <td style={{ width: "30px" }}><input type="radio" checked={f.valor === "nok"} onChange={() => updateChecklist(pIdx, iIdx, "valor", "nok")} /></td>
                                <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <input style={{ ...inputSt, padding: "5px" }} value={f.observacion} onChange={e => updateChecklist(pIdx, iIdx, "observacion", e.target.value)} placeholder="Obs..." />
                                        {f.valor === "nok" && (
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {["leve", "moderado", "critico"].map(s => (
                                                    <button key={s} onClick={() => updateChecklist(pIdx, iIdx, "severidad", s)} style={{ 
                                                        fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                                        background: f.severidad === s ? (s === 'leve' ? '#10b981' : s === 'moderado' ? '#f59e0b' : '#ef4444') : '#f1f5f9',
                                                        color: f.severidad === s ? '#fff' : '#64748b', fontWeight: 800
                                                    }}> {s.toUpperCase()} </button>
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
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: "0.75rem", borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: "#f8f9fa" }}>{p.columnas.map(c => <th key={c} style={{ padding: "10px", textAlign: 'left' }}>{c}</th>)}</tr></thead>
                    <tbody>{p.filasTabla.map((f, fIdx) => (
                         <tr key={fIdx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                           {p.columnas.map(c => <td key={c} style={{ padding: "4px" }}><input style={{...inputSt, padding: '5px'}} value={f.celdas[c] || ""} onChange={e => updateCelda(pIdx, fIdx, c, e.target.value)} /></td>)}
                         </tr>
                      ))}</tbody>
                  </table>
                  <button onClick={() => setPlanillasEnOT(prev => prev.map((x, idx) => idx === pIdx ? {...x, filasTabla: [...x.filasTabla, {celdas: {}}]} : x))} style={{ marginTop: '10px', background: '#f1f5f9', border: 'none', padding: '10px', width: '100%', borderRadius: '8px', fontWeight: 800 }}>+ AGREGAR FILA</button>
                </div>
              )}
            </div>
          ))}
          <button onClick={() => setPaso(3)} className="btn-blue" style={{ width: "100%" }}>Siguiente: Observaciones →</button>
        </div>
      )}

      {paso === 3 && (
        <div style={cardSt}>
          <h2 style={{ fontWeight: 800, marginBottom: "15px" }}>Observaciones Finales</h2>
          <textarea style={{ ...inputSt, height: "180px" }} value={nuevaObs} onChange={e => setNuevaObs(e.target.value)} placeholder="Conclusiones generales..." />
          <button onClick={() => setPaso(4)} className="btn-blue" style={{ marginTop: "20px", width: "100%" }}>Siguiente: Fotos →</button>
        </div>
      )}

      {paso === 4 && (
        <div style={cardSt}>
          <h2 style={{ fontWeight: 800, marginBottom: "20px" }}>Registro Fotográfico</h2>
          <input type="file" multiple onChange={handleFotoUpload} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: '15px' }}>
            {fotos.map((f, i) => (
                <div key={i} style={{ position: 'relative' }}>
                    <img src={f} style={{ width: "100%", borderRadius: "8px", height: '110px', objectFit: 'cover' }} />
                    <button onClick={() => setFotos(prev => prev.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: 5, right: 5, background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px' }}>✕</button>
                </div>
            ))}
          </div>
          <button onClick={() => setPaso(5)} className="btn-blue" style={{ marginTop: "25px", width: "100%" }}>Siguiente: Firmas →</button>
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
           <button onClick={() => handleSave("firmada")} disabled={saving} className="btn-red" style={{ width: "100%", padding: "20px", fontSize: "1.2rem", borderRadius: '15px', fontWeight: 900 }}>GUARDAR Y FINALIZAR</button>
        </div>
      )}
    </div>
  );
}

export default function OTPage() { return <Suspense><OTFormContent /></Suspense>; }
