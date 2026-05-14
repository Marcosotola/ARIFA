"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, addDoc, updateDoc, setDoc, doc, getDoc, query, serverTimestamp, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import dynamic from "next/dynamic";
import { 
  ClipboardList, 
  FileText, 
  Camera, 
  PenTool, 
  ArrowLeft, 
  Check, 
  Download, 
  Save,
  Trash2,
  Plus
} from "lucide-react";

const SignatureCanvas = dynamic(() => import("react-signature-canvas"), { ssr: false }) as any;

// ─── Types ───────────────────────────────────────────────────────────────────
interface Cliente { id: string; nombre?: string; razonSocial?: string; empresa?: string; cuit?: string; direccion?: string; telefono?: string; email?: string; sedes?: any[]; }

// ─── Constants ───────────────────────────────────────────────────────────────
const RUBROS = ["Viviendas residenciales", "Edificio de oficinas", "Comercio", "Industrial", "Hotel / Apart-hotel", "Educación", "Salud", "Otro"];
const PASOS = ["Datos", "Memoria", "Fotos", "Firmas"];
const PASOS_ICONS = [
  { icon: ClipboardList, color: "#3b82f6" }, 
  { icon: FileText, color: "#f59e0b" }, 
  { icon: Camera, color: "#ec4899" }, 
  { icon: PenTool, color: "#ef4444" }
];

const DECLARACION_JURADA = `DECLARACION JURADA: La información consignada precedentemente reviste el carácter de Declaración Jurada; su omisión o falsedad precederá al decaimiento de su validez, sin perjuicio de las sanciones que pudiera corresponder. El profesional interviniente declara que cumple con las competencias exigidas, por ley, para completar el presente trabajo.`;

const TEXTOS_ESTANDAR: Record<string, string> = {
  "Detección y Alarma": `SISTEMA DE DETECCION Y ALARMA CONTRA INCENDIOS\nSe certifica que el establecimiento cuenta con un sistema de detección temprana de incendios, compuesto por una central de control, detectores automáticos de humo/temperatura, pulsadores manuales de alarma y avisadores sonoro-lumínicos. El sistema se encuentra operativo y cumple con las condiciones de mantenimiento preventivo.`,
  "Hidrantes": `SISTEMA DE EXTINCION POR AGUA (HIDRANTES)\nSe certifica la operatividad de la red de incendio compuesta por bocas de incendio equipadas (BIE). Se ha verificado la presencia de mangueras, lanzas y llaves de ajustar en cada gabinete, así como la presión estática y dinámica en los puntos más desfavorables.`,
  "Rociadores": `SISTEMA DE ROCIADORES AUTOMATICOS (SPRINKLERS)\nSe certifica que el sistema de rociadores automáticos se encuentra bajo presión y con sus válvulas de control en posición abierta. Se ha verificado el estado de las cabezas rociadoras, la ausencia de obstrucciones y el correcto funcionamiento de las alarmas de flujo.`,
  "Iluminación de Emergencia": `SISTEMA DE ILUMINACION DE EMERGENCIA\nSe ha verificado el correcto funcionamiento de las unidades de iluminación de emergencia autónomas distribuidas en los medios de salida. Se realizó la prueba de autonomía mínima requerida, asegurando los niveles de iluminancia necesarios para la evacuación segura del personal.`,
  "Señalización": `SEÑALIZACION DE MEDIOS DE ESCAPE\nEl establecimiento cuenta con señalización indicativa de salidas y medios de escape conforme a normativa vigente. Los carteles son fotoluminiscentes y/o iluminados, permitiendo la clara identificación de las rutas de egreso.`,
};

const labelSt: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#555", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.4px" };
const inputSt: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.92rem", outline: "none", boxSizing: "border-box" };
const cardSt: React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", marginBottom: "20px" };

