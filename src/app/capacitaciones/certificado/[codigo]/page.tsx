"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Award, XCircle } from "lucide-react";
import type { CertificadoCapacitacion } from "@/lib/capacitaciones";

// Página del link que llega por mail: muestra el certificado aprobado y lo descarga en PDF.
export default function CertificadoCapacitacionPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [cert, setCert] = useState<CertificadoCapacitacion | null>(null);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    fetch(`/api/capacitaciones/certificado?codigo=${encodeURIComponent(codigo)}`)
      .then(r => r.json())
      .then(d => (d.certificado ? setCert(d.certificado) : setError(d.error || "Certificado no encontrado")))
      .catch(() => setError("Error de conexión. Intentá de nuevo."));
  }, [codigo]);

  const descargar = async () => {
    if (!cert) return;
    setDescargando(true);
    try {
      const { generateCertificadoCapacitacionPDF } = await import("@/lib/pdfGenerator");
      await generateCertificadoCapacitacionPDF(cert);
    } finally { setDescargando(false); }
  };

  return (
    <section className="section-padding">
      <div className="container" style={{ maxWidth: "560px" }}>
        <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", padding: "32px", textAlign: "center" }}>
          {!cert && !error && <p style={{ color: "var(--text-muted)" }}>Cargando certificado...</p>}
          {error && (
            <>
              <XCircle size={44} color="#dc2626" style={{ marginBottom: "10px" }} />
              <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1e293b", marginBottom: "8px" }}>Certificado no disponible</h1>
              <p style={{ color: "#64748b", marginBottom: "20px" }}>{error}</p>
              <Link href="/capacitaciones" className="btn-blue" style={{ padding: "10px 20px" }}>Ir a capacitaciones</Link>
            </>
          )}
          {cert && (
            <>
              <Award size={48} color="#16a34a" style={{ marginBottom: "10px" }} />
              <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "6px" }}>Certificado de aprobación</h1>
              <p style={{ color: "#555", lineHeight: 1.6, marginBottom: "22px" }}>
                <b>{cert.nombre} {cert.apellido}</b> (DNI {cert.dni}) aprobó la capacitación <b>{cert.tema}</b> el{" "}
                {new Date(cert.fecha).toLocaleDateString("es-AR")} con {cert.porcentaje}%.
              </p>
              <button onClick={descargar} disabled={descargando} className="btn-red" style={{ padding: "12px 24px", width: "100%" }}>
                {descargando ? "Generando..." : "Descargar certificado (PDF)"}
              </button>
              <p style={{ marginTop: "16px", fontSize: "0.72rem", color: "#999" }}>Código de verificación: {cert.codigo}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
