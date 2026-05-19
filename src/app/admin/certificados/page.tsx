"use client";
import { useEffect, useState } from "react";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, where, doc, getDoc, deleteDoc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Eye, Edit, Download, Trash2, Scroll, BookText, ClipboardList } from "lucide-react";


interface Certificado {
  id: string;
  numero: number;
  fechaInspeccion: string;
  fechaVencimiento: string;
  rubro: string;
  sistemaCertificado: string;
  clienteNombre: string;
  clienteEmpresa: string;
  clienteId?: string;
  estado: "borrador" | "emitido";
  createdAt: any;
}

interface TextoMemoria {
  id: string;
  titulo: string;
  contenido: string;
}

const fetchImgBase64 = async (url: string): Promise<string | null> => {
  try {
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
    const maxPx = 1400;
    const ratio = Math.min(maxPx / img.naturalWidth, maxPx / img.naturalHeight, 1);
    cnv.width = Math.round(img.naturalWidth * ratio);
    cnv.height = Math.round(img.naturalHeight * ratio);
    cnv.getContext("2d")!.drawImage(img, 0, 0, cnv.width, cnv.height);
    return cnv.toDataURL("image/jpeg", 0.82);
  } catch { return null; }
};

const appendOTPagesToDoc = async (pdf: any, autoTable: any, otId: string, logoPng: string | null) => {
  const snap = await getDoc(doc(db, "ordenes_trabajo", otId));
  if (!snap.exists()) return;
  const data = snap.data() as any;

  const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
  const otNum = String(data.numero || "").padStart(4, "0");
  const fecStr = data.fecha ? new Date(data.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";
  const planillasEnOT: any[] = data.planillasSeleccionadas || [];
  const fotosOT: string[] = data.fotos || [];
  const tecnicosOT: any[] = data.tecnicosOT || (data.tecnicos || []).map((t: string) => ({ nombre: t }));
  const nuevaObs: string = data.diagnostico || "";
  const firmaTecnico: string | null = data.firmaTecnico || null;
  const firmaCliente: string | null = data.firmaCliente || null;
  const nombreFirmaTecnico: string = data.nombreFirmaTecnico || "";
  const nombreFirmaCliente: string = data.nombreFirmaCliente || "";
  const HEADER_H = 30; const top = 10;

  const drawOTHeader = (pg: any) => {
    pg.setDrawColor(0, 34, 68); pg.setLineWidth(0.5); pg.rect(ML, top, TW, HEADER_H);
    if (logoPng) pg.addImage(logoPng, "PNG", ML + 2, top + 2, 28, 26);
    pg.line(ML + 33, top, ML + 33, top + HEADER_H);
    const rx = W - MR - 48; const cx = ML + 33 + (rx - ML - 33) / 2;
    pg.setFont(undefined as any, "bold"); pg.setFontSize(11); pg.setTextColor(0, 34, 68);
    pg.text("INSPECCIÓN TÉCNICA VINCULADA", cx, top + 9, { align: "center" });
    pg.setFontSize(14); pg.setTextColor(163, 31, 29); pg.text(`IT-${otNum}`, cx, top + 23, { align: "center" });
    pg.line(rx, top, rx, top + HEADER_H);
    pg.setFontSize(7); pg.setTextColor(0); pg.setFont(undefined as any, "normal");
    pg.text("Fecha:", rx + 2, top + 11); pg.text("Estado:", rx + 2, top + 18); pg.text("Planilla:", rx + 2, top + 25);
    pg.text(fecStr, rx + 18, top + 11);
    pg.text((data.estado || "").toUpperCase(), rx + 18, top + 18);
    pg.text(planillasEnOT[0]?.codigo || "-", rx + 18, top + 25);
  };

  pdf.addPage();
  drawOTHeader(pdf);
  let y = top + HEADER_H + 8;

  autoTable(pdf, {
    startY: y, margin: { left: ML, right: MR },
    body: [
      [{ content: "CLIENTE / RAZÓN SOCIAL:", styles: { fontStyle: "bold", cellWidth: 45 } }, data.clienteNombre || "-"],
      [{ content: "EMPRESA / SEDE:", styles: { fontStyle: "bold" } }, (data.sedeRazonSocial || data.clienteEmpresa || "-") + (data.sedeNombre ? ` - SEDE: ${data.sedeNombre}` : "")],
      [{ content: "DIRECCIÓN:", styles: { fontStyle: "bold" } }, data.clienteDireccion || data.direccion || "-"],
      [{ content: "TELÉFONO / CEL:", styles: { fontStyle: "bold" } }, data.clienteTelefono || "-"],
    ],
    styles: { fontSize: 9, cellPadding: 3 }, tableLineColor: [0, 34, 68], tableLineWidth: 0.1
  });
  y = (pdf as any).lastAutoTable.finalY + 8;

  if (tecnicosOT.length > 0) {
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.setFont(undefined as any, "bold");
    pdf.text("EQUIPO TÉCNICO ASIGNADO", ML + 3, y + 5);
    y += 7.5;
    autoTable(pdf, { startY: y, margin: { left: ML, right: MR }, body: tecnicosOT.map((t: any) => [t.nombre]), styles: { fontSize: 8.5, cellPadding: 3 } });
    y = (pdf as any).lastAutoTable.finalY + 8;
  }

  const sevColors: Record<string, number[]> = { leve: [16, 185, 129], moderado: [245, 158, 11], critico: [239, 68, 68] };
  const todasObs = [
    nuevaObs.trim() ? { texto: `[GENERAL] ${nuevaObs}`, sev: "" } : null,
    ...planillasEnOT.flatMap((p: any) => (p.filasChecklist || []).filter((f: any) => f.observacion?.trim()).map((f: any) => ({ texto: `[${p.nombre}] ${f.descripcion}: ${f.observacion}`, sev: f.severidad || "" }))),
  ].filter(Boolean) as { texto: string; sev: string }[];

  if (todasObs.length > 0) {
    if (y > 240) { pdf.addPage(); drawOTHeader(pdf); y = top + HEADER_H + 10; }
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.setFont(undefined as any, "bold");
    pdf.text("RESUMEN DE OBSERVACIONES TÉCNICAS", ML + 3, y + 5);
    y += 7.5;
    autoTable(pdf, {
      startY: y, margin: { left: ML, right: MR },
      body: todasObs.map((o: any) => [o.texto, o.sev ? o.sev.toUpperCase() : ""]),
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

  if (fotosOT.length > 0) {
    if (y > 220) { pdf.addPage(); drawOTHeader(pdf); y = top + HEADER_H + 10; }
    pdf.setFillColor(240, 240, 240); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8.5); pdf.setTextColor(0); pdf.setFont(undefined as any, "normal");
    pdf.text("REGISTRO FOTOGRÁFICO", ML + 3, y + 5);
    y += 10; let xPh = ML;
    for (const fUrl of fotosOT) {
      const b64 = await fetchImgBase64(fUrl);
      if (b64) {
        if (xPh + 45 > W - MR) { xPh = ML; y += 45; }
        if (y > 240) { pdf.addPage(); drawOTHeader(pdf); y = top + HEADER_H + 10; xPh = ML; }
        pdf.addImage(b64, "JPEG", xPh, y, 42, 42); xPh += 45;
      }
    }
    y += 50;
  }

  for (const p of planillasEnOT) {
    if (y > 240) { pdf.addPage(); drawOTHeader(pdf); y = top + HEADER_H + 10; }
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.setFont(undefined as any, "bold");
    pdf.text(`PLANILLA: ${p.nombre}`, ML + 3, y + 5);
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

  if (y > 230) { pdf.addPage(); drawOTHeader(pdf); y = top + HEADER_H + 10; }
  pdf.setDrawColor(200); pdf.line(ML, y, W - MR, y); y += 5;
  if (firmaTecnico) {
    try { pdf.addImage(firmaTecnico, "PNG", ML + 10, y, 40, 20); } catch {}
    pdf.setFontSize(8); pdf.setFont(undefined as any, "normal"); pdf.setTextColor(0);
    pdf.text(`Firma Técnico: ${nombreFirmaTecnico}`, ML + 10, y + 25);
  }
  if (firmaCliente) {
    try { pdf.addImage(firmaCliente, "PNG", W - MR - 50, y, 40, 20); } catch {}
    pdf.setFontSize(8); pdf.setFont(undefined as any, "normal"); pdf.setTextColor(0);
    pdf.text(`Firma Cliente: ${nombreFirmaCliente}`, W - MR - 50, y + 25);
  }
};

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  borrador: { bg: "#f5f5f5", color: "#666" },
  emitido:  { bg: "#e8f5e9", color: "#2e7d32" },
};

export default function CertificadosPage() {
  const [certs, setCerts] = useState<Certificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtroSede, setFiltroSede] = useState("Todas");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"listado" | "textos">("listado");
  const [textos, setTextos] = useState<TextoMemoria[]>([]);
  const [textoModal, setTextoModal] = useState<null | "create" | "edit">(null);
  const [formTexto, setFormTexto] = useState({ titulo: "", contenido: "", id: "" });
  const [deletingTexto, setDeletingTexto] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "usuarios", u.uid));
      const userData = snap.exists() ? snap.data() : {};
      const r = userData.rol || "cliente";
      setRole(r);
      setUid(u.uid);
      setCurrentUser({ uid: u.uid, ...userData });
      fetchCerts(r, u.uid);
    });
    return () => unsub();
  }, []);

  const fetchCerts = async (r: string, currentUid: string) => {
    setLoading(true);
    try {
      let snap;
      if (r === "cliente") {
        // Clientes solo ven sus certificados (filtrado por clienteId)
        const q = query(collection(db, "certificados"), where("clienteId", "==", currentUid), orderBy("createdAt", "desc"));
        try {
          snap = await getDocs(q);
        } catch {
          const qFallback = query(collection(db, "certificados"), where("clienteId", "==", currentUid));
          snap = await getDocs(qFallback);
          const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Certificado));
          setCerts(all);
          return;
        }
      } else {
        snap = await getDocs(query(collection(db, "certificados"), orderBy("createdAt", "desc")));
      }
      let all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Certificado));
      // SEGURIDAD: Filtrar por clienteId si es cliente, pase lo que pase
      if (r === "cliente") {
        all = all.filter(c => c.clienteId === currentUid);
      }
      setCerts(all);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchTextos = async () => {
    try {
      const snap = await getDocs(query(collection(db, "textos_memoria"), orderBy("createdAt", "asc")));
      if (snap.empty) {
        const ejemplos = [
          { titulo: "Detección y Alarma", contenido: "SISTEMA DE DETECCION Y ALARMA CONTRA INCENDIOS\nSe certifica que el establecimiento cuenta con un sistema de detección temprana de incendios, compuesto por una central de control, detectores automáticos de humo/temperatura, pulsadores manuales de alarma y avisadores sonoro-lumínicos. El sistema se encuentra operativo y cumple con las condiciones de mantenimiento preventivo." },
          { titulo: "Hidrantes", contenido: "SISTEMA DE EXTINCION POR AGUA (HIDRANTES)\nSe certifica la operatividad de la red de incendio compuesta por bocas de incendio equipadas (BIE). Se ha verificado la presencia de mangueras, lanzas y llaves de ajustar en cada gabinete, así como la presión estática y dinámica en los puntos más desfavorables." },
        ];
        for (const e of ejemplos) {
          await addDoc(collection(db, "textos_memoria"), { ...e, createdAt: serverTimestamp() });
        }
        const snap2 = await getDocs(query(collection(db, "textos_memoria"), orderBy("createdAt", "asc")));
        setTextos(snap2.docs.map(d => ({ id: d.id, ...d.data() } as TextoMemoria)));
      } else {
        setTextos(snap.docs.map(d => ({ id: d.id, ...d.data() } as TextoMemoria)));
      }
    } catch { setTextos([]); }
  };

  const handleSaveTexto = async () => {
    if (!formTexto.titulo.trim() || !formTexto.contenido.trim()) return;
    try {
      if (formTexto.id) {
        await updateDoc(doc(db, "textos_memoria", formTexto.id), { titulo: formTexto.titulo.trim(), contenido: formTexto.contenido.trim() });
      } else {
        await addDoc(collection(db, "textos_memoria"), { titulo: formTexto.titulo.trim(), contenido: formTexto.contenido.trim(), createdAt: serverTimestamp() });
      }
      setTextoModal(null);
      setFormTexto({ titulo: "", contenido: "", id: "" });
      fetchTextos();
    } catch (e) { alert("Error al guardar: " + e); }
  };

  const handleDeleteTexto = async (id: string) => {
    try {
      await deleteDoc(doc(db, "textos_memoria", id));
      setTextos(prev => prev.filter(t => t.id !== id));
      setDeletingTexto(null);
    } catch (e) { alert("Error al eliminar: " + e); }
  };

  const handleDelete = async (id: string) => {
    try {
      const docRef = doc(db, "certificados", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const fotos = data.fotos || [];
        for (const url of fotos) {
          try {
            const picRef = ref(storage, url);
            await deleteObject(picRef);
          } catch (err) {
            console.error("Error eliminando imagen de storage:", err);
          }
        }
      }

      await deleteDoc(docRef);
      setCerts(p => p.filter(c => c.id !== id));
      setDeleteConfirm(null);
    } catch (e) { alert("Error: " + e); }
  };

  // ── PDF GENERATION ────────────────────────────────────────────────────────
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadPDF = async (certId: string) => {
    setDownloadingId(certId);
    try {
      const snap = await getDoc(doc(db, "certificados", certId));
      if (!snap.exists()) { alert("Certificado no encontrado"); return; }
      const data = snap.data() as any;

      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
      const PAGE_BOTTOM = 268;
      const nCert = String(data.numero || "").padStart(4, "0");
      const fInsp = data.fechaInspeccion ? new Date(data.fechaInspeccion + "T12:00:00").toLocaleDateString("es-AR") : "-";
      const fVenc = data.fechaVencimiento ? new Date(data.fechaVencimiento + "T12:00:00").toLocaleDateString("es-AR") : "-";
      const DECLARACION_JURADA = `La información consignada precedentemente reviste el carácter de Declaración Jurada; su omisión o falsedad precederá al decaimiento de su validez, sin perjuicio de las sanciones que pudiera corresponder. El profesional interviniente declara que cumple con las competencias exigidas, por ley, para completar el presente trabajo.`;

      let logoDataUrl: string | null = null;
      try {
        const resp = await fetch("/logos/logoFondoTransparente.svg");
        const svgText = await resp.text();
        const blob = new Blob([svgText], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
        const cnv = document.createElement("canvas");
        cnv.width = img.naturalWidth || 300; cnv.height = img.naturalHeight || 150;
        cnv.getContext("2d")!.drawImage(img, 0, 0);
        logoDataUrl = cnv.toDataURL("image/png");
        URL.revokeObjectURL(url);
      } catch {}

      const drawHeader = (p: any) => {
        const H = 36; const T = 10;
        p.setDrawColor(0, 34, 68); p.setLineWidth(0.5); p.rect(ML, T, TW, H);
        p.setFillColor(255, 255, 255); p.rect(ML, T, 36, H, "F");
        if (logoDataUrl) p.addImage(logoDataUrl, "PNG", ML + 2, T + 3, 31, 26);
        p.line(ML + 36, T, ML + 36, T + H);
        const rx = W - MR - 52; const cx = ML + 36 + (rx - ML - 36) / 2;
        p.setFont(undefined, "bold"); p.setFontSize(9); p.setTextColor(0, 34, 68);
        p.text("Certificado de Instalaciones", cx, T + 8, { align: "center" });
        p.text("contra incendio, y emergencias", cx, T + 13, { align: "center" });
        p.setFontSize(7.5); p.setTextColor(163, 31, 29);
        p.text("DOCUMENTO TIENE CARÁCTER DE DECLARACIÓN JURADA.", cx, T + 19, { align: "center" });
        p.setTextColor(0); p.setFont(undefined, "bold"); p.setFontSize(9);
        p.text(`CERTIFICADO  N°${nCert}`, cx, T + 28, { align: "center" });
        p.setFont(undefined, "italic"); p.setFontSize(7); p.setTextColor(90);
        p.text("Ingeniería contra Incendio", ML + 2, T + H - 2);
        p.line(rx, T, rx, T + H);
        const rows = [["Rubro:", data.rubro || "-"], ["Fecha:", fInsp], ["Rev. planos:", data.revPlanos || "-"], ["Pagina:", String(p.getCurrentPageInfo().pageNumber)]];
        rows.forEach(([k, v]: string[], i: number) => {
          const ry = T + (H / 4) * i + (H / 8) + 1.5;
          p.setFont(undefined, "bold"); p.text(k, rx + 2, ry);
          p.setFont(undefined, "normal"); p.text(v, rx + 24, ry);
          if (i < 3) p.line(rx, T + (H / 4) * (i + 1), W - MR, T + (H / 4) * (i + 1));
        });
        p.line(ML, T + H, W - MR, T + H);
        return T + H + 6;
      };

      let y = drawHeader(pdf);
      autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR },
        body: [
          [{ content: "Fecha de Inspección", styles: { fontStyle: "bold", cellWidth: 45 } }, fInsp, { content: "Fecha de Vencimiento", styles: { fontStyle: "bold", cellWidth: 45 } }, fVenc],
          [{ content: "Sistema certificado:", styles: { fontStyle: "bold" } }, { content: data.sistemaCertificado || "-", colSpan: 3, styles: { fontStyle: "bold", textColor: [163, 31, 29] } }],
          [{ content: "Cliente:", styles: { fontStyle: "bold" } }, { content: (data.clienteNombre || "-") + (data.sedeNombre ? ` - SEDE: ${data.sedeNombre}` : ""), colSpan: 3, styles: { halign: "center", fontStyle: "bold" } }],
          [{ content: "Razón social:", styles: { fontStyle: "bold" } }, { content: data.clienteCuit || data.sedeRazonSocial || data.clienteEmpresa || "-", colSpan: 3, styles: { halign: "center" } }],
          [{ content: "Domicilio:", styles: { fontStyle: "bold" } }, { content: data.clienteDireccion || "-", colSpan: 3 }],
          [{ content: "Responsable certificado:", styles: { fontStyle: "bold" } }, { content: data.responsableCertificado || "-", colSpan: 3 }],
          [{ content: "Empresa Certificante:", styles: { fontStyle: "bold" } }, { content: "ARIFA — INGENIERIA EN SEGURIDAD CONTRA INCENDIOS  |  CUIT 20-35108395-7  |  www.arifa.com.ar", colSpan: 3, styles: { fontStyle: "bold", textColor: [0, 34, 68] } }],
        ],
        styles: { fontSize: 9, cellPadding: 4 }, tableLineColor: [0, 34, 68], tableLineWidth: 0.3,
        didParseCell: (d: any) => { if (d.row.index === 6) d.cell.styles.fillColor = [245, 247, 255]; },
      });
      y = (pdf as any).lastAutoTable.finalY + 10;

      // ── Memoria Descriptiva ────────────────────────────────────────────────
      if (data.memoriaDescriptiva?.trim()) {
        if (y + 14 > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; }
        pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
        pdf.setFontSize(8); pdf.setFont(undefined as any, "bold"); pdf.setTextColor(255);
        pdf.text("MEMORIA DESCRIPTIVA", ML + 3, y + 5);
        y += 11;

        for (const line of data.memoriaDescriptiva.split("\n")) {
          if (!line.trim()) { y += 3; continue; }
          const isHeader = line.trim() === line.trim().toUpperCase() && line.trim().length > 3;
          const lineH = isHeader ? 7 : 5.5;
          const wrapped = pdf.splitTextToSize(line.trim(), isHeader ? TW - 8 : TW);
          const blockH = wrapped.length * lineH + (isHeader ? 10 : 0);
          if (y + blockH > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; }
          if (isHeader) {
            y += 3;
            pdf.setFillColor(240, 244, 255); pdf.rect(ML, y - 3, TW, wrapped.length * lineH + 5, "F");
            pdf.setFillColor(0, 34, 68); pdf.rect(ML, y - 3, 3.5, wrapped.length * lineH + 5, "F");
            pdf.setFont(undefined as any, "bold"); pdf.setFontSize(9.5); pdf.setTextColor(0, 34, 68);
            pdf.text(wrapped, ML + 7, y + 1);
            y += wrapped.length * lineH + 6;
          } else {
            pdf.setFont(undefined as any, "normal"); pdf.setFontSize(9); pdf.setTextColor(40, 40, 40);
            pdf.text(wrapped, ML, y);
            y += wrapped.length * lineH;
          }
        }
        y += 8;
      }

      // ── Fotos ──────────────────────────────────────────────────────────────
      const fotos: string[] = data.fotos || [];
      if (fotos.length > 0) {
        if (y + 72 > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; }
        pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
        pdf.setFontSize(8); pdf.setFont(undefined as any, "bold"); pdf.setTextColor(255);
        pdf.text("REGISTRO FOTOGRÁFICO", ML + 3, y + 5);
        y += 10;
        let col = 0;
        const imgW = (TW - 5) / 2; const imgH = 55;
        for (const url of fotos) {
          try {
            const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
            if (!resp.ok) continue;
            const blob = await resp.blob();
            const dataUrl = await new Promise<string>((res, rej) => {
              const reader = new FileReader();
              reader.onloadend = () => res(reader.result as string);
              reader.onerror = rej; reader.readAsDataURL(blob);
            });
            const img = new Image();
            await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
            if (!img.naturalWidth || !img.naturalHeight) continue;
            const cnv = document.createElement("canvas");
            const maxPx = 1400;
            const ratio = Math.min(maxPx / img.naturalWidth, maxPx / img.naturalHeight, 1);
            cnv.width = Math.round(img.naturalWidth * ratio);
            cnv.height = Math.round(img.naturalHeight * ratio);
            cnv.getContext("2d")!.drawImage(img, 0, 0, cnv.width, cnv.height);
            if (y + imgH > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; col = 0; }
            pdf.addImage(cnv.toDataURL("image/jpeg", 0.82), "JPEG", ML + col * (imgW + 5), y, imgW, imgH);
            col++;
            if (col === 2) { col = 0; y += imgH + 5; }
          } catch { /* skip */ }
        }
        if (col > 0) y += imgH + 5;
        y += 6;
      }

      // ── Declaración Jurada + Firmas ────────────────────────────────────────
      const djLines = pdf.splitTextToSize(DECLARACION_JURADA, TW);
      if (y + djLines.length * 5 + 40 > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; }
      pdf.setFillColor(248, 249, 252); pdf.rect(ML, y, TW, 6, "F");
      pdf.setFont(undefined as any, "bold"); pdf.setFontSize(8.5); pdf.setTextColor(0, 34, 68);
      pdf.text("DECLARACIÓN JURADA", ML + 3, y + 4); y += 9;
      pdf.setFont(undefined as any, "normal"); pdf.setFontSize(8.5); pdf.setTextColor(40);
      pdf.text(djLines, ML, y); y += djLines.length * 5 + 10;

      if (y + 35 > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; }
      const bw = (TW - 10) / 2;
      pdf.rect(ML, y, bw, 28); pdf.rect(ML + bw + 10, y, bw, 28);
      pdf.setFontSize(8); pdf.setTextColor(80);
      pdf.text("Firma Profesional Interviniente", ML + 2, y + 4);
      pdf.text("Firma Propietario/Responsable del Inmueble", ML + bw + 12, y + 4);
      if (data.firmaProfesional) try { pdf.addImage(data.firmaProfesional, "PNG", ML + 5, y + 6, bw - 10, 18); } catch {}
      if (data.firmaCliente) try { pdf.addImage(data.firmaCliente, "PNG", ML + bw + 15, y + 6, bw - 10, 18); } catch {}

      // ── Inspecciones Vinculadas ────────────────────────────────────────────
      const ivIds: string[] = data.inspeccionesVinculadas || [];
      for (const otId of ivIds) {
        try {
          await appendOTPagesToDoc(pdf, autoTable, otId, logoDataUrl);
        } catch (otErr) { console.warn("Error adjuntando IT al PDF:", otErr); }
      }

      // ── Pie de página ──────────────────────────────────────────────────────
      const total = pdf.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        const fy = 287;
        pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(ML, fy - 5, W - MR, fy - 5);
        pdf.setFont(undefined as any, "italic"); pdf.setFontSize(7.5); pdf.setTextColor(120);
        pdf.text(`Emitido el ${fInsp}.`, ML, fy);
        pdf.text(`Página ${i} de ${total}`, W / 2, fy, { align: "center" });
        pdf.text("ARIFA - Protección contra Incendios", W - MR, fy, { align: "right" });
      }

      pdf.save(`ARIFA-Cert-${nCert}.pdf`);
    } catch (err) { alert("Error al generar PDF: " + err); }
    finally { setDownloadingId(null); }
  };

  const isStaff = role === "admin" || role === "tecnico" || role === "superadmin";
  const isAdmin = role === "admin" || role === "superadmin";
  const isReadOnly = role === "cliente";

  const filteredCerts = certs.filter(c => {
    const matchesSearch = 
      String(c.numero).includes(search) || 
      c.clienteNombre?.toLowerCase().includes(search.toLowerCase()) ||
      c.clienteEmpresa?.toLowerCase().includes(search.toLowerCase()) ||
      (c as any).sedeNombre?.toLowerCase().includes(search.toLowerCase()) ||
      c.sistemaCertificado?.toLowerCase().includes(search.toLowerCase());
    
    const certDate = c.fechaInspeccion ? new Date(c.fechaInspeccion) : null;
    let matchesDate = true;
    if (certDate) {
      if (dateFrom && certDate < new Date(dateFrom)) matchesDate = false;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (certDate > toDate) matchesDate = false;
      }
    } else if (dateFrom || dateTo) {
      matchesDate = false;
    }
    
    const matchesSede = filtroSede === "Todas" || (c as any).sedeNombre === filtroSede;
    return matchesSearch && matchesDate && matchesSede;
  });

  const sedesDisponibles = (isReadOnly && currentUser?.sedes 
    ? currentUser.sedes.map((s: any) => s.nombre)
    : Array.from(new Set(certs.map(c => (c as any).sedeNombre).filter(Boolean)))) as string[];

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <span style={{ fontSize: "0.8rem", background: "#e8f5e9", color: "#2e7d32", padding: "3px 10px", borderRadius: "20px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Scroll size={14} strokeWidth={2.5} /> Certificados
          </span>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>
            {isReadOnly ? "Mis Certificados" : "Certificados de Instalación"}
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>{activeTab === "listado" ? "Generá y gestioná certificados con carácter de Declaración Jurada." : "Gestioná los textos predefinidos para la Memoria Descriptiva."}</p>
        </div>
        {isStaff && !isReadOnly && (
          activeTab === "listado" ? (
            <Link href="/admin/certificados/nuevo" className="btn-red" style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <Plus size={18} /> Nuevo Certificado
            </Link>
          ) : isAdmin && (
            <button onClick={() => { setFormTexto({ titulo: "", contenido: "", id: "" }); setTextoModal("create"); }} className="btn-red" style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px", border: "none", cursor: "pointer" }}>
              <Plus size={18} /> Nuevo Texto
            </button>
          )
        )}
      </header>

      {isAdmin && !isReadOnly && (
        <div style={{ display: "flex", gap: "8px", background: "#f1f5f9", padding: "6px", borderRadius: "14px", marginBottom: "24px", width: "fit-content" }}>
          <button type="button"
            onClick={() => { setActiveTab("listado"); setSearch(""); }}
            style={{ padding: "10px 18px", borderRadius: "10px", border: "1.5px solid", borderColor: activeTab === "listado" ? "#3b82f6" : "#bfdbfe", background: activeTab === "listado" ? "#fff" : "#eff6ff", fontWeight: 800, color: "#3b82f6", cursor: "pointer", boxShadow: activeTab === "listado" ? "0 4px 12px rgba(59,130,246,0.15)" : "none", display: "flex", alignItems: "center", gap: "8px", transition: "0.3s" }}>
            <ClipboardList size={18} strokeWidth={2.5} /> Listado
          </button>
          <button type="button"
            onClick={() => { setActiveTab("textos"); fetchTextos(); }}
            style={{ padding: "10px 18px", borderRadius: "10px", border: "1.5px solid", borderColor: activeTab === "textos" ? "#16a34a" : "#bbf7d0", background: activeTab === "textos" ? "#fff" : "#f0fdf4", fontWeight: 800, color: "#16a34a", cursor: "pointer", boxShadow: activeTab === "textos" ? "0 4px 12px rgba(22,163,74,0.15)" : "none", display: "flex", alignItems: "center", gap: "8px", transition: "0.3s" }}>
            <BookText size={18} strokeWidth={2.5} /> Textos
          </button>
        </div>
      )}

      {/* FILTERS */}
      <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: activeTab === "listado" ? "flex" : "none", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
        <div style={{ flex: 1, minWidth: "220px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>
            {isReadOnly ? "Buscar por Certificado o Sistema" : "Buscar por Certificado o Cliente"}
          </label>
          <input 
            type="text" 
            placeholder="N°, nombre, sistema..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.9rem" }}
          />
        </div>
        <div style={{ width: "160px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Inspección Desde</label>
          <input 
            type="date" 
            value={dateFrom} 
            onChange={e => setDateFrom(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }}
          />
        </div>
        <div style={{ width: "160px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Hasta</label>
          <input 
            type="date" 
            value={dateTo} 
            onChange={e => setDateTo(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }}
          />
        </div>
        {sedesDisponibles.length > 0 && (
          <div style={{ width: "180px" }}>
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Sede / Obra</label>
            <select 
              value={filtroSede} 
              onChange={e => setFiltroSede(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.85rem", background: "#fff" }}
            >
              <option value="Todas">Todas las sedes</option>
              {sedesDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <button 
          onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setFiltroSede("Todas"); }}
          style={{ padding: "10px 15px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#666" }}
        >
          Limpiar
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden", marginBottom: "20px", display: activeTab === "listado" ? undefined : "none" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando certificados...</div>
        ) : filteredCerts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "15px", filter: "grayscale(1)", opacity: 0.3 }}>📜</div>
            <h3 style={{ fontWeight: 800, color: "#999", marginBottom: "8px" }}>No se encontraron certificados</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Ajustá los filtros para encontrar lo que buscás.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hide-on-mobile" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "650px" }}>
                <thead>
                  <tr style={{ background: "#f8f9fc", borderBottom: "2px solid #eef0f3" }}>
                    {["N° Cert.", "Fecha", "Vigencia", "Cliente", "Sistema", "Rubro", "Estado", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCerts.map(c => {
                    const ec = ESTADO_COLORS[c.estado] || ESTADO_COLORS.borrador;
                    const venc = c.fechaVencimiento ? new Date(c.fechaVencimiento + "T12:00:00") : null;
                    const vencido = venc && venc < new Date();
                    return (
                      <tr key={c.id} style={{ borderBottom: "1px solid #f2f5f9" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-blue)" }}>
                            N°{String(c.numero || "?").padStart(4, "0")}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "0.88rem", color: "#555", whiteSpace: "nowrap" }}>
                          {c.fechaInspeccion ? new Date(c.fechaInspeccion + "T12:00:00").toLocaleDateString("es-AR") : "-"}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "0.88rem", whiteSpace: "nowrap" }}>
                          <span style={{ color: vencido ? "#c62828" : "#2e7d32", fontWeight: 700 }}>
                            {venc ? venc.toLocaleDateString("es-AR") : "-"}
                          </span>
                          {vencido && <span style={{ display: "block", fontSize: "0.68rem", color: "#c62828" }}>VENCIDO</span>}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{c.clienteNombre || "-"}</div>
                          {(c as any).sedeNombre && <div style={{ fontSize: "0.78rem", color: "var(--primary-blue)", fontWeight: 600 }}>📍 {(c as any).sedeNombre}</div>}
                          {c.clienteEmpresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{c.clienteEmpresa}</div>}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "0.82rem", color: "#555", maxWidth: "180px" }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.sistemaCertificado || "-"}</div>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontSize: "0.72rem", background: "#f0f4ff", color: "var(--primary-blue)", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
                            {c.rubro || "-"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: "20px", fontWeight: 800, textTransform: "capitalize", background: ec.bg, color: ec.color }}>
                            {c.estado || "borrador"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <Link title="Ver Vista Previa" href={`/admin/certificados/${c.id}?view=true`} 
                              style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                              <Eye size={18} strokeWidth={2.5} />
                            </Link>

                            {!isReadOnly && (
                              <Link title="Editar Documento" href={`/admin/certificados/${c.id}`} 
                                style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                                <Edit size={18} strokeWidth={2.5} />
                              </Link>
                            )}

                            <button 
                              title="Descargar PDF" 
                              onClick={() => handleDownloadPDF(c.id)}
                              disabled={downloadingId === c.id}
                              style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
                              <Scroll size={18} strokeWidth={2.5} style={{ opacity: downloadingId === c.id ? 0.5 : 1 }} />
                            </button>
                            
                            {isStaff && !isAdmin && !isReadOnly && (
                               <div style={{ width: "32px" }}></div> 
                            )}

                            {isAdmin && !isReadOnly &&(
                              <button title="Eliminar" onClick={() => setDeleteConfirm(c.id)} 
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

            {/* Mobile Cards */}
            <div className="show-on-mobile" style={{ display: "none", flexDirection: "column", gap: "12px", padding: "12px" }}>
              {filteredCerts.map(c => {
                const ec = ESTADO_COLORS[c.estado] || ESTADO_COLORS.borrador;
                const venc = c.fechaVencimiento ? new Date(c.fechaVencimiento + "T12:00:00") : null;
                const vencido = venc && venc < new Date();
                return (
                  <div key={c.id} style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1.5px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div>
                        <div style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "1.1rem" }}>N°{String(c.numero || "?").padStart(4, "0")}</div>
                        <div style={{ fontSize: "0.75rem", color: "#999", fontWeight: 600 }}>Inspección: {c.fechaInspeccion ? new Date(c.fechaInspeccion + "T12:00:00").toLocaleDateString("es-AR") : "-"}</div>
                      </div>
                      <span style={{ fontSize: "0.65rem", padding: "4px 10px", borderRadius: "20px", fontWeight: 800, textTransform: "capitalize", background: ec.bg, color: ec.color }}>{c.estado}</span>
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{c.clienteNombre}</div>
                      {(c as any).sedeNombre && <div style={{ fontSize: "0.8rem", color: "var(--primary-blue)", fontWeight: 600 }}>📍 {(c as any).sedeNombre}</div>}
                      <div style={{ fontSize: "0.8rem", color: "#888" }}>{c.clienteEmpresa}</div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                      <div>
                        <div style={{ fontSize: "0.6rem", color: "#999", textTransform: "uppercase", fontWeight: 700 }}>Sistema</div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.sistemaCertificado}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.6rem", color: "#999", textTransform: "uppercase", fontWeight: 700 }}>Vencimiento</div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: vencido ? "#c62828" : "#2e7d32" }}>{venc ? venc.toLocaleDateString("es-AR") : "-"}</div>
                      </div>
                    </div>

                      <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                        <Link href={`/admin/certificados/${c.id}?view=true`} style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                          <Eye size={20} strokeWidth={2.5} />
                        </Link>
                        {!isReadOnly && (
                          <Link href={`/admin/certificados/${c.id}`} style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                            <Edit size={20} strokeWidth={2.5} />
                          </Link>
                        )}
                        <button 
                          onClick={() => handleDownloadPDF(c.id)}
                          disabled={downloadingId === c.id}
                          style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "#f5f3ff", color: "#7c3aed", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Scroll size={20} strokeWidth={2.5} style={{ opacity: downloadingId === c.id ? 0.5 : 1 }} />
                        </button>
                        {isAdmin && !isReadOnly && (
                          <button onClick={() => setDeleteConfirm(c.id)} style={{ width: "42px", borderRadius: "8px", background: "#fff5f4", border: "1px solid #ffddd9", color: "var(--primary-red)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Trash2 size={20} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {activeTab === "textos" && (
        <div style={{ marginBottom: "20px" }}>
          {textos.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: "12px", padding: "60px", textAlign: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: "3rem", marginBottom: "12px", opacity: 0.3 }}>📝</div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No hay textos creados aún. Usá "+ Nuevo Texto" para agregar el primero.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {textos.map(t => (
                <div key={t.id} style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", border: "1px solid #eee" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <span style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "0.95rem" }}>{t.titulo}</span>
                    {isAdmin && (
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0, marginLeft: "10px" }}>
                        <button type="button" onClick={() => { setFormTexto({ titulo: t.titulo, contenido: t.contenido, id: t.id }); setTextoModal("edit"); }} style={{ padding: "5px 7px", borderRadius: "6px", border: "1px solid #ddd", background: "#f0f7ff", color: "#0061ff", cursor: "pointer", display: "flex" }}>
                          <Edit size={14} />
                        </button>
                        <button type="button" onClick={() => setDeletingTexto(t.id)} style={{ padding: "5px 7px", borderRadius: "6px", border: "1px solid #ffddd9", background: "#fff5f4", color: "var(--primary-red)", cursor: "pointer", display: "flex" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "#666", lineHeight: "1.6", margin: 0, whiteSpace: "pre-wrap", maxHeight: "80px", overflow: "hidden" }}>
                    {t.contenido}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {textoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "560px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "20px", color: "var(--primary-blue)" }}>
              {textoModal === "create" ? "Nuevo texto de memoria" : "Editar texto"}
            </h3>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase" }}>Título (nombre de la píldora)</label>
              <input value={formTexto.titulo} onChange={e => setFormTexto(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Detección y Alarma" style={{ width: "100%", padding: "10px 13px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.92rem", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase" }}>Contenido</label>
              <textarea value={formTexto.contenido} onChange={e => setFormTexto(f => ({ ...f, contenido: e.target.value }))} rows={8} style={{ width: "100%", padding: "10px 13px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.88rem", resize: "vertical", fontFamily: "inherit", lineHeight: "1.6", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={() => { setTextoModal(null); setFormTexto({ titulo: "", contenido: "", id: "" }); }} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button type="button" onClick={handleSaveTexto} className="btn-red" style={{ flex: 1, padding: "12px" }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {deletingTexto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar texto?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={() => setDeletingTexto(null)} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button type="button" onClick={() => handleDeleteTexto(deletingTexto)} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar certificado?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
      {/* STYLES */}
      <style jsx>{`
        @media (max-width: 768px) {
          .hide-on-mobile { display: none !important; }
          .show-on-mobile { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
