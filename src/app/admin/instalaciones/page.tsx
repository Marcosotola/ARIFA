"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { Building2, MapPin, QrCode, Download, ExternalLink, Search, CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw } from "lucide-react";

interface Sede {
  id: string;
  nombre: string;
  direccion?: string;
  razonSocial?: string;
}

interface Instalacion {
  sedeId: string;
  sedeNombre: string;
  sedeDireccion: string;
  clienteId: string;
  clienteNombre: string;
  estado: "vigente" | "por_vencer" | "vencido" | "sin_cert";
  certNumero?: string;
  certFechaVencimiento?: string;
  certFechaInspeccion?: string;
  certTecnico?: string;
}

function estadoBadge(estado: Instalacion["estado"]) {
  const cfg = {
    vigente: { label: "Vigente", bg: "#dcfce7", color: "#16a34a", icon: <CheckCircle2 size={13} /> },
    por_vencer: { label: "Por vencer", bg: "#fef3c7", color: "#d97706", icon: <AlertTriangle size={13} /> },
    vencido: { label: "Vencido", bg: "#fee2e2", color: "#dc2626", icon: <XCircle size={13} /> },
    sin_cert: { label: "Sin cert.", bg: "#f3f4f6", color: "#6b7280", icon: <Clock size={13} /> },
  };
  const c = cfg[estado];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: c.bg, color: c.color, borderRadius: "20px", padding: "4px 10px", fontSize: "0.72rem", fontWeight: 800, border: `1px solid ${c.color}33` }}>
      {c.icon} {c.label}
    </span>
  );
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatCertNumber(numero: number | string | undefined, fechaInspeccion: string | undefined) {
  if (!numero) return "—";
  const year = fechaInspeccion ? fechaInspeccion.split("-")[0] : new Date().getFullYear();
  return `AR-${year}-${String(numero).padStart(5, "0")}`;
}

