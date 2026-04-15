"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import dynamic from "next/dynamic";

const SignatureCanvas = dynamic(() => import("react-signature-canvas"), { ssr: false }) as any;

// ─── Types ───────────────────────────────────────────────────────────────────
interface Cliente { id: string; nombre?: string; razonSocial?: string; empresa?: string; cuit?: string; direccion?: string; telefono?: string; email?: string; }

// ─── Constants ───────────────────────────────────────────────────────────────
const RUBROS = ["Viviendas residenciales", "Edificio de oficinas", "Comercio", "Industrial", "Hotel / Apart-hotel", "Educación", "Salud", "Otro"];
const PASOS = ["Datos", "Memoria", "Fotos", "Firmas"];
const PASOS_ICONS = ["📋", "📝", "📷", "✍️"];

const DECLARACION_JURADA = `DECLARACION JURADA: La información consignada precedentemente reviste el carácter de Declaración Jurada; su omisión o falsedad precederá al decaimiento de su validez, sin perjuicio de las sanciones que pudiera corresponder. El profesional interviniente declara que cumple con las competencias exigidas, por ley, para completar el presente trabajo.`;

const labelSt: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#555", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.4px" };
const inputSt: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.92rem", outline: "none", boxSizing: "border-box" };
const cardSt: React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", marginBottom: "20px" };

