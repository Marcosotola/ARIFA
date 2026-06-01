import { adminDb } from "@/lib/firebase-admin";
import { CheckCircle, AlertTriangle, XCircle, Clock, MapPin, Building2, Calendar, Award, User, Shield, FileCheck } from "lucide-react";
import DownloadCertButton from "./DownloadCertButton";

type Estado = "vigente" | "con_observaciones" | "fuera_servicio" | "vencido" | "sin_certificacion";

const ESTADO_CONFIG: Record<Estado, { label: string; desc: string; bg: string; border: string; color: string; icon: typeof CheckCircle }> = {
  vigente: {
    label: "CERTIFICACIÓN OPERATIVA VIGENTE",
    desc: "Conforme a la última inspección realizada, los sistemas relevados se encontraban operativos al momento de la verificación.",
    bg: "#16a34a",
    border: "#15803d",
    color: "#fff",
    icon: CheckCircle,
  },
  con_observaciones: {
    label: "OPERATIVO CON OBSERVACIONES",
    desc: "La instalación está operativa, pero se registraron observaciones que deben ser atendidas en el próximo mantenimiento.",
    bg: "#d97706",
    border: "#b45309",
    color: "#fff",
    icon: AlertTriangle,
  },
  fuera_servicio: {
    label: "FUERA DE SERVICIO",
    desc: "Se detectaron observaciones críticas que requieren atención inmediata. El sistema no puede ser certificado como operativo.",
    bg: "#dc2626",
    border: "#b91c1c",
    color: "#fff",
    icon: XCircle,
  },
  vencido: {
    label: "CERTIFICACIÓN VENCIDA",
    desc: "El período de mantenimiento preventivo ha expirado. Se requiere una nueva inspección técnica.",
    bg: "#dc2626",
    border: "#b91c1c",
    color: "#fff",
    icon: XCircle,
  },
  sin_certificacion: {
    label: "SIN CERTIFICACIÓN EMITIDA",
    desc: "Esta instalación aún no posee una certificación emitida. Contacte a ARIFA para coordinar la primera inspección.",
    bg: "#6b7280",
    border: "#4b5563",
    color: "#fff",
    icon: Clock,
  },
};

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

async function getVerificationData(qrId: string) {
  // Query without orderBy to avoid requiring a composite Firestore index; sort in memory
  let certSnap;
  try {
    certSnap = await adminDb
      .collection("certificados")
      .where("sedeId", "==", qrId)
      .where("estado", "==", "emitido")
      .get();
  } catch {
    certSnap = null;
  }

  const hasCerts = certSnap && !certSnap.empty;

  if (!hasCerts) {
    // Fallback: find sede info in usuarios collection
    const usersSnap = await adminDb.collection("usuarios").get();
    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      const sede = (data.sedes || []).find((s: any) => s.id === qrId);
      if (sede) {
        return {
          estado: "sin_certificacion" as Estado,
          clienteNombre: data.empresa || [data.nombre, data.apellido].filter(Boolean).join(" "),
          sedeNombre: sede.nombre,
          sedeDireccion: sede.direccion || "",
          cert: null,
          updatedAt: new Date().toISOString(),
        };
      }
    }
    return null;
  }

  // Sort by fechaInspeccion desc in memory, take latest
  const sorted = certSnap!.docs.sort((a, b) => {
    const fa = a.data().fechaInspeccion || "";
    const fb = b.data().fechaInspeccion || "";
    return fb.localeCompare(fa);
  });

  const cert = sorted[0].data();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const vencimientoDate = cert.fechaVencimiento ? new Date(cert.fechaVencimiento + "T12:00:00") : null;
  const isExpired = vencimientoDate ? vencimientoDate < today : false;

  let hasModerate = false;
  let hasCritical = false;

  if (!isExpired && cert.inspeccionesVinculadas?.length > 0) {
    const ids = (cert.inspeccionesVinculadas as string[]).slice(0, 5);
    for (const itId of ids) {
      try {
        const itDoc = await adminDb.collection("ordenes_trabajo").doc(itId).get();
        if (itDoc.exists) {
          const it = itDoc.data()!;
          for (const planilla of it.planillasSeleccionadas || []) {
            for (const fila of planilla.filasChecklist || []) {
              if (fila.severidad === "critico") hasCritical = true;
              if (fila.severidad === "moderado") hasModerate = true;
            }
          }
        }
      } catch {}
    }
  }

  let estado: Estado;
  if (isExpired) estado = "vencido";
  else if (hasCritical) estado = "fuera_servicio";
  else if (hasModerate) estado = "con_observaciones";
  else estado = "vigente";

  return {
    estado,
    clienteNombre: cert.clienteNombre || cert.clienteEmpresa || "",
    sedeNombre: cert.sedeNombre || "",
    sedeDireccion: cert.clienteDireccion || "",
    cert,
    certId: sorted[0].id,
    updatedAt: new Date().toISOString(),
  };
}