function CertificadosEditor() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNuevo = params.id === "nuevo";
  const fromOt = searchParams.get("fromOt");

  const [paso, setPaso] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nextNum, setNextNum] = useState(1);
  const [role, setRole] = useState<string | null>(null);

  // Datos
  const [numero, setNumero] = useState("");
  const [fechaInspeccion, setFechaInspeccion] = useState(new Date().toISOString().split("T")[0]);
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [rubro, setRubro] = useState("");
  const [rubroCustom, setRubroCustom] = useState("");
  const [revPlanos, setRevPlanos] = useState("");
  const [sistemaCertificado, setSistemaCertificado] = useState("");
  const [responsableCertificado, setResponsableCertificado] = useState("");
  const [estado, setEstado] = useState<"borrador" | "emitido">("borrador");

  // Cliente
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteEmpresa, setClienteEmpresa] = useState("");
  const [clienteCuit, setClienteCuit] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [sedeNombre, setSedeNombre] = useState("");
  const [sedeRazonSocial, setSedeRazonSocial] = useState("");
  const [filteredSedes, setFilteredSedes] = useState<any[]>([]);

  // Memoria
  const [memoriaDescriptiva, setMemoriaDescriptiva] = useState("");

  // Fotos
  const [fotos, setFotos] = useState<string[]>([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Firmas
  const sigProfRef = useRef<any>(null);
  const sigCliRef = useRef<any>(null);
  const [firmaProfesional, setFirmaProfesional] = useState<string | null>(null);
  const [firmaCliente, setFirmaCliente] = useState<string | null>(null);

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

  const isReadOnly = role?.toLowerCase() === "cliente" || searchParams.get("view") === "true";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      setRole(userDoc.exists() ? userDoc.data().rol : "cliente");
      const [allCli] = await Promise.all([loadClientes(), loadTecnicos(), loadNextNum()]);
      if (isNuevo && fromOt) {
        await importFromOT(fromOt);
      } else if (!isNuevo) {
        await loadCertificado(allCli);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [fromOt]);

  useEffect(() => {
    if (!loading && searchParams.get("download") === "true") {
      handlePDF();
    }
  }, [loading]);

  const importFromOT = async (otId: string) => {
    try {
      const d = await getDoc(doc(db, "ordenes_trabajo", otId));
      if (!d.exists()) return;
      const data = d.data() as any;
      
      setClienteNombre(data.clienteNombre || data.cliente || "");
      setClienteEmpresa(data.clienteEmpresa || data.cliente || "");
      setClienteCuit(data.clienteCuit || "");
      setClienteDireccion(data.direccion || "");
      if (data.userId) {
        const uDoc = await getDoc(doc(db, "usuarios", data.userId));
        if (uDoc.exists()) {
          const uData = { id: uDoc.id, ...uDoc.data() } as any;
          setClienteSeleccionado(uData);
          setFilteredSedes(uData.sedes || []);
          if (data.sedeId) {
            setSedeId(data.sedeId);
            setSedeNombre(data.sedeNombre || "");
            setSedeRazonSocial(data.sedeRazonSocial || "");
          }
        }
      }
      
      if (data.planillasSeleccionadas && data.planillasSeleccionadas.length > 0) {
        setSistemaCertificado(data.planillasSeleccionadas.map((p:any) => p.nombre).join(", "));
      }
      
      setMemoriaDescriptiva(`Inspección realizada en base a Inspección Técnica N° IT-${String(data.numero || "").padStart(4, "0")}.`);
      setFotos(data.fotos || []);
    } catch (e) { console.error("Error importing from OT:", e); }
  };

  const loadClientes = async () => {
    try {
      const snap = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente")));
      const clis = snap.docs.map(d => ({ id: d.id, ...d.data() } as Cliente));
      setClientes(clis);
      return clis;
    } catch { return []; }
  };

  const handleCreateNewClient = async () => {
    if (!newClientData.nombre || !newClientData.email) return alert("Nombre y Email son obligatorios");
    try {
      const docRef = await addDoc(collection(db, "usuarios"), {
        ...newClientData,
        rol: "cliente",
        createdAt: serverTimestamp()
      });
      const newC = { id: docRef.id, ...newClientData, rol: "cliente" };
      setClientes([...clientes, newC]);
      setClienteSeleccionado(newC);
      setClienteSearch("");
      setFilteredSedes(newC.sedes || []);
      setClienteDireccion(newC.direccion || "");
      setShowNewClientModal(false);
      setNewClientData({ nombre: "", apellido: "", email: "", empresa: "", dniCuit: "", telefono: "", direccion: "", sedes: [] });
    } catch (e) {
      alert("Error al crear cliente: " + e);
    }
  };

  const loadTecnicos = async () => {
    try {
      const q = query(collection(db, "usuarios"), where("rol", "==", "tecnico"));
      const snap = await getDocs(q);
      setTecnicos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error loading técnicos:", e);
    }
  };

  const loadNextNum = async () => {
    try {
      const configSnap = await getDoc(doc(db, "configuracion", "certificados"));
      if (configSnap.exists()) {
        const n = configSnap.data().proximoNumero || 1;
        setNextNum(n); setNumero(String(n));
      } else {
        const snap = await getDocs(collection(db, "certificados"));
        const nums = snap.docs.map(d => (d.data() as any).numero || 0);
        const n = nums.length ? Math.max(...nums) + 1 : 1;
        setNextNum(n); setNumero(String(n));
      }
    } catch { setNumero("1"); }
  };

  const loadCertificado = async (allCli?: Cliente[]) => {
    const list = allCli || clientes;
    try {
      const d = await getDoc(doc(db, "certificados", params.id as string));
      if (!d.exists()) return;
      const data = d.data() as any;
      setNumero(String(data.numero || ""));
      setFechaInspeccion(data.fechaInspeccion || "");
      setFechaVencimiento(data.fechaVencimiento || "");
      setRubro(data.rubro || "");
      setRevPlanos(data.revPlanos || "");
      setSistemaCertificado(data.sistemaCertificado || "");
      setResponsableCertificado(data.responsableCertificado || "");
      setEstado(data.estado || "borrador");
      setClienteNombre(data.clienteNombre || "");
      setClienteEmpresa(data.clienteEmpresa || "");
      setClienteCuit(data.clienteCuit || "");
      setClienteDireccion(data.clienteDireccion || "");
      setSedeId(data.sedeId || "");
      setSedeNombre(data.sedeNombre || "");
      setSedeRazonSocial(data.sedeRazonSocial || "");
      if (data.clienteId) {
        const fullClient = list.find(c => c.id === data.clienteId);
        if (fullClient) {
          setClienteSeleccionado(fullClient);
          setFilteredSedes((fullClient as any).sedes || []);
        }
      }
      setMemoriaDescriptiva(data.memoriaDescriptiva || "");
      setFotos(data.fotos || []);
      setFirmaProfesional(data.firmaProfesional || null);
      setFirmaCliente(data.firmaCliente || null);
    } catch (e) { console.error(e); }
  };

  const handleSave = async (estadoOverride?: string) => {
    setSaving(true);
    try {
      const rubroFinal = rubro === "Otro" ? rubroCustom : rubro;
      const payload: any = {
        numero: parseInt(numero) || nextNum,
        fechaInspeccion, fechaVencimiento,
        rubro: rubroFinal, revPlanos,
        sistemaCertificado, responsableCertificado,
        clienteId: clienteSeleccionado?.id || null,
        clienteNombre: clienteSeleccionado?.nombre || clienteSeleccionado?.razonSocial || clienteNombre,
        clienteEmpresa: sedeRazonSocial || clienteSeleccionado?.empresa || clienteSeleccionado?.razonSocial || clienteEmpresa,
        clienteCuit: clienteSeleccionado?.cuit || clienteCuit,
        clienteDireccion: clienteDireccion || clienteSeleccionado?.direccion || "",
        sedeId: sedeId || null,
        sedeNombre: sedeNombre || "",
        sedeRazonSocial: sedeRazonSocial || "",
        memoriaDescriptiva,
        fotos, firmaProfesional, firmaCliente,
        estado: estadoOverride || estado,
        updatedAt: serverTimestamp(),
      };
      if (isNuevo) {
        await addDoc(collection(db, "certificados"), { ...payload, createdAt: serverTimestamp() });
        await setDoc(doc(db, "configuracion", "certificados"), { proximoNumero: (parseInt(numero) || nextNum) + 1 }, { merge: true });
      } else {
        await updateDoc(doc(db, "certificados", params.id as string), payload);
      }

      if (clienteSeleccionado?.id) {
        await updateDoc(doc(db, "usuarios", clienteSeleccionado.id), {
          nombre: clienteNombre || clienteSeleccionado.nombre || null,
          empresa: clienteEmpresa || clienteSeleccionado.empresa || null,
          cuit: clienteCuit || clienteSeleccionado.cuit || null,
          direccion: clienteDireccion || clienteSeleccionado.direccion || null,
          updatedAt: serverTimestamp()
        }).catch(err => console.error("Error updating client profile:", err));
      }

      router.push("/admin/certificados");
    } catch (e) { alert("Error al guardar: " + e); }
    finally { setSaving(false); }
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFoto(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const r = ref(storage, `certificados/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        urls.push(await getDownloadURL(r));
      }
      setFotos(prev => [...prev, ...urls]);
    } catch { alert("Error al subir foto."); }
    finally { setUploadingFoto(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handlePDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
    const nCert = String(parseInt(numero) || nextNum).padStart(4, "0");
    const rubroFinal = rubro === "Otro" ? rubroCustom : rubro;
    const cn = clienteSeleccionado?.nombre || clienteSeleccionado?.razonSocial || clienteNombre || "-";
    const ce = clienteSeleccionado?.empresa || clienteSeleccionado?.razonSocial || clienteEmpresa || "";
    const cuit = clienteSeleccionado?.cuit || clienteCuit || "";
    const cdir = clienteSeleccionado?.direccion || clienteDireccion || "";
    const fInsp = fechaInspeccion ? new Date(fechaInspeccion + "T12:00:00").toLocaleDateString("es-AR") : "-";
    const fVenc = fechaVencimiento ? new Date(fechaVencimiento + "T12:00:00").toLocaleDateString("es-AR") : "-";

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
    } catch { /* skip */ }

    const drawPageHeader = (pdf: any) => {
      const HEADER_H = 36;
      const TOP = 10;
      pdf.setDrawColor(0, 34, 68);
      pdf.setLineWidth(0.5);
      pdf.rect(ML, TOP, TW, HEADER_H);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(ML, TOP, 36, HEADER_H, "F");
      if (logoDataUrl) pdf.addImage(logoDataUrl, "PNG", ML + 2, TOP + 3, 31, 26);
      pdf.line(ML + 36, TOP, ML + 36, TOP + HEADER_H);
      const rx = W - MR - 52;
      const cx = ML + 36 + (rx - ML - 36) / 2;
      pdf.setFont(undefined as any, "bold"); pdf.setFontSize(9); pdf.setTextColor(0, 34, 68);
      pdf.text("Certificado de Instalaciones", cx, TOP + 8, { align: "center" });
      pdf.text("contra incendio, y emergencias", cx, TOP + 13, { align: "center" });
      pdf.setFontSize(7.5); pdf.setTextColor(163, 31, 29);
      pdf.text("DOCUMENTO TIENE CARÁCTER DE DECLARACIÓN JURADA.", cx, TOP + 19, { align: "center" });
      pdf.setTextColor(0); pdf.setFont(undefined as any, "bold"); pdf.setFontSize(9);
      pdf.text(`CERTIFICADO  N°${nCert}`, cx, TOP + 28, { align: "center" });
      pdf.setFont(undefined as any, "italic"); pdf.setFontSize(7); pdf.setTextColor(90);
      pdf.text("Ingeniería contra Incendio", ML + 2, TOP + HEADER_H - 2);
      pdf.line(rx, TOP, rx, TOP + HEADER_H);
      pdf.setFont(undefined as any, "normal"); pdf.setFontSize(8); pdf.setTextColor(0);
      const rowH = HEADER_H / 4;
      const rows = [
        ["Rubro:", rubroFinal || "-"],
        ["Fecha:", fInsp],
        ["Rev. planos:", revPlanos || "-"],
        ["Pagina:", String(pdf.getCurrentPageInfo().pageNumber)],
      ];
      rows.forEach(([k, v], i) => {
        const ry = TOP + rowH * i + rowH / 2 + 1.5;
        pdf.setFont(undefined as any, "bold"); pdf.text(k, rx + 2, ry);
        pdf.setFont(undefined as any, "normal"); pdf.text(v, rx + 24, ry);
        if (i < rows.length - 1) pdf.line(rx, TOP + rowH * (i + 1), W - MR, TOP + rowH * (i + 1));
      });
      pdf.line(ML, TOP + HEADER_H, W - MR, TOP + HEADER_H);
      return TOP + HEADER_H + 6;
    };

    let y = drawPageHeader(pdf);

    autoTable(pdf, {
      startY: y, margin: { left: ML, right: MR },
      body: [
        [{ content: "Fecha de Inspección", styles: { fontStyle: "bold", cellWidth: 45 } }, fInsp,
         { content: "Fecha de Vencimiento", styles: { fontStyle: "bold", cellWidth: 45 } }, fVenc],
        [{ content: "Sistema certificado:", styles: { fontStyle: "bold" } }, { content: sistemaCertificado || "-", colSpan: 3, styles: { fontStyle: "bold", textColor: [163, 31, 29] } }],
        [{ content: "Cliente:", styles: { fontStyle: "bold" } }, { content: cn + (sedeNombre ? ` - SEDE: ${sedeNombre}` : ""), colSpan: 3, styles: { halign: "center", fontStyle: "bold" } }],
        [{ content: "Razón social:", styles: { fontStyle: "bold" } }, { content: cuit || sedeRazonSocial || ce || "-", colSpan: 3, styles: { halign: "center" } }],
        [{ content: "Domicilio:", styles: { fontStyle: "bold" } }, { content: clienteDireccion || cdir || "-", colSpan: 3 }],
        [{ content: "Responsable certificado:", styles: { fontStyle: "bold" } }, { content: responsableCertificado || "-", colSpan: 3 }],
        [{ content: "Empresa Certificante:", styles: { fontStyle: "bold" } }, { content: "ARIFA — INGENIERIA EN SEGURIDAD CONTRA INCENDIOS  |  CUIT 20-35108395-7  |  www.arifa.com.ar", colSpan: 3, styles: { fontStyle: "bold", textColor: [0, 34, 68] } }],
      ],
      styles: { fontSize: 9, cellPadding: 4 },
      tableLineColor: [0, 34, 68], tableLineWidth: 0.3,
      didParseCell: (data: any) => {
        if (data.row.index === 7) data.cell.styles.fillColor = [245, 247, 255];
      },
    });

    y = (pdf as any).lastAutoTable.finalY + 10;

    if (memoriaDescriptiva.trim()) {
      const lines = memoriaDescriptiva.split("\n");
      let firstSection = true;
      for (const line of lines) {
        if (y > 260) { pdf.addPage(); y = drawPageHeader(pdf) + 5; }
        if (!line.trim()) { y += 4; continue; }
        const isHeader = line === line.toUpperCase() && line.trim().length > 3;
        pdf.setFont(undefined as any, isHeader ? "bold" : "normal");
        pdf.setFontSize(isHeader ? 10 : 9);
        pdf.setTextColor(isHeader ? 0 : 50);
        if (isHeader && !firstSection) y += 3;
        const wrapped = pdf.splitTextToSize(line, TW);
        pdf.text(wrapped, ML, y);
        y += wrapped.length * (isHeader ? 6 : 5);
        firstSection = false;
      }
      y += 6;
    }

    if (fotos.length > 0) {
      if (y > 180) { pdf.addPage(); y = drawPageHeader(pdf) + 5; }
      let col = 0;
      const imgW = (TW - 5) / 2;
      for (const url of fotos) {
        try {
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = proxyUrl; });
          const cnv = document.createElement("canvas");
          const maxW = 1200; const maxH = 900;
          const ratio = Math.min(maxW / (img.naturalWidth || maxW), maxH / (img.naturalHeight || maxH), 1);
          cnv.width = Math.round((img.naturalWidth || maxW) * ratio);
          cnv.height = Math.round((img.naturalHeight || maxH) * ratio);
          cnv.getContext("2d")!.drawImage(img, 0, 0, cnv.width, cnv.height);
          const du = cnv.toDataURL("image/jpeg", 0.82);
          const x = ML + col * (imgW + 5);
          pdf.addImage(du, "JPEG", x, y, imgW, 55);
          col++;
          if (col === 2) { col = 0; y += 58; }
          if (y > 230) { pdf.addPage(); y = drawPageHeader(pdf) + 5; col = 0; }
        } catch { /* skip */ }
      }
      if (col > 0) y += 58;
      y += 6;
    }

    if (y > 210) { pdf.addPage(); y = drawPageHeader(pdf) + 5; }
    pdf.setFont(undefined as any, "bold"); pdf.setFontSize(9); pdf.setTextColor(0);
    pdf.text("DECLARACION JURADA:", ML, y);
    y += 6;
    pdf.setFont(undefined as any, "normal"); pdf.setFontSize(8.5); pdf.setTextColor(40);
    const djText = DECLARACION_JURADA.replace("DECLARACION JURADA: ", "");
    const djLines = pdf.splitTextToSize(djText, TW);
    pdf.text(djLines, ML, y);
    y += djLines.length * 5 + 10;

    const bw = (TW - 10) / 2;
    pdf.rect(ML, y, bw, 28); pdf.rect(ML + bw + 10, y, bw, 28);
    pdf.setFontSize(8); pdf.setTextColor(80);
    pdf.text("Firma Profesional Interviniente", ML + 2, y + 4);
    pdf.text("Firma Propietario/Responsable del Inmueble", ML + bw + 12, y + 4);
    if (firmaProfesional) try { pdf.addImage(firmaProfesional, "PNG", ML + 5, y + 6, bw - 10, 18); } catch { /* skip */ }
    if (firmaCliente) try { pdf.addImage(firmaCliente, "PNG", ML + bw + 15, y + 6, bw - 10, 18); } catch { /* skip */ }

    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7); pdf.setTextColor(150);
      pdf.text(`Página ${i} / ${total}`, W / 2, 295, { align: "center" });
    }
    pdf.save(`ARIFA-Cert-${nCert}.pdf`);
  };

  if (loading) return <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Cargando...</div>;

  const clientesFiltrados = clientes.filter(c =>
    clienteSearch.length < 2 ? false :
    `${c.nombre || ""} ${c.razonSocial || ""} ${c.empresa || ""} ${c.email || ""}`.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      <header style={{ marginBottom: "25px", display: "flex", justifyContent: "space-between", alignItems: 'center' }}>
        <div>
          <button onClick={() => router.push("/admin/certificados")} 
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", marginBottom: "15px" }}>
            <ArrowLeft size={18} /> Volver
          </button>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--primary-blue)" }}>
            {isNuevo ? "Nuevo Certificado" : `Certificado N°${String(numero).padStart(4, "0")}`}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {!isNuevo && (
            <button onClick={handlePDF} 
              style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={18} /> Descargar PDF
            </button>
          )}
          {!isReadOnly && (
            <button onClick={() => handleSave("emitido")} disabled={saving} className="btn-red" 
              style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {saving ? "Guardando..." : <><Check size={18} /> Finalizar</>}
            </button>
          )}
        </div>
      </header>

      {isReadOnly ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: 'var(--primary-blue)', marginBottom: '15px', fontSize: '1.2rem' }}>Resumen del Certificado</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '0.9rem' }}>
              <div><span style={{ fontWeight: 700, color: '#666' }}>Fecha Inspección:</span> {fechaInspeccion ? new Date(fechaInspeccion + "T12:00:00").toLocaleDateString('es-AR') : '-'}</div>
              <div><span style={{ fontWeight: 700, color: '#666' }}>Vencimiento:</span> {fechaVencimiento ? new Date(fechaVencimiento + "T12:00:00").toLocaleDateString('es-AR') : '-'}</div>
              <div style={{ gridColumn: 'span 2' }}><span style={{ fontWeight: 700, color: '#666' }}>Sistema Certificado:</span> {sistemaCertificado || '-'}</div>
              <div style={{ gridColumn: 'span 2' }}><span style={{ fontWeight: 700, color: '#666' }}>Rubro:</span> {rubro === 'Otro' ? rubroCustom : rubro}</div>
              <div style={{ gridColumn: 'span 2' }}><span style={{ fontWeight: 700, color: '#666' }}>Ubicación:</span> {sedeNombre ? `${sedeNombre} (${clienteDireccion})` : (clienteSeleccionado?.direccion || clienteDireccion || '-')}</div>
            </div>
          </div>
          <div style={cardSt}>
             <h3 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px" }}>Memoria Descriptiva</h3>
             <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#444', lineHeight: '1.6' }}>{memoriaDescriptiva}</div>
          </div>
          {fotos.length > 0 && (
            <div style={cardSt}>
              <h3 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px" }}>Galería Fotográfica</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                {fotos.map((url, i) => (
                  <img key={i} src={url} alt="Evidencia" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px' }} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
      <div style={{ background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", marginBottom: "30px", display: "flex" }}>
        {PASOS.map((p, i) => {
          const { icon: Icon, color: stepColor } = PASOS_ICONS[i];
          const isActive = i === paso;
          const isCompleted = i < paso;
          return (
            <button key={p} onClick={() => setPaso(i)}
              style={{ flex: 1, padding: "14px 10px", border: "none", cursor: "pointer", fontWeight: isActive ? 800 : 500, fontSize: "0.82rem",
                background: isActive ? stepColor : isCompleted ? `${stepColor}15` : "#fff",
                color: isActive ? "#fff" : isCompleted ? stepColor : "#64748b",
                borderRight: i < PASOS.length - 1 ? "1px solid #f0f0f0" : "none", transition: "0.2s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isCompleted ? <Check size={20} strokeWidth={3} /> : <Icon size={20} strokeWidth={isActive ? 3 : 2} color={isActive ? "#fff" : stepColor} />}
              </div>
              {p}
            </button>
          );
        })}
      </div>

      {paso === 0 && (
        <div>
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "18px", fontSize: "1rem" }}>Datos del Certificado</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={labelSt}>N° Certificado</label>
                <input style={inputSt} type="number" value={numero} onChange={e => setNumero(e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Estado</label>
                <select style={inputSt} value={estado} onChange={e => setEstado(e.target.value as any)}>
                  <option value="borrador">Borrador</option>
                  <option value="emitido">Emitido</option>
                </select>
              </div>
              <div>
                <label style={labelSt}>Fecha de Inspección</label>
                <input style={inputSt} type="date" value={fechaInspeccion} onChange={e => setFechaInspeccion(e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Fecha de Vencimiento</label>
                <input style={inputSt} type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Rubro</label>
                <select style={inputSt} value={rubro} onChange={e => setRubro(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {rubro === "Otro" && (
                <div>
                  <label style={labelSt}>Rubro personalizado</label>
                  <input style={inputSt} value={rubroCustom} onChange={e => setRubroCustom(e.target.value)} placeholder="Ej: Depósito logístico" />
                </div>
              )}
              <div>
                <label style={labelSt}>Rev. Planos</label>
                <input style={inputSt} value={revPlanos} onChange={e => setRevPlanos(e.target.value)} placeholder="Ej: Abril 2026" />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelSt}>Sistema Certificado</label>
                <input style={inputSt} value={sistemaCertificado} onChange={e => setSistemaCertificado(e.target.value)} placeholder="Ej: Sistema de detección y alarma — Presurización de caja de escalera" />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelSt}>Responsable Certificado</label>
                <select 
                  style={inputSt} 
                  value={responsableCertificado} 
                  onChange={e => setResponsableCertificado(e.target.value)}
                >
                  <option value="">Seleccionar Responsable...</option>
                  {tecnicos.map(t => (
                    <option key={t.id} value={t.nombre || t.email}>{t.nombre || t.email}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={cardSt}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "1rem" }}>Datos del Cliente / Inmueble</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ position: "relative" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={labelSt}>Buscar cliente registrado</label>
                  <button type="button" onClick={() => setShowNewClientModal(true)} style={{ background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: '0.2s' }}>
                    <Plus size={14} /> NUEVO CLIENTE
                  </button>
                </div>
                <input style={inputSt}
                  value={clienteSeleccionado ? (clienteSeleccionado.nombre || clienteSeleccionado.razonSocial || clienteSeleccionado.empresa || clienteSeleccionado.email) : clienteSearch}
                  onChange={e => { setClienteSearch(e.target.value); setClienteSeleccionado(null); setFilteredSedes([]); setSedeId(""); setSedeNombre(""); }}
                  placeholder="Nombre, empresa o email..." />
                {clientesFiltrados.length > 0 && !clienteSeleccionado && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "8px", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "200px", overflowY: "auto" }}>
                    {clientesFiltrados.map(c => (
                      <div key={c.id} onClick={() => { setClienteSeleccionado(c); setClienteSearch(""); setFilteredSedes(c.sedes || []); setClienteDireccion(c.direccion || ""); }}
                        style={{ padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}>
                        <div style={{ fontWeight: 700 }}>{c.nombre || c.razonSocial || c.email}</div>
                        {c.empresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{c.empresa}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {clienteSeleccionado && (
                <>
                  <div style={{ background: "#f0f4ff", borderRadius: "8px", padding: "12px 15px", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{clienteSeleccionado.nombre || clienteSeleccionado.razonSocial}</div>
                      <div style={{ fontSize: "0.8rem", color: "#666" }}>{clienteSeleccionado.empresa} — {clienteSeleccionado.direccion}</div>
                    </div>
                    <button onClick={() => { setClienteSeleccionado(null); setFilteredSedes([]); setSedeId(""); setSedeNombre(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}>✕</button>
                  </div>
                  <div>
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
                      <option value="">{filteredSedes.length === 0 ? "Sin sedes registradas" : "Seleccionar sede (Opcional)"}</option>
                      {filteredSedes.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre} ({s.direccion})</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <button onClick={() => setPaso(1)} className="btn-blue" style={{ padding: "12px 28px" }}>Siguiente → Memoria</button>
          </div>
        </div>
      )}

      {paso === 1 && (
        <div>
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "6px", fontSize: "1rem" }}>Memoria Descriptiva</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
              Describí los sistemas certificados. Las líneas en MAYÚSCULAS se interpretarán como títulos de sección en el PDF.
            </p>
            <div style={{ marginBottom: "15px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#666", alignSelf: "center" }}>Insertar texto estándar:</span>
              {Object.keys(TEXTOS_ESTANDAR).map(key => (
                <button key={key} type="button" onClick={() => setMemoriaDescriptiva(prev => prev + (prev ? "\n\n" : "") + TEXTOS_ESTANDAR[key])}
                  style={{ padding: "4px 10px", borderRadius: "15px", border: "1px solid #ddd", background: "#f8f9fa", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", color: "var(--primary-blue)" }}>
                  + {key}
                </button>
              ))}
            </div>
            <textarea
              style={{ ...inputSt, height: "420px", resize: "vertical", fontFamily: "inherit", lineHeight: "1.6" }}
              value={memoriaDescriptiva}
              onChange={e => setMemoriaDescriptiva(e.target.value)}
              placeholder={`SISTEMA DE DETECCION Y ALARMA CONTRA INCENDIOS\nLa presente memoria descriptiva detalla el sistema...\n\nNORMATIVA APLICABLE\nEl sistema ha sido diseñado conforme a NFPA 72...`}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setPaso(0)} style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>← Anterior</button>
            <button onClick={() => setPaso(2)} className="btn-blue" style={{ padding: "12px 28px" }}>Siguiente → Fotos</button>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div>
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "16px", fontSize: "1rem" }}>Fotos del Servicio</h2>
            <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" style={{ display: "none" }} onChange={handleFotoUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFoto}
              style={{ width: "100%", padding: "24px", borderRadius: "10px", border: "2px dashed #ccc", background: "#fafafa", cursor: "pointer", fontSize: "1rem", color: "#999", marginBottom: "20px" }}>
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
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setPaso(1)} style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>← Anterior</button>
            <button onClick={() => setPaso(3)} className="btn-blue" style={{ padding: "12px 28px" }}>Siguiente → Firmas</button>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div>
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "20px", fontSize: "1rem" }}>Firmas</h2>
            {[
              { label: "Firma Profesional Interviniente", sig: firmaProfesional, setSig: setFirmaProfesional, ref: sigProfRef },
              { label: "Firma Propietario / Responsable del Inmueble", sig: firmaCliente, setSig: setFirmaCliente, ref: sigCliRef },
            ].map(({ label, sig, setSig, ref: sigRef }) => (
              <div key={label} style={{ marginBottom: "28px" }}>
                <label style={labelSt}>{label}</label>
                <div style={{ border: "2px solid #ddd", borderRadius: "10px", overflow: "hidden", background: "#f9f9f9", touchAction: "none" }}>
                  <SignatureCanvas ref={sigRef} penColor="#002244"
                    canvasProps={{ width: 800, height: 180, style: { width: "100%", height: "180px" } }} />
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button onClick={() => sigRef.current?.clear()}
                    style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Trash2 size={14} /> Limpiar
                  </button>
                  <button onClick={() => { if (!sigRef.current?.isEmpty()) setSig(sigRef.current.getTrimmedCanvas().toDataURL("image/png")); }}
                    className="btn-blue" style={{ padding: "8px 16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Check size={14} strokeWidth={3} /> Guardar firma
                  </button>
                  {sig && <span style={{ fontSize: "0.8rem", color: "#4CAF50", alignSelf: "center", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Check size={14} strokeWidth={3} /> Firma guardada
                  </span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <button onClick={() => setPaso(2)} style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>← Anterior</button>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => handleSave("borrador")} disabled={saving}
                style={{ padding: "12px 20px", borderRadius: "8px", border: "1.5px solid var(--primary-blue)", background: "transparent", color: "var(--primary-blue)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                <Save size={18} strokeWidth={2.5} /> {saving ? "Guardando..." : "Guardar borrador"}
              </button>
              <button onClick={() => handleSave("emitido")} disabled={saving} className="btn-red" 
                style={{ padding: "12px 24px", display: "flex", alignItems: "center", gap: "8px", textTransform: "uppercase" }}>
                {saving ? "⏳" : <Check size={20} strokeWidth={3} />} {saving ? "Guardando..." : "Emitir Certificado"}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
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
                      }} style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "4px", padding: "8px", cursor: "pointer" }}>✕</button>
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
    </div>
  );
}

export default function CertificadoPage() {
  return <Suspense fallback={<div>Cargando editor...</div>}><CertificadosEditor /></Suspense>;
}
