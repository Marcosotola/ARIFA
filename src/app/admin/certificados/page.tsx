"use client";
import { useEffect, useState } from "react";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, where, doc, getDoc, deleteDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Eye, Edit, Download, Trash2, Scroll } from "lucide-react";

// PDF libs
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "usuarios", u.uid));
      const r = snap.exists() ? snap.data().rol : "cliente";
      setRole(r);
      setUid(u.uid);
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
          snap = await getDocs(collection(db, "certificados"));
          const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Certificado));
          setCerts((all as any[]).filter(c => c.clienteId === currentUid));
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
      
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
      const nCert = String(data.numero || "").padStart(4, "0");
      const fInsp = data.fechaInspeccion ? new Date(data.fechaInspeccion).toLocaleDateString("es-AR") : "-";
      const fVenc = data.fechaVencimiento ? new Date(data.fechaVencimiento).toLocaleDateString("es-AR") : "-";

      // Logo
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
        p.setTextColor(0); p.setFontSize(9); p.text(`CERTIFICADO N°${nCert}`, cx, T + 28, { align: "center" });
        p.line(rx, T, rx, T + H);
        const rows = [["Rubro:", data.rubro || "-"], ["Fecha:", fInsp], ["Rev. planos:", data.revPlanos || "-"], ["Pagina:", String(p.getCurrentPageInfo().pageNumber)]];
        rows.forEach(([k, v], i) => {
          const ry = T + (H / 4) * i + (H / 8) + 1.5;
          p.setFont(undefined, "bold"); p.text(k, rx + 2, ry);
          p.setFont(undefined, "normal"); p.text(v, rx + 24, ry);
          if (i < 3) p.line(rx, T + (H / 4) * (i + 1), W - MR, T + (H / 4) * (i + 1));
        });
        return T + H + 6;
      };

      let y = drawHeader(pdf);
      autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR },
        body: [
          [{ content: "Fecha de Inspección", styles: { fontStyle: "bold", cellWidth: 45 } }, fInsp, { content: "Fecha de Vencimiento", styles: { fontStyle: "bold", cellWidth: 45 } }, fVenc],
          [{ content: "Sistema certificado:", styles: { fontStyle: "bold" } }, { content: data.sistemaCertificado || "-", colSpan: 3, styles: { fontStyle: "bold", textColor: [163, 31, 29] } }],
          [{ content: "Cliente:", styles: { fontStyle: "bold" } }, { content: data.clienteNombre + (data.sedeNombre ? ` - SEDE: ${data.sedeNombre}` : ""), colSpan: 3, styles: { halign: "center", fontStyle: "bold" } }],
          [{ content: "Domicilio:", styles: { fontStyle: "bold" } }, { content: data.clienteDireccion || "-", colSpan: 3 }],
          [{ content: "Responsable certificado:", styles: { fontStyle: "bold" } }, { content: data.responsableCertificado || "-", colSpan: 3 }],
          [{ content: "Empresa Certificante:", styles: { fontStyle: "bold" } }, { content: "ARIFA — INGENIERIA EN SEGURIDAD CONTRA INCENDIOS | CUIT 20-35108395-7", colSpan: 3, styles: { fontStyle: "bold", textColor: [0, 34, 68] } }],
        ],
        styles: { fontSize: 9, cellPadding: 4 }, tableLineColor: [0, 34, 68], tableLineWidth: 0.3,
      });

      y = (pdf as any).lastAutoTable.finalY + 10;
      if (data.memoriaDescriptiva) {
        const wrapped = pdf.splitTextToSize(data.memoriaDescriptiva, TW);
        pdf.text(wrapped, ML, y);
        y += wrapped.length * 5 + 10;
      }

      // Firmas
      if (y > 220) { pdf.addPage(); y = drawHeader(pdf) + 5; }
      pdf.setFont(undefined, "bold"); pdf.text("DECLARACION JURADA:", ML, y);
      y += 6; pdf.setFont(undefined, "normal"); pdf.setFontSize(8);
      const dj = "La información consignada precedentemente reviste el carácter de Declaración Jurada; su omisión o falsedad precederá al decaimiento de su validez...";
      pdf.text(pdf.splitTextToSize(dj, TW), ML, y);
      y += 15;
      pdf.rect(ML, y, 85, 25); pdf.rect(ML + 95, y, 85, 25);
      if (data.firmaProfesional) pdf.addImage(data.firmaProfesional, "PNG", ML + 5, y + 5, 75, 15);
      if (data.firmaCliente) pdf.addImage(data.firmaCliente, "PNG", ML + 100, y + 5, 75, 15);

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

  const sedesDisponibles = Array.from(new Set(certs.map(c => (c as any).sedeNombre).filter(Boolean))) as string[];

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
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Generá y gestioná certificados con carácter de Declaración Jurada.</p>
        </div>
        {isStaff && !isReadOnly && (
          <Link href="/admin/certificados/nuevo" className="btn-red" style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <Plus size={18} /> Nuevo Certificado
          </Link>
        )}
      </header>

      {/* FILTERS */}
      <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
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

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden", marginBottom: "20px" }}>
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
                    const venc = c.fechaVencimiento ? new Date(c.fechaVencimiento) : null;
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
                          {c.fechaInspeccion ? new Date(c.fechaInspeccion).toLocaleDateString("es-AR") : "-"}
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
                const venc = c.fechaVencimiento ? new Date(c.fechaVencimiento) : null;
                const vencido = venc && venc < new Date();
                return (
                  <div key={c.id} style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1.5px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div>
                        <div style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "1.1rem" }}>N°{String(c.numero || "?").padStart(4, "0")}</div>
                        <div style={{ fontSize: "0.75rem", color: "#999", fontWeight: 600 }}>Inspección: {c.fechaInspeccion ? new Date(c.fechaInspeccion).toLocaleDateString("es-AR") : "-"}</div>
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