export default async function VerificarPage({ params }: { params: Promise<{ qrId: string }> }) {
  const { qrId } = await params;
  const data = await getVerificationData(qrId);

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "20px", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <XCircle size={40} />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1e293b", marginBottom: "10px" }}>Instalación no encontrada</h1>
          <p style={{ color: "#64748b", lineHeight: 1.6 }}>El código QR escaneado no corresponde a ninguna instalación registrada en el sistema ARIFA.</p>
          <div style={{ marginTop: "30px", padding: "16px", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>www.arifa.com.ar</p>
          </div>
        </div>
      </div>
    );
  }

  const cfg = ESTADO_CONFIG[data.estado];
  const Icon = cfg.icon;
  const cert = data.cert;

  const now = new Date();
  const updatedStr = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} - ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} HS.`;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ background: "#002244", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src="/logos/logoFondoTransparente.svg" alt="ARIFA" style={{ height: "48px" }} />
          <div style={{ color: "#fff" }}>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "1px" }}>ARIFA</div>
            <div style={{ fontSize: "0.65rem", opacity: 0.7, letterSpacing: "0.5px", textTransform: "uppercase" }}>Ingeniería en Seguridad Contra Incendios</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", padding: "6px 12px" }}>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Verificación online</div>
        </div>
      </div>

      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "20px 16px 0" }}>
        {/* Tipo de registro */}
        <div style={{ background: "#002244", borderRadius: "10px", padding: "12px 18px", marginBottom: "16px", textAlign: "center" }}>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: "0.85rem", letterSpacing: "1px", textTransform: "uppercase" }}>
            Instalación bajo mantenimiento preventivo
          </span>
        </div>

        {/* Estado badge */}
        <div style={{ background: cfg.bg, borderRadius: "14px", padding: "20px 24px", marginBottom: "16px", border: `2px solid ${cfg.border}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: "50%", width: "52px", height: "52px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={28} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: "1.1rem", color: cfg.color, lineHeight: 1.2, marginBottom: "8px" }}>
                {cfg.label}
              </div>
              <div style={{ fontSize: "0.82rem", color: cfg.color, opacity: 0.9, lineHeight: 1.5 }}>
                {cfg.desc}
              </div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.4)", borderRadius: "50%", width: "52px", height: "52px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={26} color="#fff" />
              </div>
              <div style={{ fontSize: "0.6rem", color: cfg.color, fontWeight: 800, marginTop: "5px", opacity: 0.9, textTransform: "uppercase" }}>
                {data.estado === "vigente" ? "Operativo" : data.estado === "con_observaciones" ? "Con obs." : data.estado === "sin_certificacion" ? "Pendiente" : "Inactivo"}
              </div>
            </div>
          </div>
        </div>

        {/* Datos de la instalación */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "20px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
          {([
            { icon: <Building2 size={16} color="#64748b" />, label: "CLIENTE", value: data.clienteNombre },
            { icon: <MapPin size={16} color="#64748b" />, label: "DIRECCIÓN", value: data.sedeDireccion || "—" },
            { icon: <FileCheck size={16} color="#64748b" />, label: "INSTALACIÓN", value: data.sedeNombre },
            { icon: <Calendar size={16} color="#64748b" />, label: "ÚLTIMA INSPECCIÓN", value: cert ? formatDate(cert.fechaInspeccion) : "—" },
            { icon: <Calendar size={16} color="#64748b" />, label: "PRÓXIMA INSPECCIÓN", value: cert ? formatDate(cert.fechaVencimiento) : "—" },
            { icon: <Award size={16} color="#64748b" />, label: "N° DE CERTIFICADO", value: cert ? formatCertNumber(cert.numero, cert.fechaInspeccion) : "—" },
            { icon: <User size={16} color="#64748b" />, label: "TÉCNICO RESPONSABLE", value: cert?.responsableCertificado || "—" },
            { icon: <Shield size={16} color="#64748b" />, label: "ALCANCE DEL SERVICIO", value: cert?.sistemaCertificado || "—" },
          ] as { icon: React.ReactNode; label: string; value: string }[]).map((row, i, arr) => (
            <div key={row.label} style={{ display: "flex", gap: "12px", paddingBottom: i < arr.length - 1 ? "14px" : 0, marginBottom: i < arr.length - 1 ? "14px" : 0, borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <div style={{ marginTop: "2px", flexShrink: 0 }}>{row.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: "2px" }}>{row.label}</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#1e293b", wordBreak: "break-word" as const }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer estado */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "16px 20px", marginBottom: "16px", border: "1px solid #e2e8f0", display: "flex", gap: "16px", alignItems: "center" }}>
          <Shield size={32} color="#002244" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.6, margin: 0 }}>
              ARIFA Ingeniería en Seguridad Contra Incendios certifica que la presente instalación recibe mantenimiento preventivo periódico conforme a controles técnicos efectuados según normativa IRAM 3546 y disposiciones vigentes.
            </p>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0, minWidth: "110px" }}>
            <div style={{ fontSize: "0.6rem", fontWeight: 800, color: "#002244", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Estado actualizado automáticamente</div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#475569" }}>{updatedStr}</div>
          </div>
        </div>

        {/* Descargar PDF */}
        {cert && data.certId && (
          <DownloadCertButton certId={data.certId} />
        )}

        {/* Footer sitio */}
        <div style={{ background: "#002244", borderRadius: "12px", padding: "16px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>www.arifa.com.ar</span>
          <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>Este certificado es válido únicamente con verificación online mediante código QR.</span>
        </div>
      </div>
    </div>
  );
}