function calcEstado(fechaVencimiento: string | undefined): Instalacion["estado"] {
  if (!fechaVencimiento) return "sin_cert";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento + "T12:00:00");
  const diff = Math.ceil((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "vencido";
  if (diff <= 30) return "por_vencer";
  return "vigente";
}

export default function InstalacionesPage() {
  const [instalaciones, setInstalaciones] = useState<Instalacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [qrModal, setQrModal] = useState<{ sedeId: string; sedeNombre: string; clienteNombre: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(20);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersSnap, certsSnap] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(query(collection(db, "certificados"), where("estado", "==", "emitido"), orderBy("fechaInspeccion", "desc"))),
      ]);

      // Build cert map: sedeId -> latest cert
      const certMap = new Map<string, any>();
      for (const d of certsSnap.docs) {
        const c = d.data();
        if (c.sedeId && !certMap.has(c.sedeId)) {
          certMap.set(c.sedeId, c);
        }
      }

      const result: Instalacion[] = [];
      for (const userDoc of usersSnap.docs) {
        const u = userDoc.data();
        if (!u.sedes?.length) continue;
        if (!["cliente", "admin", "superadmin"].includes(u.rol)) continue;
        const clienteNombre = u.empresa || [u.nombre, u.apellido].filter(Boolean).join(" ") || u.email;

        for (const sede of (u.sedes as Sede[])) {
          const cert = certMap.get(sede.id);
          const estado = cert ? calcEstado(cert.fechaVencimiento) : "sin_cert";
          result.push({
            sedeId: sede.id,
            sedeNombre: sede.nombre,
            sedeDireccion: sede.direccion || "",
            clienteId: userDoc.id,
            clienteNombre,
            estado,
            certNumero: cert ? formatCertNumber(cert.numero, cert.fechaInspeccion) : undefined,
            certFechaVencimiento: cert?.fechaVencimiento,
            certFechaInspeccion: cert?.fechaInspeccion,
            certTecnico: cert?.responsableCertificado,
          });
        }
      }

      // Sort: vencido primero, luego por_vencer, vigente, sin_cert
      const order = { vencido: 0, por_vencer: 1, vigente: 2, sin_cert: 3 };
      result.sort((a, b) => order[a.estado] - order[b.estado]);
      setInstalaciones(result);
    } finally {
      setLoading(false);
    }
  };

  const openQrModal = async (inst: Instalacion) => {
    setQrDataUrl(null);
    setQrModal({ sedeId: inst.sedeId, sedeNombre: inst.sedeNombre, clienteNombre: inst.clienteNombre });
    const url = `https://arifa.com.ar/verificar/${inst.sedeId}`;
    const QRCode = (await import("qrcode")).default;
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, errorCorrectionLevel: "H", color: { dark: "#002244", light: "#ffffff" } });
    setQrDataUrl(dataUrl);
  };

  const downloadQr = async () => {
    if (!qrDataUrl || !qrModal) return;

    const W = 400;
    const H_HEADER = 70;
    const H_INFO = 84;
    const QR_SIZE = 258;
    const H_QR_AREA = QR_SIZE + 28;
    const H_URL = 30;
    const H_FOOTER = 46;
    const H = H_HEADER + H_INFO + H_QR_AREA + H_URL + H_FOOTER;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
        img.src = src;
      });

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Header
    ctx.fillStyle = "#002244";
    ctx.fillRect(0, 0, W, H_HEADER);

    const logo = await loadImg("/logos/logoFondoTransparente.svg");
    ctx.drawImage(logo, 18, 11, 48, 48);

    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "alphabetic";
    ctx.font = "bold 18px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("ARIFA", 76, 34);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "9.5px Arial, sans-serif";
    ctx.fillText("Ingeniería en Seguridad Contra Incendios", 76, 52);

    // Info area
    let y = H_HEADER;
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, y, W, H_INFO);
    ctx.fillStyle = "#002244";
    ctx.fillRect(0, y, 4, H_INFO);

    ctx.fillStyle = "#002244";
    ctx.font = "bold 11.5px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VERIFICACIÓN DE CERTIFICACIÓN", W / 2, y + 24);

    const truncate = (text: string, maxW: number) => {
      if (ctx.measureText(text).width <= maxW) return text;
      let t = text;
      while (t.length > 0 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
      return t + "…";
    };

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 15px Arial, sans-serif";
    ctx.fillText(truncate(qrModal.sedeNombre, W - 48), W / 2, y + 48);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px Arial, sans-serif";
    ctx.fillText(truncate(qrModal.clienteNombre, W - 48), W / 2, y + 68);

    // QR area
    y += H_INFO;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, y, W, H_QR_AREA);

    const qrImg = await loadImg(qrDataUrl);
    const qrX = (W - QR_SIZE) / 2;
    const qrY = y + 14;
    ctx.drawImage(qrImg, qrX, qrY, QR_SIZE, QR_SIZE);

    // Logo centered on QR
    const cx = W / 2;
    const cy = qrY + QR_SIZE / 2;
    const logoR = 28;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, logoR + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(logo, cx - logoR, cy - logoR, logoR * 2, logoR * 2);

    // URL bar
    y += H_QR_AREA;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, y, W, H_URL);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace, Arial";
    ctx.textAlign = "center";
    ctx.fillText(`arifa.com.ar/verificar/${qrModal.sedeId}`, W / 2, y + 18);

    // Footer
    y += H_URL;
    ctx.fillStyle = "#002244";
    ctx.fillRect(0, y, W, H_FOOTER);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("www.arifa.com.ar", W / 2, y + 17);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "9px Arial, sans-serif";
    ctx.fillText("Escanee el código para verificar la certificación online", W / 2, y + 33);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `QR-${qrModal.sedeNombre.replace(/\s+/g, "-")}.png`;
    a.click();
  };

  const filtered = instalaciones.filter(inst => {
    const q = search.toLowerCase();
    const matchSearch = !q || [inst.clienteNombre, inst.sedeNombre, inst.sedeDireccion, inst.certNumero].some(v => v?.toLowerCase().includes(q));
    const matchEstado = filtroEstado === "todos" || inst.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const visibles = filtered.slice(0, displayCount);
  const hayMas = filtered.length > displayCount;

  const counts = {
    todos: instalaciones.length,
    vigente: instalaciones.filter(i => i.estado === "vigente").length,
    por_vencer: instalaciones.filter(i => i.estado === "por_vencer").length,
    vencido: instalaciones.filter(i => i.estado === "vencido").length,
    sin_cert: instalaciones.filter(i => i.estado === "sin_cert").length,
  };

  return (
    <div style={{ maxWidth: "1350px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Instalaciones</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
            {filtered.length} instalación{filtered.length !== 1 ? "es" : ""} — QR permanente por sede
          </p>
        </div>
        <button onClick={fetchData} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" }}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </header>

      {/* Resumen semáforo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {([
          { key: "todos", label: "Total", bg: "#f8fafc", color: "#475569", border: "#e2e8f0" },
          { key: "vigente", label: "Vigentes", bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
          { key: "por_vencer", label: "Por vencer", bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
          { key: "vencido", label: "Vencidos", bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
          { key: "sin_cert", label: "Sin cert.", bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
        ] as const).map(card => (
          <button key={card.key}
            onClick={() => { setFiltroEstado(card.key); setDisplayCount(20); }}
            style={{ background: filtroEstado === card.key ? card.bg : "#fff", border: `2px solid ${filtroEstado === card.key ? card.color : "#eee"}`, borderRadius: "12px", padding: "16px", cursor: "pointer", textAlign: "left", transition: "0.15s" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: card.color }}>{counts[card.key]}</div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: card.color, textTransform: "uppercase", letterSpacing: "0.3px" }}>{card.label}</div>
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div style={{ position: "relative", marginBottom: "20px" }}>
        <Search size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
        <input
          style={{ width: "100%", padding: "12px 12px 12px 44px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.92rem", background: "#fff", boxSizing: "border-box" }}
          placeholder="Buscar por cliente, sede, dirección o N° de certificado..."
          value={search}
          onChange={e => { setSearch(e.target.value); setDisplayCount(20); }}
        />
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando instalaciones...</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", overflow: "hidden", border: "1px solid #eee" }}>
          <div className="admin-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
              <thead style={{ background: "#fafafa", borderBottom: "1.5px solid #eee" }}>
                <tr>
                  {["Estado", "Cliente", "Sede / Instalación", "Último cert.", "Vencimiento", "Técnico", "QR"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: "0.72rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map(inst => (
                  <tr key={inst.sedeId} style={{ borderBottom: "1px solid #f5f5f5" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafcff")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "14px 18px" }}>{estadoBadge(inst.estado)}</td>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--primary-blue)" }}>{inst.clienteNombre}</div>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#1e293b" }}>{inst.sedeNombre}</div>
                      {inst.sedeDireccion && (
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                          <MapPin size={11} /> {inst.sedeDireccion}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 18px", fontSize: "0.85rem", color: "#475569", fontWeight: 600 }}>
                      {inst.certNumero || <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      {inst.certFechaVencimiento ? (
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: inst.estado === "vencido" ? "#dc2626" : inst.estado === "por_vencer" ? "#d97706" : "#16a34a" }}>
                          {formatDate(inst.certFechaVencimiento)}
                        </span>
                      ) : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 18px", fontSize: "0.82rem", color: "#64748b" }}>
                      {inst.certTecnico || <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => openQrModal(inst)}
                          style={{ width: "34px", height: "34px", borderRadius: "8px", background: "#eff6ff", color: "var(--primary-blue)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
                          title="Ver QR"
                        >
                          <QrCode size={17} />
                        </button>
                        <a
                          href={`https://arifa.com.ar/verificar/${inst.sedeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ width: "34px", height: "34px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                          title="Abrir verificación"
                        >
                          <ExternalLink size={17} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "50px", color: "#bbb" }}>No hay instalaciones que coincidan con los filtros.</td></tr>
                )}
                {hayMas && (
                  <tr>
                    <td colSpan={7} style={{ padding: "0" }}>
                      <button
                        onClick={() => setDisplayCount(c => c + 20)}
                        style={{ width: "100%", padding: "16px", background: "#f8fafc", border: "none", borderTop: "1px solid #f0f0f0", cursor: "pointer", fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.88rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                      >
                        Cargar más — mostrando {visibles.length} de {filtered.length}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal QR */}
      {qrModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "380px", overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ background: "var(--primary-blue)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <QrCode size={22} color="#fff" />
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: "1rem" }}>Código QR</div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>Verificación pública</div>
                </div>
              </div>
              <button onClick={() => setQrModal(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "1.3rem" }}>✕</button>
            </div>

            <div style={{ padding: "24px", textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-blue)", marginBottom: "4px" }}>{qrModal.sedeNombre}</div>
              <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: "20px" }}>{qrModal.clienteNombre}</div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "290px", background: "#f8fafc", borderRadius: "12px", border: "2px dashed #e2e8f0", marginBottom: "16px" }}>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" style={{ width: "260px", height: "260px" }} />
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Generando QR...</div>
                )}
              </div>

              <div style={{ background: "#f1f5f9", borderRadius: "8px", padding: "10px 14px", marginBottom: "20px", fontSize: "0.72rem", color: "#64748b", wordBreak: "break-all", fontFamily: "monospace" }}>
                arifa.com.ar/verificar/{qrModal.sedeId}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={downloadQr} disabled={!qrDataUrl} className="btn-blue"
                  style={{ flex: 1, padding: "12px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontWeight: 700, opacity: qrDataUrl ? 1 : 0.5 }}>
                  <Download size={18} /> Descargar PNG
                </button>
                <a href={`https://arifa.com.ar/verificar/${qrModal.sedeId}`} target="_blank" rel="noopener noreferrer"
                  style={{ padding: "12px 16px", borderRadius: "8px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                  title="Abrir verificación">
                  <ExternalLink size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
