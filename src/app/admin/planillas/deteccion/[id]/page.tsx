"use client";
import { useEffect, useState, useRef } from "react";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SignatureCanvas = dynamic(() => import("react-signature-canvas"), { ssr: false }) as any;

// ─── Types ───────────────────────────────────────────────────────────────────
interface PlantillaItem { id: string; descripcion: string; esGrupo?: boolean; tipoColumna?: string; }
interface Plantilla {
  id: string; codigo: string; nombre: string; categoria: string;
  frecuencia: string; tipo: "checklist" | "tabla_piso";
  modoChecklist?: "ok_nok" | "si_no";
  items?: PlantillaItem[]; columnas?: string[]; infoFields?: string[];
}
interface FilaChecklist { itemId: string; descripcion: string; esGrupo?: boolean; tipoColumna?: string; valor: string; observacion: string; }
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

const PASOS = ["Cabecera", "Planillas", "Observaciones", "Fotos", "Firmas"];
const PASOS_ICONS = ["📋", "📊", "📝", "📷", "✍️"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const labelSt: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#555", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.4px" };
const inputSt: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.92rem", outline: "none" };
const cardSt: React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", marginBottom: "20px" };

// ─── Component ───────────────────────────────────────────────────────────────
export default function OTPage() {
  const params = useParams();
  const router = useRouter();
  const isNueva = params.id === "nueva";
  const [role, setRole] = useState<string | null>(null);
  const [paso, setPaso] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [nextNum, setNextNum] = useState(1);

  // Form - Cabecera
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [clienteManual, setClienteManual] = useState(false);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteEmpresa, setClienteEmpresa] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [tecnicosSeleccionados, setTecnicosSeleccionados] = useState<string[]>([]);
  const [tecnicoManual, setTecnicoManual] = useState(false);
  const [tecnicoManualNombre, setTecnicoManualNombre] = useState("");
  const [estado, setEstado] = useState("borrador");

  // Filtros del selector de planillas
  const [filtroCat, setFiltroCat] = useState<"all" | "deteccion" | "extincion">("all");
  const [busquedaPlanilla, setBusquedaPlanilla] = useState("");

  // Form - Planillas
  const [planillasEnOT, setPlanillasEnOT] = useState<PlanillaEnOT[]>([]);

  // Form - Observaciones
  const [observacionesExtra, setObservacionesExtra] = useState<string[]>([]);
  const [nuevaObs, setNuevaObs] = useState("");

  // Form - Fotos
  const [fotos, setFotos] = useState<string[]>([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form - Firmas
  const sigTecRef = useRef<any>(null);
  const sigCliRef = useRef<any>(null);
  const [firmaTecnico, setFirmaTecnico] = useState<string | null>(null);
  const [firmaCliente, setFirmaCliente] = useState<string | null>(null);
  const [nombreFirmaTecnico, setNombreFirmaTecnico] = useState("");
  const [nombreFirmaCliente, setNombreFirmaCliente] = useState("");

  // ── Init ──────────────────────────────────────────────────────────────────
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
    setPlantillas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Plantilla)));
  };

  const loadClientes = async () => {
    try {
      const snap = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente")));
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cliente)));
    } catch { /* ok if empty */ }
  };

  const loadTecnicos = async () => {
    try {
      const snap = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "tecnico")));
      setTecnicos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tecnico)));
    } catch { /* ok */ }
  };

  const loadNextNum = async () => {
    try {
      const snap = await getDocs(collection(db, "ordenes_trabajo"));
      const nums = snap.docs.map(d => (d.data() as any).numero || 0);
      setNextNum(nums.length ? Math.max(...nums) + 1 : 1);
      setNumero(String(nums.length ? Math.max(...nums) + 1 : 1));
    } catch { setNumero("1"); }
  };

  const loadOT = async () => {
    try {
      const d = await getDoc(doc(db, "ordenes_trabajo", params.id as string));
      if (!d.exists()) return;
      const data = d.data() as any;
      setNumero(String(data.numero || ""));
      setFecha(data.fecha || "");
      setEstado(data.estado || "borrador");
      if (data.clienteId) setClienteSeleccionado({ id: data.clienteId, nombre: data.clienteNombre, empresa: data.clienteEmpresa, direccion: data.clienteDireccion, telefono: data.clienteTelefono, razonSocial: data.clienteEmpresa, email: "" });
      setClienteManual(data.clienteManual || false);
      setClienteNombre(data.clienteNombre || "");
      setClienteEmpresa(data.clienteEmpresa || "");
      setClienteDireccion(data.clienteDireccion || "");
      setClienteTelefono(data.clienteTelefono || "");
      setTecnicosSeleccionados(data.tecnicos || []);
      setTecnicoManual(data.tecnicoManual || false);
      setTecnicoManualNombre(data.tecnicoManualNombre || "");
      setPlanillasEnOT(data.planillasSeleccionadas || []);
      setObservacionesExtra(data.observacionesExtra || []);
      setFotos(data.fotos || []);
      setFirmaTecnico(data.firmaTecnico || null);
      setFirmaCliente(data.firmaCliente || null);
      setNombreFirmaTecnico(data.nombreFirmaTecnico || "");
      setNombreFirmaCliente(data.nombreFirmaCliente || "");
    } catch (e) { console.error(e); }
  };

  // ── Planillas Helpers ─────────────────────────────────────────────────────
  const togglePlanilla = (p: Plantilla, checked: boolean) => {
    if (checked) {
      const nueva: PlanillaEnOT = {
        plantillaId: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        tipo: p.tipo,
        modoChecklist: p.modoChecklist || "ok_nok",
        columnas: p.columnas || [],
        infoFields: p.infoFields || [],
        infoValues: {},
        filasChecklist: p.tipo === "checklist"
          ? (p.items || []).map(it => ({ itemId: it.id, descripcion: it.descripcion, esGrupo: it.esGrupo, tipoColumna: it.tipoColumna || "checklist", valor: "", observacion: "" }))
          : [],
        filasTabla: p.tipo === "tabla_piso" ? [buildEmptyFila(p)] : [],
      };
      setPlanillasEnOT(prev => [...prev, nueva]);
    } else {
      setPlanillasEnOT(prev => prev.filter(x => x.plantillaId !== p.id));
    }
  };

  const buildEmptyFila = (p: Plantilla): FilaTabla => ({
    celdas: Object.fromEntries((p.columnas || []).map(c => [c, ""])),
  });

  const addFilaTabla = (idx: number) => {
    const p = plantillas.find(pl => pl.id === planillasEnOT[idx].plantillaId)!;
    setPlanillasEnOT(prev => prev.map((x, i) => i === idx ? { ...x, filasTabla: [...x.filasTabla, buildEmptyFila(p)] } : x));
  };

  const removeFilaTabla = (pIdx: number, fIdx: number) =>
    setPlanillasEnOT(prev => prev.map((x, i) => i === pIdx ? { ...x, filasTabla: x.filasTabla.filter((_, j) => j !== fIdx) } : x));

  const updateCelda = (pIdx: number, fIdx: number, col: string, val: string) =>
    setPlanillasEnOT(prev => prev.map((x, i) => i === pIdx ? {
      ...x, filasTabla: x.filasTabla.map((f, j) => j === fIdx ? { ...f, celdas: { ...f.celdas, [col]: val } } : f)
    } : x));

  const updateChecklist = (pIdx: number, iIdx: number, field: "valor" | "observacion", val: string) =>
    setPlanillasEnOT(prev => prev.map((x, i) => i === pIdx ? {
      ...x, filasChecklist: x.filasChecklist.map((f, j) => j === iIdx ? { ...f, [field]: val } : f)
    } : x));

  const updateInfoValue = (pIdx: number, field: string, val: string) =>
    setPlanillasEnOT(prev => prev.map((x, i) => i === pIdx ? { ...x, infoValues: { ...x.infoValues, [field]: val } } : x));

  // ── Observaciones ─────────────────────────────────────────────────────────
  const obsAutomaticas = planillasEnOT.flatMap(p =>
    p.filasChecklist.filter(f => !f.esGrupo && f.observacion.trim())
      .map(f => `[${p.nombre}] ${f.descripcion}: ${f.observacion}`)
  );

  // ── Fotos ─────────────────────────────────────────────────────────────────
  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFoto(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const r = ref(storage, `ots/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        urls.push(await getDownloadURL(r));
      }
      setFotos(prev => [...prev, ...urls]);
    } catch { alert("Error al subir foto."); }
    finally { setUploadingFoto(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  // ── Canvas resize for mobile (fixes touch misalignment) ──────────────────
  const resizeCanvas = (sigRef: React.MutableRefObject<any>) => {
    const canvas = sigRef.current?.getCanvas();
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    sigRef.current.clear();
  };

  useEffect(() => {
    if (paso === 4) {
      setTimeout(() => { resizeCanvas(sigTecRef); resizeCanvas(sigCliRef); }, 100);
    }
  }, [paso]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const sanitize = (v: any) => v === undefined ? null : v;

  const handleSave = async (estadoOverride?: string) => {
    setSaving(true);
    try {
      const tecLista = tecnicoManual
        ? (tecnicoManualNombre.trim() ? [tecnicoManualNombre.trim()] : [])
        : tecnicosSeleccionados;
      const payload: any = {
        numero: parseInt(numero) || nextNum,
        fecha: sanitize(fecha),
        clienteId: sanitize(clienteSeleccionado?.id) ?? null,
        clienteNombre: sanitize(clienteSeleccionado?.nombre || clienteSeleccionado?.razonSocial || clienteNombre) || "",
        clienteEmpresa: sanitize(clienteSeleccionado?.empresa || clienteSeleccionado?.razonSocial || clienteEmpresa) || "",
        clienteDireccion: sanitize(clienteSeleccionado?.direccion || clienteDireccion) || "",
        clienteTelefono: sanitize(clienteSeleccionado?.telefono || clienteTelefono) || "",
        clienteManual,
        tecnicos: tecLista,
        tecnicoManual,
        tecnicoManualNombre: tecnicoManualNombre || "",
        estado: estadoOverride || estado,
        planillasSeleccionadas: planillasEnOT,
        observacionesExtra,
        fotos,
        firmaTecnico: sanitize(firmaTecnico),
        firmaCliente: sanitize(firmaCliente),
        nombreFirmaTecnico: nombreFirmaTecnico || "",
        nombreFirmaCliente: nombreFirmaCliente || "",
        updatedAt: serverTimestamp(),
      };
      if (isNueva) {
        await addDoc(collection(db, "ordenes_trabajo"), { ...payload, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, "ordenes_trabajo", params.id as string), payload);
      }
      router.push("/admin/planillas/deteccion");
    } catch (e) { alert("Error al guardar: " + e); }
    finally { setSaving(false); }
  };

  // ── PDF ───────────────────────────────────────────────────────────────────
  const handlePDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
    const otNum = String(numero).padStart(4, "0");
    const fecStr = fecha ? new Date(fecha).toLocaleDateString("es-AR") : "-";
    const cn = clienteSeleccionado?.nombre || clienteSeleccionado?.razonSocial || clienteNombre || "-";
    const ce = clienteSeleccionado?.empresa || clienteEmpresa || "";
    const cd = clienteSeleccionado?.direccion || clienteDireccion || "";
    const ct = clienteSeleccionado?.telefono || clienteTelefono || "";
    const tecLista = tecnicoManual ? tecnicoManualNombre : tecnicosSeleccionados.join(", ");

    // ── Logo SVG → PNG ───────────────────────────────────────────────────────
    let logoPng: string | null = null;
    try {
      const resp = await fetch("/logos/logoFondoTransparente.svg");
      const svgText = await resp.text();
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || 300; c.height = img.naturalHeight || 150;
      c.getContext("2d")!.drawImage(img, 0, 0);
      logoPng = c.toDataURL("image/png");
      URL.revokeObjectURL(url);
    } catch { /* no logo */ }

    // ── Institutional header ───────────────────────────────────────────────────
    const HEADER_H = 30;
    const drawPageHeader = (pg: any): number => {
      const top = 10;
      pg.setDrawColor(0, 34, 68); pg.setLineWidth(0.5);
      pg.rect(ML, top, TW, HEADER_H);

      // Logo cell
      if (logoPng) pg.addImage(logoPng, "PNG", ML + 1, top + 2, 30, 26);
      pg.line(ML + 33, top, ML + 33, top + HEADER_H);

      // Center cell
      const rx = W - MR - 48;
      const cx = ML + 33 + (rx - ML - 33) / 2;
      pg.setFont(undefined as any, "bold"); pg.setFontSize(9); pg.setTextColor(0, 34, 68);
      pg.text("Orden de Trabajo — Inspección", cx, top + 9, { align: "center" });
      pg.text("Seguridad Contra Incendios", cx, top + 15, { align: "center" });
      pg.setFontSize(13); pg.setTextColor(163, 31, 29);
      pg.text(`OT-${otNum}`, cx, top + 23, { align: "center" });

      // Right info cell (48mm wide)
      pg.line(rx, top, rx, top + HEADER_H);
      const rRows = [["Fecha:", fecStr], ["Estado:", estado.toUpperCase()], ["Categ.:", "DETECCIÓN"]];
      rRows.forEach(([k, v], i) => {
        const ry = top + 7 + i * 7;
        pg.setFont(undefined as any, "bold"); pg.setFontSize(7); pg.setTextColor(0);
        pg.text(k, rx + 2, ry);
        pg.setFont(undefined as any, "normal"); pg.setFontSize(7);
        pg.text(v, rx + 18, ry);
        if (i < 2) pg.line(rx, ry + 2, W - MR, ry + 2);
      });

      // Footer bar
      pg.line(ML, top + HEADER_H - 6, W - MR, top + HEADER_H - 6);
      pg.setFont(undefined as any, "normal"); pg.setFontSize(7); pg.setTextColor(80);
      pg.text("Ingeniería contra Incendio", ML + 2, top + HEADER_H - 2);
      pg.setFont(undefined as any, "bold"); pg.setFontSize(7); pg.setTextColor(0);
      const pn = pg.getCurrentPageInfo().pageNumber;
      pg.text(`Página  ${pn}`, rx + 2, top + HEADER_H - 2);

      return top + HEADER_H + 6;
    };

    // ── PAGE 1 ────────────────────────────────────────────────────────────────
    let y = drawPageHeader(pdf);

    // Client & technician data table
    autoTable(pdf, {
      startY: y, margin: { left: ML, right: MR },
      body: [
        [{ content: "Cliente:", styles: { fontStyle: "bold", cellWidth: 42 } }, { content: cn + (ce ? ` — ${ce}` : ""), colSpan: 3 }],
        [{ content: "Domicilio:", styles: { fontStyle: "bold" } }, cd || "-",
         { content: "Teléfono:", styles: { fontStyle: "bold", cellWidth: 28 } }, ct || "-"],
        [{ content: "Técnico(s):", styles: { fontStyle: "bold" } }, { content: tecLista || "-", colSpan: 3 }],
      ],
      styles: { fontSize: 9, cellPadding: 4 },
      tableLineColor: [0, 34, 68], tableLineWidth: 0.3,
    });
    y = (pdf as any).lastAutoTable.finalY + 8;

    // Observations
    const allObs = [...obsAutomaticas, ...observacionesExtra].filter(Boolean);
    if (allObs.length) {
      if (y > 245) { pdf.addPage(); y = drawPageHeader(pdf); }
      autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR },
        head: [["#", "Observaciones del Servicio"]],
        body: allObs.map((o, i) => [i + 1, o]),
        styles: { fontSize: 8 }, headStyles: { fillColor: [163, 31, 29] },
        columnStyles: { 0: { cellWidth: 10, halign: "center" } },
      });
      y = (pdf as any).lastAutoTable.finalY + 8;
    }

    // Planillas
    for (const p of planillasEnOT) {
      if (y > 230) { pdf.addPage(); y = drawPageHeader(pdf); }

      // Section title bar
      pdf.setFillColor(0, 34, 68);
      pdf.rect(ML, y, TW, 8, "F");
      pdf.setFont(undefined as any, "bold"); pdf.setFontSize(9); pdf.setTextColor(255);
      pdf.text(`${p.codigo} — ${p.nombre}`, ML + 3, y + 5.5);
      y += 10;

      // Info fields
      const infoEntries = Object.entries(p.infoValues).filter(([, v]) => v);
      if (infoEntries.length) {
        autoTable(pdf, {
          startY: y, margin: { left: ML, right: MR },
          body: infoEntries.map(([k, v]) => [{ content: k + ":", styles: { fontStyle: "bold", cellWidth: 55 } }, v]),
          styles: { fontSize: 8, cellPadding: 2 },
          tableLineColor: [200, 200, 200], tableLineWidth: 0.2,
        });
        y = (pdf as any).lastAutoTable.finalY + 4;
      }

      if (p.tipo === "checklist") {
        const esSiNo = (p as any).modoChecklist === "si_no";
        const lbl1 = esSiNo ? "SI" : "OK"; const lbl2 = esSiNo ? "NO" : "NOK";
        autoTable(pdf, {
          startY: y, margin: { left: ML, right: MR },
          head: [["Ítem de inspección", "Resultado", "Observaciones"]],
          body: p.filasChecklist.map(f => {
            if (f.esGrupo) return [{ content: f.descripcion, colSpan: 3, styles: { fillColor: [224, 231, 238], fontStyle: "bold", textColor: [0, 34, 68] } }];
            const tc = (f as any).tipoColumna || "checklist";
            let res = "";
            if (tc === "tiempo") res = f.valor ? `${f.valor} seg` : "-";
            else if (tc === "texto") res = f.valor || "-";
            else res = f.valor === "ok" ? `✔ ${lbl1}` : f.valor === "nok" ? `✘ ${lbl2}` : f.valor === "na" ? "N/A" : "-";
            return [f.descripcion, res, f.observacion || ""];
          }),
          styles: { fontSize: 8 }, headStyles: { fillColor: [0, 34, 68] },
          columnStyles: { 1: { halign: "center", cellWidth: 28 }, 2: { cellWidth: 45 } },
        });
      } else {
        autoTable(pdf, {
          startY: y, margin: { left: ML, right: MR },
          head: [p.columnas],
          body: p.filasTabla.map(f => p.columnas.map(c => f.celdas[c] || "")),
          styles: { fontSize: 7 }, headStyles: { fillColor: [0, 34, 68] },
        });
      }
      y = (pdf as any).lastAutoTable.finalY + 10;
    }

    // ── Fotos ─────────────────────────────────────────────────────────────────
    if (fotos.length) {
      if (y > 185) { pdf.addPage(); y = drawPageHeader(pdf); }
      pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 8, "F");
      pdf.setFont(undefined as any, "bold"); pdf.setFontSize(9); pdf.setTextColor(255);
      pdf.text("REGISTRO FOTOGRÁFICO", ML + 3, y + 5.5); y += 12;
      let col = 0;
      const imgW = (TW - 6) / 2;
      for (const url of fotos) {
        try {
          // Route through server proxy to bypass Firebase Storage CORS restrictions
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = (e) => rej(e);
            img.src = proxyUrl;
          });
          const cnv = document.createElement("canvas");
          const maxW = 1200; const maxH = 900;
          const ratio = Math.min(maxW / (img.naturalWidth || maxW), maxH / (img.naturalHeight || maxH), 1);
          cnv.width = Math.round((img.naturalWidth || maxW) * ratio);
          cnv.height = Math.round((img.naturalHeight || maxH) * ratio);
          cnv.getContext("2d")!.drawImage(img, 0, 0, cnv.width, cnv.height);
          const du = cnv.toDataURL("image/jpeg", 0.82);
          pdf.addImage(du, "JPEG", ML + col * (imgW + 6), y, imgW, 56);
          col++; if (col === 2) { col = 0; y += 60; }
          if (y > 235) { pdf.addPage(); y = drawPageHeader(pdf); col = 0; }
        } catch { /* skip failed image */ }
      }
      if (col > 0) y += 60;
      y += 6;
    }

    // ── Firmas ────────────────────────────────────────────────────────────────
    if (y > 220) { pdf.addPage(); y = drawPageHeader(pdf); }
    const bw = (TW - 8) / 2;
    pdf.setDrawColor(0, 34, 68); pdf.setLineWidth(0.3);
    pdf.rect(ML, y, bw, 34); pdf.rect(ML + bw + 8, y, bw, 34);
    pdf.setFont(undefined as any, "normal"); pdf.setFontSize(8); pdf.setTextColor(80);
    pdf.text("Técnico Responsable", ML + 2, y + 4);
    if (nombreFirmaTecnico) { pdf.setFont(undefined as any, "bold"); pdf.setFontSize(8.5); pdf.setTextColor(0, 34, 68); pdf.text(nombreFirmaTecnico, ML + 2, y + 9); }
    pdf.setFont(undefined as any, "normal"); pdf.setFontSize(8); pdf.setTextColor(80);
    pdf.text("Cliente / Comitente", ML + bw + 10, y + 4);
    if (nombreFirmaCliente) { pdf.setFont(undefined as any, "bold"); pdf.setFontSize(8.5); pdf.setTextColor(0, 34, 68); pdf.text(nombreFirmaCliente, ML + bw + 10, y + 9); }
    if (firmaTecnico) try { pdf.addImage(firmaTecnico, "PNG", ML + 3, y + 11, bw - 6, 20); } catch { /* skip */ }
    if (firmaCliente) try { pdf.addImage(firmaCliente, "PNG", ML + bw + 11, y + 11, bw - 6, 20); } catch { /* skip */ }

    // ── Página numbers in all pages ───────────────────────────────────────────
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7); pdf.setTextColor(160);
      pdf.text(`ARIFA  ·  OT-${otNum}  ·  Pág. ${i}/${total}`, W / 2, 296, { align: "center" });
    }

    pdf.save(`ARIFA-OT-${otNum}.pdf`);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Cargando...</div>;

  const clientesFiltrados = clientes.filter(c =>
    clienteSearch.length < 2 ? false :
    `${c.nombre || ""} ${c.razonSocial || ""} ${c.empresa || ""} ${c.email || ""}`.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: "900px" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <button onClick={() => router.push("/admin/planillas/deteccion")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "5px" }}>
            ← Volver al listado
          </button>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--primary-blue)" }}>
            {isNueva ? "Nueva Orden de Trabajo" : `OT-${String(numero).padStart(4, "0")}`}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={handlePDF} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid var(--primary-blue)", background: "transparent", color: "var(--primary-blue)", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" }}>
            📥 Descargar PDF
          </button>
          <button onClick={() => handleSave("completada")} disabled={saving} className="btn-red" style={{ padding: "10px 20px" }}>
            {saving ? "Guardando..." : "💾 Guardar"}
          </button>
        </div>
      </div>

      {/* ── Stepper (scrollable en mobile) ── */}
      <div style={{ overflowX: "auto", marginBottom: "28px", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        <div style={{ display: "flex", minWidth: "420px", background: "#fff", borderRadius: "10px", overflow: "hidden" }}>
          {PASOS.map((p, i) => (
            <button key={p} onClick={() => setPaso(i)}
              style={{ flex: 1, padding: "14px 8px", border: "none", cursor: "pointer", fontWeight: i === paso ? 800 : 500, fontSize: "0.8rem",
                background: i === paso ? "var(--primary-blue)" : i < paso ? "#e8f0ff" : "#fff",
                color: i === paso ? "#fff" : i < paso ? "var(--primary-blue)" : "#999",
                borderRight: i < PASOS.length - 1 ? "1px solid #eee" : "none", transition: "0.2s",
                minWidth: "76px"
              }}>
              <div style={{ fontSize: "1.2rem", marginBottom: "3px" }}>
                {i < paso ? "✓" : PASOS_ICONS[i]}
              </div>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ PASO 0: CABECERA ══════════ */}
      {paso === 0 && (
        <div>
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "20px", fontSize: "1rem" }}>Datos de la Orden</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelSt}>N° de OT</label>
                <input style={inputSt} value={numero} onChange={e => setNumero(e.target.value)} type="number" min="1" />
              </div>
              <div>
                <label style={labelSt}>Fecha</label>
                <input style={inputSt} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelSt}>Estado</label>
                <select style={inputSt} value={estado} onChange={e => setEstado(e.target.value)}>
                  <option value="borrador">Borrador</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="completada">Completada</option>
                </select>
              </div>
            </div>
          </div>

          <div style={cardSt}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "1rem" }}>Datos del Cliente</h2>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                <input type="checkbox" checked={clienteManual} onChange={e => { setClienteManual(e.target.checked); setClienteSeleccionado(null); setClienteSearch(""); }} />
                Carga manual
              </label>
            </div>

            {!clienteManual ? (
              <div style={{ position: "relative" }}>
                <label style={labelSt}>Buscar cliente registrado</label>
                <input style={inputSt} value={clienteSeleccionado ? (clienteSeleccionado.nombre || clienteSeleccionado.razonSocial || clienteSeleccionado.email) : clienteSearch}
                  onChange={e => { setClienteSearch(e.target.value); setClienteSeleccionado(null); }}
                  placeholder="Nombre, empresa o email..." />
                {clientesFiltrados.length > 0 && !clienteSeleccionado && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "8px", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "200px", overflowY: "auto" }}>
                    {clientesFiltrados.map(c => (
                      <div key={c.id} onClick={() => { setClienteSeleccionado(c); setClienteSearch(""); }}
                        style={{ padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8f9ff")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{c.nombre || c.razonSocial || c.email}</div>
                        {c.empresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{c.empresa}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {clienteSeleccionado && (
                  <div style={{ marginTop: "10px", background: "#f0f4ff", borderRadius: "8px", padding: "12px 15px", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{clienteSeleccionado.nombre || clienteSeleccionado.razonSocial}</div>
                      <div style={{ fontSize: "0.8rem", color: "#666" }}>{clienteSeleccionado.empresa} — {clienteSeleccionado.direccion}</div>
                    </div>
                    <button onClick={() => setClienteSeleccionado(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}>✕</button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {[["clienteNombre", "Nombre / Contacto", clienteNombre, setClienteNombre],
                  ["clienteEmpresa", "Empresa / Establecimiento", clienteEmpresa, setClienteEmpresa],
                  ["clienteDireccion", "Dirección", clienteDireccion, setClienteDireccion],
                  ["clienteTelefono", "Teléfono", clienteTelefono, setClienteTelefono],
                ].map(([, lbl, val, fn]: any) => (
                  <div key={lbl as string}>
                    <label style={labelSt}>{lbl as string}</label>
                    <input style={inputSt} value={val as string} onChange={e => fn(e.target.value)} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={cardSt}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "1rem" }}>Técnico(s)</h2>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                <input type="checkbox" checked={tecnicoManual} onChange={e => { setTecnicoManual(e.target.checked); setTecnicosSeleccionados([]); }} />
                Carga manual
              </label>
            </div>
            {!tecnicoManual ? (
              <>
                {tecnicos.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: "10px" }}>No hay técnicos registrados en el sistema.</p>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {tecnicos.map(t => {
                    const nombre = t.nombre || t.email;
                    const sel = tecnicosSeleccionados.includes(nombre);
                    return (
                      <button key={t.id} onClick={() => setTecnicosSeleccionados(prev => sel ? prev.filter(x => x !== nombre) : [...prev, nombre])}
                        style={{ padding: "9px 16px", borderRadius: "20px", border: `2px solid ${sel ? "var(--primary-blue)" : "#ddd"}`, background: sel ? "var(--primary-blue)" : "#fff", color: sel ? "#fff" : "#555", fontWeight: sel ? 700 : 500, cursor: "pointer", fontSize: "0.88rem", transition: "0.2s" }}>
                        {sel ? "✓ " : ""}{nombre}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div>
                <label style={labelSt}>Nombre del técnico</label>
                <input style={inputSt} value={tecnicoManualNombre} onChange={e => setTecnicoManualNombre(e.target.value)} placeholder="Nombre y apellido del técnico..." />
              </div>
            )}
          </div>

          <div style={{ textAlign: "right" }}>
            <button onClick={() => setPaso(1)} className="btn-blue" style={{ padding: "12px 28px" }}>Siguiente → Planillas</button>
          </div>
        </div>
      )}

      {/* ══════════ PASO 1: PLANILLAS ══════════ */}
      {paso === 1 && (
        <div>
          {/* Selector con filtros */}
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "6px", fontSize: "1rem" }}>Seleccionar planillas para esta OT</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>Marcá todas las que aplican al trabajo de hoy.</p>

            {/* Buscador */}
            <input
              style={{ ...inputSt, marginBottom: "14px" }}
              value={busquedaPlanilla}
              onChange={e => setBusquedaPlanilla(e.target.value)}
              placeholder="🔎 Buscar planilla por nombre o código..."
            />

            {/* Tabs de categoría */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {(["all", "deteccion", "extincion"] as const).map(cat => (
                <button key={cat} onClick={() => setFiltroCat(cat)}
                  style={{ padding: "7px 16px", borderRadius: "20px", border: `2px solid ${filtroCat === cat ? "var(--primary-blue)" : "#ddd"}`,
                    background: filtroCat === cat ? "var(--primary-blue)" : "#fff",
                    color: filtroCat === cat ? "#fff" : "#666",
                    fontWeight: filtroCat === cat ? 700 : 500, fontSize: "0.82rem", cursor: "pointer", transition: "0.2s" }}>
                  {cat === "all" ? "Todas" : cat === "deteccion" ? "🔍 Detección" : "🧯 Extinción"}
                </button>
              ))}
            </div>

            {plantillas.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No hay plantillas. Creá algunas en <strong>Gestión de Plantillas</strong>.</p>
            ) : (() => {
              const filtradas = plantillas.filter(p => {
                const matchCat = filtroCat === "all" || p.categoria === filtroCat;
                const matchBusq = busquedaPlanilla.trim() === "" ||
                  p.nombre.toLowerCase().includes(busquedaPlanilla.toLowerCase()) ||
                  p.codigo.toLowerCase().includes(busquedaPlanilla.toLowerCase());
                return matchCat && matchBusq;
              });

              if (filtradas.length === 0) return (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "16px 0" }}>No se encontraron planillas con ese filtro.</p>
              );

              return (
                <div style={{ display: "grid", gap: "8px" }}>
                  {filtradas.map(p => {
                    const sel = planillasEnOT.some(x => x.plantillaId === p.id);
                    return (
                      <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderRadius: "10px",
                        border: `2px solid ${sel ? "var(--primary-blue)" : "#eee"}`,
                        background: sel ? "#f0f4ff" : "#fff", cursor: "pointer", transition: "0.2s" }}>
                        <input type="checkbox" checked={sel} onChange={e => togglePlanilla(p, e.target.checked)} style={{ width: "20px", height: "20px", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.92rem", color: sel ? "var(--primary-blue)" : "var(--text-dark)" }}>{p.nombre}</div>
                          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "3px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ background: p.categoria === "deteccion" ? "#e3f2fd" : "#fff3e0", color: p.categoria === "deteccion" ? "#1565c0" : "#e65100", padding: "1px 7px", borderRadius: "10px", fontWeight: 600 }}>
                              {p.categoria === "deteccion" ? "🔍 Detección" : "🧯 Extinción"}
                            </span>
                            <span>{p.codigo}</span>
                            <span>·</span>
                            <span style={{ textTransform: "capitalize" }}>{p.frecuencia}</span>
                            <span>·</span>
                            <span>{p.tipo === "checklist" ? "Checklist" : "Tabla por piso"}</span>
                          </div>
                        </div>
                        {sel && <span style={{ fontSize: "1.2rem", color: "var(--primary-blue)", flexShrink: 0 }}>✓</span>}
                      </label>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Fill in selected planillas */}
          {planillasEnOT.map((p, pIdx) => (
            <div key={p.plantillaId} style={{ ...cardSt, border: "2px solid var(--primary-blue)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--primary-red)", background: "#fff1f0", padding: "2px 8px", borderRadius: "4px" }}>{p.codigo}</span>
                  <h3 style={{ fontWeight: 800, color: "var(--primary-blue)", marginTop: "6px" }}>{p.nombre}</h3>
                </div>
              </div>

              {/* Info fields */}
              {p.infoFields.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px", background: "#f8f9fc", padding: "14px", borderRadius: "8px" }}>
                  {p.infoFields.map(field => (
                    <div key={field}>
                      <label style={labelSt}>{field}</label>
                      <input style={inputSt} value={p.infoValues[field] || ""} onChange={e => updateInfoValue(pIdx, field, e.target.value)} />
                    </div>
                  ))}
                </div>
              )}

              {/* CHECKLIST */}
              {p.tipo === "checklist" && (() => {
                const esSiNo = p.modoChecklist === "si_no";
                const label1 = esSiNo ? "SI" : "OK";
                const label2 = esSiNo ? "NO" : "NOK";
                return (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                      <thead>
                        <tr style={{ background: "#002244", color: "#fff" }}>
                          <th style={{ textAlign: "left", padding: "10px 12px" }}>\u00cdtem de inspecci\u00f3n</th>
                          <th style={{ textAlign: "center", padding: "10px 8px", minWidth: 50 }}>{label1}</th>
                          <th style={{ textAlign: "center", padding: "10px 8px", minWidth: 50 }}>{label2}</th>
                          <th style={{ textAlign: "center", padding: "10px 8px", minWidth: 50 }}>N/A</th>
                          <th style={{ textAlign: "left", padding: "10px 12px", minWidth: 150 }}>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.filasChecklist.map((fila, iIdx) => fila.esGrupo ? (
                          <tr key={iIdx} style={{ background: "#e0e7ee" }}>
                            <td colSpan={5} style={{ padding: "8px 12px", fontWeight: 800, color: "#002244", fontSize: "0.85rem" }}>{fila.descripcion}</td>
                          </tr>
                        ) : fila.tipoColumna === "tiempo" ? (
                          <tr key={iIdx} style={{ borderBottom: "1px solid #f0f0f0", background: iIdx % 2 === 0 ? "#fff" : "#fafbff" }}>
                            <td style={{ padding: "10px 12px" }}>{fila.descripcion}</td>
                            <td colSpan={3} style={{ padding: "8px", textAlign: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                <input type="number" min="0" placeholder="segundos"
                                  style={{ ...inputSt, width: "110px", padding: "7px 10px", textAlign: "center" }}
                                  value={fila.valor} onChange={e => updateChecklist(pIdx, iIdx, "valor", e.target.value)} />
                                <span style={{ fontSize: "0.75rem", color: "#888" }}>seg</span>
                              </div>
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <input style={{ ...inputSt, padding: "7px 10px", fontSize: "0.82rem" }} value={fila.observacion} onChange={e => updateChecklist(pIdx, iIdx, "observacion", e.target.value)} placeholder="Obs..." />
                            </td>
                          </tr>
                        ) : fila.tipoColumna === "texto" ? (
                          <tr key={iIdx} style={{ borderBottom: "1px solid #f0f0f0", background: iIdx % 2 === 0 ? "#fff" : "#fafbff" }}>
                            <td style={{ padding: "10px 12px" }}>{fila.descripcion}</td>
                            <td colSpan={3} style={{ padding: "8px" }}>
                              <input style={{ ...inputSt, padding: "7px 10px", fontSize: "0.82rem" }} value={fila.valor} onChange={e => updateChecklist(pIdx, iIdx, "valor", e.target.value)} placeholder="Valor..." />
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <input style={{ ...inputSt, padding: "7px 10px", fontSize: "0.82rem" }} value={fila.observacion} onChange={e => updateChecklist(pIdx, iIdx, "observacion", e.target.value)} placeholder="Obs..." />
                            </td>
                          </tr>
                        ) : (
                          <tr key={iIdx} style={{ borderBottom: "1px solid #f0f0f0", background: iIdx % 2 === 0 ? "#fff" : "#fafbff" }}>
                            <td style={{ padding: "10px 12px" }}>{fila.descripcion}</td>
                            {["ok", "nok", "na"].map(v => (
                              <td key={v} style={{ textAlign: "center", padding: "10px 8px" }}>
                                <input type="radio" name={`ot-${pIdx}-item-${iIdx}`} value={v} checked={fila.valor === v} onChange={() => updateChecklist(pIdx, iIdx, "valor", v)}
                                  style={{ width: "20px", height: "20px", cursor: "pointer", accentColor: v === "ok" ? "#2e7d32" : v === "nok" ? "#c62828" : "#888" }} />
                              </td>
                            ))}
                            <td style={{ padding: "8px 10px" }}>
                              <input style={{ ...inputSt, padding: "7px 10px", fontSize: "0.82rem" }} value={fila.observacion} onChange={e => updateChecklist(pIdx, iIdx, "observacion", e.target.value)} placeholder="Obs..." />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* TABLA POR PISO */}
              {p.tipo === "tabla_piso" && (
                <div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ background: "#002244", color: "#fff" }}>
                          {p.columnas.map(c => <th key={c} style={{ textAlign: "center", padding: "10px 8px", whiteSpace: "nowrap", fontSize: "0.75rem" }}>{c}</th>)}
                          <th style={{ padding: "10px 8px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.filasTabla.map((fila, fIdx) => (
                          <tr key={fIdx} style={{ borderBottom: "1px solid #eee", background: fIdx % 2 === 0 ? "#fff" : "#fafbff" }}>
                            {p.columnas.map(col => (
                              <td key={col} style={{ padding: "6px 4px" }}>
                                <input style={{ ...inputSt, padding: "7px 8px", fontSize: "0.82rem", minWidth: "80px" }}
                                  value={fila.celdas[col] || ""} onChange={e => updateCelda(pIdx, fIdx, col, e.target.value)} />
                              </td>
                            ))}
                            <td style={{ padding: "6px 4px" }}>
                              <button onClick={() => removeFilaTabla(pIdx, fIdx)} style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #ffddd9", background: "#fff5f4", cursor: "pointer", color: "var(--primary-red)" }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={() => addFilaTabla(pIdx)} style={{ marginTop: "10px", padding: "8px 16px", borderRadius: "6px", border: "1px dashed #ccc", background: "#f8f9fa", cursor: "pointer", fontSize: "0.85rem", color: "#666" }}>
                    + Agregar fila
                  </button>
                </div>
              )}
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setPaso(0)} style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>← Anterior</button>
            <button onClick={() => setPaso(2)} className="btn-blue" style={{ padding: "12px 28px" }}>Siguiente → Observaciones</button>
          </div>
        </div>
      )}

      {/* ══════════ PASO 2: OBSERVACIONES ══════════ */}
      {paso === 2 && (
        <div>
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "16px", fontSize: "1rem" }}>Observaciones del Servicio</h2>
            {obsAutomaticas.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "10px", fontWeight: 600 }}>RECOPILADAS DE LAS PLANILLAS:</p>
                {obsAutomaticas.map((o, i) => (
                  <div key={i} style={{ padding: "10px 14px", background: "#f8f9fc", borderLeft: "3px solid var(--primary-blue)", borderRadius: "0 6px 6px 0", marginBottom: "8px", fontSize: "0.88rem", color: "#444" }}>
                    {o}
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "10px", fontWeight: 600 }}>AGREGAR MANUALMENTE:</p>
              {observacionesExtra.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input style={{ ...inputSt, flex: 1 }} value={o} onChange={e => setObservacionesExtra(prev => prev.map((x, j) => j === i ? e.target.value : x))} />
                  <button onClick={() => setObservacionesExtra(prev => prev.filter((_, j) => j !== i))} style={{ padding: "10px 14px", borderRadius: "6px", border: "1px solid #ffddd9", background: "#fff5f4", cursor: "pointer", color: "var(--primary-red)" }}>✕</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px" }}>
                <input style={{ ...inputSt, flex: 1 }} value={nuevaObs} onChange={e => setNuevaObs(e.target.value)} placeholder="Nueva observación..." onKeyDown={e => { if (e.key === "Enter" && nuevaObs.trim()) { setObservacionesExtra(p => [...p, nuevaObs.trim()]); setNuevaObs(""); } }} />
                <button onClick={() => { if (nuevaObs.trim()) { setObservacionesExtra(p => [...p, nuevaObs.trim()]); setNuevaObs(""); } }}
                  style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid var(--primary-blue)", background: "transparent", color: "var(--primary-blue)", fontWeight: 700, cursor: "pointer" }}>+</button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setPaso(1)} style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>← Anterior</button>
            <button onClick={() => setPaso(3)} className="btn-blue" style={{ padding: "12px 28px" }}>Siguiente → Fotos</button>
          </div>
        </div>
      )}

      {/* ══════════ PASO 3: FOTOS ══════════ */}
      {paso === 3 && (
        <div>
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "16px", fontSize: "1rem" }}>Fotos del Servicio</h2>
            <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" style={{ display: "none" }} onChange={handleFotoUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFoto}
              style={{ width: "100%", padding: "20px", borderRadius: "10px", border: "2px dashed #ccc", background: "#fafafa", cursor: "pointer", fontSize: "1rem", color: "#999", marginBottom: "20px" }}>
              {uploadingFoto ? "⏳ Subiendo..." : "📷 Agregar fotos (cámara o galería)"}
            </button>
            {fotos.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
                {fotos.map((url, i) => (
                  <div key={i} style={{ position: "relative", borderRadius: "8px", overflow: "hidden", aspectRatio: "1", background: "#f0f0f0" }}>
                    <img src={url} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))}
                      style={{ position: "absolute", top: "5px", right: "5px", background: "rgba(163,31,29,0.85)", border: "none", borderRadius: "50%", width: "26px", height: "26px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: "0.7rem" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {fotos.length === 0 && <p style={{ color: "var(--text-muted)", textAlign: "center", fontSize: "0.88rem" }}>No hay fotos adjuntas.</p>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setPaso(2)} style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>← Anterior</button>
            <button onClick={() => setPaso(4)} className="btn-blue" style={{ padding: "12px 28px" }}>Siguiente → Firmas</button>
          </div>
        </div>
      )}

      {/* ══════════ PASO 4: FIRMAS ══════════ */}
      {paso === 4 && (
        <div>
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "20px", fontSize: "1rem" }}>Firmas</h2>
            {([
              { label: "Técnico Responsable", sig: firmaTecnico, setSig: setFirmaTecnico, ref: sigTecRef, nombre: nombreFirmaTecnico, setNombre: setNombreFirmaTecnico, placeholder: "Nombre del técnico..." },
              { label: "Cliente / Comitente", sig: firmaCliente, setSig: setFirmaCliente, ref: sigCliRef, nombre: nombreFirmaCliente, setNombre: setNombreFirmaCliente, placeholder: "Nombre del cliente / representante..." },
            ] as any[]).map(({ label, sig, setSig, ref: sigRef, nombre, setNombre, placeholder }) => (
              <div key={label} style={{ marginBottom: "32px" }}>
                <label style={labelSt}>{label}</label>
                <div style={{ marginBottom: "10px" }}>
                  <input style={{ ...inputSt, fontSize: "0.88rem" }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder={placeholder} />
                </div>
                <div style={{ border: "2px solid #ddd", borderRadius: "10px", overflow: "hidden", background: "#f9f9f9" }}>
                  <SignatureCanvas ref={sigRef} penColor="#002244"
                    canvasProps={{ style: { width: "100%", height: "180px", touchAction: "none", display: "block" } }} />
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button onClick={() => { sigRef.current?.clear(); }}
                    style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: "0.85rem" }}>
                    🗑 Limpiar
                  </button>
                  <button onClick={() => { if (!sigRef.current?.isEmpty()) setSig(sigRef.current.getTrimmedCanvas().toDataURL("image/png")); }}
                    className="btn-blue" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
                    ✓ Guardar firma
                  </button>
                  {sig && <span style={{ fontSize: "0.8rem", color: "#4CAF50", alignSelf: "center" }}>✓ Firma guardada</span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <button onClick={() => setPaso(3)} style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>← Anterior</button>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => handleSave("borrador")} disabled={saving} style={{ padding: "12px 20px", borderRadius: "8px", border: "1px solid var(--primary-blue)", background: "transparent", color: "var(--primary-blue)", fontWeight: 700, cursor: "pointer" }}>
                💾 Guardar borrador
              </button>
              <button onClick={() => handleSave("completada")} disabled={saving} className="btn-red" style={{ padding: "12px 24px" }}>
                {saving ? "Guardando..." : "✓ Guardar y Completar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media (max-width: 640px) {
          .ot-stepper button { font-size: 0.65rem !important; padding: 10px 4px !important; }
        }
      `}</style>
    </div>
  );
}