export default function CertificadoEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNuevo = params.id === "nuevo";

  const [paso, setPaso] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nextNum, setNextNum] = useState(1);

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
  const [clienteManual, setClienteManual] = useState(false);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteEmpresa, setClienteEmpresa] = useState("");
  const [clienteCuit, setClienteCuit] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      await Promise.all([loadClientes(), loadNextNum()]);
      if (!isNuevo) await loadCertificado();
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loadClientes = async () => {
    try {
      const snap = await getDocs(query(collection(db, "usuarios"), orderBy("nombre")));
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cliente)));
    } catch { /* ok */ }
  };

  const loadNextNum = async () => {
    try {
      const snap = await getDocs(collection(db, "certificados"));
      const nums = snap.docs.map(d => (d.data() as any).numero || 0);
      const n = nums.length ? Math.max(...nums) + 1 : 1;
      setNextNum(n); setNumero(String(n));
    } catch { setNumero("1"); }
  };

  const loadCertificado = async () => {
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
      setClienteManual(data.clienteManual || false);
      setClienteNombre(data.clienteNombre || "");
      setClienteEmpresa(data.clienteEmpresa || "");
      setClienteCuit(data.clienteCuit || "");
      setClienteDireccion(data.clienteDireccion || "");
      if (data.clienteId) setClienteSeleccionado({ id: data.clienteId, nombre: data.clienteNombre, razonSocial: data.clienteEmpresa, empresa: data.clienteEmpresa, cuit: data.clienteCuit, direccion: data.clienteDireccion, email: "" });
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
        clienteEmpresa: clienteSeleccionado?.empresa || clienteSeleccionado?.razonSocial || clienteEmpresa,
        clienteCuit: clienteSeleccionado?.cuit || clienteCuit,
        clienteDireccion: clienteSeleccionado?.direccion || clienteDireccion,
        clienteManual,
        memoriaDescriptiva,
        fotos, firmaProfesional, firmaCliente,
        estado: estadoOverride || estado,
        updatedAt: serverTimestamp(),
      };
      if (isNuevo) {
        await addDoc(collection(db, "certificados"), { ...payload, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, "certificados", params.id as string), payload);
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
    const fInsp = fechaInspeccion ? new Date(fechaInspeccion).toLocaleDateString("es-AR") : "-";
    const fVenc = fechaVencimiento ? new Date(fechaVencimiento).toLocaleDateString("es-AR") : "-";

    // Logo
    let logoDataUrl: string | null = null;
    try {
      const resp = await fetch("/logos/logoFondoTransparente.svg");
      const blob = await resp.blob();
      logoDataUrl = await new Promise<string>(res => {
        const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob);
      });
    } catch { /* skip */ }

    const drawPageHeader = (pdf: any) => {
      // Outer border
      pdf.setDrawColor(0, 34, 68);
      pdf.setLineWidth(0.5);
      pdf.rect(ML, 10, TW, 28);
      // Logo cell
      pdf.setFillColor(255, 255, 255);
      pdf.rect(ML, 10, 35, 28, "F");
      if (logoDataUrl) pdf.addImage(logoDataUrl, "SVG", ML + 2, 12, 31, 24);
      // Center cell
      pdf.setFillColor(255, 255, 255);
      pdf.line(ML + 35, 10, ML + 35, 38);
      pdf.setFont(undefined as any, "bold"); pdf.setFontSize(9); pdf.setTextColor(0, 34, 68);
      pdf.text("Certificado de Instalaciones", ML + 35 + (TW - 35 - 50) / 2, 17, { align: "center" });
      pdf.text("contra incendio, y emergencias", ML + 35 + (TW - 35 - 50) / 2, 21, { align: "center" });
      pdf.setFontSize(8); pdf.setTextColor(163, 31, 29);
      pdf.text("DOCUMENTO TIENE CARÁCTER DE", ML + 35 + (TW - 35 - 50) / 2, 26, { align: "center" });
      pdf.text("DECLARACIÓN JURADA.", ML + 35 + (TW - 35 - 50) / 2, 30, { align: "center" });
      pdf.setTextColor(0); pdf.setFont(undefined as any, "bold"); pdf.setFontSize(9);
      pdf.text(`CERTIFICADO  N°${nCert}`, ML + 35 + (TW - 35 - 50) / 2, 35, { align: "center" });
      // Right info box
      const rx = W - MR - 50;
      pdf.line(rx, 10, rx, 38);
      pdf.setFont(undefined as any, "normal"); pdf.setFontSize(8); pdf.setTextColor(0);
      const rows = [["Rubro:", rubroFinal || "-"], ["Fecha:", fInsp], ["Rev. planos:", revPlanos || "-"]];
      rows.forEach(([k, v], i) => {
        pdf.setFont(undefined as any, "bold"); pdf.text(k, rx + 2, 17 + i * 7);
        pdf.setFont(undefined as any, "normal"); pdf.text(v, rx + 22, 17 + i * 7);
        if (i < 2) pdf.line(rx, 10 + (i + 1) * 7 + 3, W - MR, 10 + (i + 1) * 7 + 3);
      });
      // Footer line "Ingeniería contra Incendio"
      pdf.line(ML, 38, W - MR, 38);
      pdf.setFont(undefined as any, "normal"); pdf.setFontSize(7.5); pdf.setTextColor(80);
      pdf.text("Ingeniería contra Incendio", ML + 2, 36);
      // Right-bottom: Pagina
      const totalPages = pdf.getNumberOfPages();
      pdf.setFont(undefined as any, "bold"); pdf.setFontSize(8); pdf.setTextColor(0);
      pdf.line(rx, 31, W - MR, 31);
      pdf.text("Pagina", rx + 2, 35); 
      pdf.text(String(pdf.getCurrentPageInfo().pageNumber), rx + 25, 35);
      return 42; // y after header
    };

    // ── PAGE 1 — Datos del certificado ────────────────────────────────────────
    let y = drawPageHeader(pdf);

    // Datos table
    autoTable(pdf, {
      startY: y, margin: { left: ML, right: MR },
      body: [
        [{ content: "Fecha de Inspección", styles: { fontStyle: "bold", cellWidth: 45 } }, fInsp,
         { content: "Fecha de Vencimiento", styles: { fontStyle: "bold", cellWidth: 45 } }, fVenc],
        [{ content: "Sistema certificado:", styles: { fontStyle: "bold" } }, { content: sistemaCertificado || "-", colSpan: 3, styles: { fontStyle: "bold", textColor: [163, 31, 29] } }],
        [{ content: "Cliente:", styles: { fontStyle: "bold" } }, { content: cn, colSpan: 3, styles: { halign: "center", fontStyle: "bold" } }],
        [{ content: "Razón social:", styles: { fontStyle: "bold" } }, { content: cuit || ce || "-", colSpan: 3, styles: { halign: "center" } }],
        [{ content: "Domicilio:", styles: { fontStyle: "bold" } }, { content: cdir || "-", colSpan: 3 }],
        [{ content: "Responsable certificado:", styles: { fontStyle: "bold" } }, { content: responsableCertificado || "-", colSpan: 3 }],
        [
          { content: "Empresa Certificante:", styles: { fontStyle: "bold", rowSpan: 2 } },
          {
            content: "ARIFA\nINGENIERIA EN SEGURIDAD CONTRA INCENDIOS\nCUIT 20-35108395-7\nwww.arifa.com.ar",
            colSpan: 3,
            styles: { fontStyle: "bold", fontSize: 11, textColor: [0, 34, 68] },
          },
        ],
      ],
      styles: { fontSize: 9, cellPadding: 4 },
      tableLineColor: [0, 34, 68], tableLineWidth: 0.3,
      didParseCell: (data: any) => {
        if (data.row.index === 7) data.cell.styles.fillColor = [245, 247, 255];
      },
    });

    y = (pdf as any).lastAutoTable.finalY + 10;

    // ── Memoria Descriptiva ───────────────────────────────────────────────────
    if (memoriaDescriptiva.trim()) {
      const lines = memoriaDescriptiva.split("\n");
      let firstSection = true;
      for (const line of lines) {
        if (y > 260) {
          pdf.addPage(); y = drawPageHeader(pdf) + 5;
        }
        if (!line.trim()) { y += 4; continue; }
        // Detect section headers (ALL CAPS lines or lines ending with colon)
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

    // ── Fotos ─────────────────────────────────────────────────────────────────
    if (fotos.length > 0) {
      if (y > 180) { pdf.addPage(); y = drawPageHeader(pdf) + 5; }
      let col = 0;
      const imgW = (TW - 5) / 2;
      for (const url of fotos) {
        try {
          const img = await fetch(url).then(r => r.blob());
          const du = await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(img); });
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

    // ── Declaración Jurada + Firmas ───────────────────────────────────────────
    if (y > 210) { pdf.addPage(); y = drawPageHeader(pdf) + 5; }

    pdf.setFont(undefined as any, "bold"); pdf.setFontSize(9); pdf.setTextColor(0);
    pdf.text("DECLARACION JURADA:", ML, y); 
    pdf.setFont(undefined as any, "normal");
    const djLines = pdf.splitTextToSize(DECLARACION_JURADA.replace("DECLARACION JURADA: ", ""), TW - 38);
    pdf.text(djLines, ML + 38, y);
    y += djLines.length * 5 + 12;

    // Firma boxes
    const bw = (TW - 10) / 2;
    pdf.rect(ML, y, bw, 28); pdf.rect(ML + bw + 10, y, bw, 28);
    pdf.setFontSize(8); pdf.setTextColor(80);
    pdf.text("Firma Profesional Interviniente", ML + 2, y + 4);
    pdf.text("Firma Propietario/Responsable del Inmueble", ML + bw + 12, y + 4);
    if (firmaProfesional) try { pdf.addImage(firmaProfesional, "PNG", ML + 5, y + 6, bw - 10, 18); } catch { /* skip */ }
    if (firmaCliente) try { pdf.addImage(firmaCliente, "PNG", ML + bw + 15, y + 6, bw - 10, 18); } catch { /* skip */ }

    // Page numbers
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
    <div style={{ maxWidth: "860px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <button onClick={() => router.push("/admin/certificados")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "5px" }}>
            ← Volver al listado
          </button>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--primary-blue)" }}>
            {isNuevo ? "Nuevo Certificado" : `Certificado N°${String(numero).padStart(4, "0")}`}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={handlePDF} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid var(--primary-blue)", background: "transparent", color: "var(--primary-blue)", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" }}>
            📥 Descargar PDF
          </button>
          <button onClick={() => handleSave("emitido")} disabled={saving} className="btn-red" style={{ padding: "10px 20px" }}>
            {saving ? "Guardando..." : "💾 Guardar"}
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", marginBottom: "28px", display: "flex" }}>
        {PASOS.map((p, i) => (
          <button key={p} onClick={() => setPaso(i)}
            style={{ flex: 1, padding: "14px 8px", border: "none", cursor: "pointer", fontWeight: i === paso ? 800 : 500, fontSize: "0.82rem",
              background: i === paso ? "var(--primary-blue)" : i < paso ? "#e8f0ff" : "#fff",
              color: i === paso ? "#fff" : i < paso ? "var(--primary-blue)" : "#999",
              borderRight: i < PASOS.length - 1 ? "1px solid #eee" : "none", transition: "0.2s" }}>
            <div style={{ fontSize: "1.2rem", marginBottom: "3px" }}>{i < paso ? "✓" : PASOS_ICONS[i]}</div>
            {p}
          </button>
        ))}
      </div>

      {/* ══ PASO 0: DATOS ══ */}
      {paso === 0 && (
        <div>
          {/* Datos del certificado */}
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
                <input style={inputSt} value={responsableCertificado} onChange={e => setResponsableCertificado(e.target.value)} placeholder="Ej: Lic. Facundo Pedraza - MP: 35108395/7458" />
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div style={cardSt}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "1rem" }}>Datos del Cliente / Inmueble</h2>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                <input type="checkbox" checked={clienteManual} onChange={e => { setClienteManual(e.target.checked); setClienteSeleccionado(null); setClienteSearch(""); }} />
                Carga manual
              </label>
            </div>

            {!clienteManual ? (
              <div style={{ position: "relative" }}>
                <label style={labelSt}>Buscar cliente registrado</label>
                <input style={inputSt}
                  value={clienteSeleccionado ? (clienteSeleccionado.nombre || clienteSeleccionado.razonSocial || clienteSeleccionado.email) : clienteSearch}
                  onChange={e => { setClienteSearch(e.target.value); setClienteSeleccionado(null); }}
                  placeholder="Nombre, empresa o email..." />
                {clientesFiltrados.length > 0 && !clienteSeleccionado && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "8px", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "200px", overflowY: "auto" }}>
                    {clientesFiltrados.map(c => (
                      <div key={c.id} onClick={() => { setClienteSeleccionado(c); setClienteSearch(""); }}
                        style={{ padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8f9ff")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                        <div style={{ fontWeight: 700 }}>{c.nombre || c.razonSocial || c.email}</div>
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
                {[
                  ["Nombre / Consorcio", clienteNombre, setClienteNombre],
                  ["Empresa / Razón Social", clienteEmpresa, setClienteEmpresa],
                  ["CUIT", clienteCuit, setClienteCuit],
                  ["Domicilio", clienteDireccion, setClienteDireccion],
                ].map(([lbl, val, fn]: any) => (
                  <div key={lbl}>
                    <label style={labelSt}>{lbl}</label>
                    <input style={inputSt} value={val} onChange={e => fn(e.target.value)} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ textAlign: "right" }}>
            <button onClick={() => setPaso(1)} className="btn-blue" style={{ padding: "12px 28px" }}>Siguiente → Memoria</button>
          </div>
        </div>
      )}

      {/* ══ PASO 1: MEMORIA DESCRIPTIVA ══ */}
      {paso === 1 && (
        <div>
          <div style={cardSt}>
            <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "6px", fontSize: "1rem" }}>Memoria Descriptiva</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
              Describí los sistemas certificados. Las líneas en MAYÚSCULAS se interpretarán como títulos de sección en el PDF.
            </p>
            <textarea
              style={{ ...inputSt, height: "420px", resize: "vertical", fontFamily: "inherit", lineHeight: "1.6" }}
              value={memoriaDescriptiva}
              onChange={e => setMemoriaDescriptiva(e.target.value)}
              placeholder={`SISTEMA DE DETECCION Y ALARMA CONTRA INCENDIOS\nLa presente memoria descriptiva detalla el sistema...\n\nNORMATIVA APLICABLE\nEl sistema ha sido diseñado conforme a NFPA 72...`}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{memoriaDescriptiva.length} caracteres</span>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                💡 Tip: dejá una línea en blanco entre secciones
              </span>
            </div>
          </div>

          {/* Preview de la conclusión */}
          <div style={{ ...cardSt, background: "#f8f9fc", border: "1px solid #e0e7ff" }}>
            <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary-blue)", marginBottom: "10px" }}>DECLARACIÓN JURADA (texto fijo en el PDF)</p>
            <p style={{ fontSize: "0.8rem", color: "#555", lineHeight: "1.6" }}>{DECLARACION_JURADA}</p>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setPaso(0)} style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>← Anterior</button>
            <button onClick={() => setPaso(2)} className="btn-blue" style={{ padding: "12px 28px" }}>Siguiente → Fotos</button>
          </div>
        </div>
      )}

      {/* ══ PASO 2: FOTOS ══ */}
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
            {fotos.length === 0 && <p style={{ color: "var(--text-muted)", textAlign: "center", fontSize: "0.88rem" }}>No hay fotos adjuntas.</p>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setPaso(1)} style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>← Anterior</button>
            <button onClick={() => setPaso(3)} className="btn-blue" style={{ padding: "12px 28px" }}>Siguiente → Firmas</button>
          </div>
        </div>
      )}

      {/* ══ PASO 3: FIRMAS ══ */}
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
            <button onClick={() => setPaso(2)} style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>← Anterior</button>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => handleSave("borrador")} disabled={saving}
                style={{ padding: "12px 20px", borderRadius: "8px", border: "1px solid var(--primary-blue)", background: "transparent", color: "var(--primary-blue)", fontWeight: 700, cursor: "pointer" }}>
                💾 Guardar borrador
              </button>
              <button onClick={() => handleSave("emitido")} disabled={saving} className="btn-red" style={{ padding: "12px 24px" }}>
                {saving ? "Guardando..." : "✓ Emitir Certificado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
