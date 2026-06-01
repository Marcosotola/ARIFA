"use client";
import { useState } from "react";
import { Download } from "lucide-react";

export default function DownloadCertButton({ certId }: { certId: string }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { generateCertificadoPDF } = await import("@/lib/pdfGenerator");
      await generateCertificadoPDF(certId);
    } catch (err) {
      alert("Error al generar PDF: " + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      style={{
        width: "100%",
        padding: "14px",
        background: "#002244",
        color: "#fff",
        border: "none",
        borderRadius: "10px",
        fontWeight: 700,
        fontSize: "0.9rem",
        cursor: loading ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        opacity: loading ? 0.7 : 1,
        marginBottom: "16px",
      }}
    >
      <Download size={18} /> {loading ? "Generando PDF..." : "Descargar certificado en PDF"}
    </button>
  );
}
