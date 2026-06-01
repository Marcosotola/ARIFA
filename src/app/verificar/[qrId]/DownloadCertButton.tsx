"use client";
import { useState } from "react";
import { Download } from "lucide-react";

interface CertProps {
  estado: string;
  estadoLabel: string;
  estadoDesc: string;
  clienteNombre: string;
  sedeNombre: string;
  sedeDireccion: string;
  certNumero: string;
  fechaInspeccion: string;
  fechaVencimiento: string;
  tecnico: string;
  alcance: string;
  qrId: string;
}

const ESTADO_COLORS: Record<string, [number, number, number]> = {
  vigente: [22, 163, 74],
  con_observaciones: [217, 119, 6],
  fuera_servicio: [220, 38, 38],
  vencido: [220, 38, 38],
  sin_certificacion: [107, 114, 128],
};

export default function DownloadCertButton(props: CertProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const W = 210;
      const margin = 16;

      // ─── Header ───────────────────────────────────────────────────────
      doc.setFillColor(0, 34, 68);
      doc.rect(0, 0, W, 38, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("ARIFA", margin, 16);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160, 190, 220);
      doc.text("Ingeniería en Seguridad Contra Incendios", margin, 23);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 220, 240);
      doc.text("VERIFICACIÓN DE CERTIFICACIÓN", W - margin, 14, { align: "right" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160, 190, 220);
      doc.text("www.arifa.com.ar", W - margin, 22, { align: "right" });

      let y = 48;

      // ─── Estado band ──────────────────────────────────────────────────
      const rgb = ESTADO_COLORS[props.estado] ?? [107, 114, 128];
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.roundedRect(margin, y, W - margin * 2, 20, 2, 2, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(props.estadoLabel, W / 2, y + 7, { align: "center" });

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      const descLines = doc.splitTextToSize(props.estadoDesc, W - margin * 2 - 8);
      doc.text(descLines as string[], W / 2, y + 13, { align: "center" });

      y += descLines.length > 1 ? 28 : 26;

      // ─── Data card ────────────────────────────────────────────────────
      const rows: [string, string][] = [
        ["CLIENTE", props.clienteNombre],
        ["INSTALACIÓN / SEDE", props.sedeNombre],
        ["DIRECCIÓN", props.sedeDireccion || "—"],
        ["N° DE CERTIFICADO", props.certNumero || "—"],
        ["ÚLTIMA INSPECCIÓN", props.fechaInspeccion || "—"],
        ["PRÓXIMA INSPECCIÓN (VENCIMIENTO)", props.fechaVencimiento || "—"],
        ["TÉCNICO RESPONSABLE", props.tecnico || "—"],
        ["ALCANCE DEL SERVICIO", props.alcance || "—"],
      ];

      const rowH = 13;
      const cardH = rows.length * rowH + 8;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, W - margin * 2, cardH, 2, 2, "FD");

      let rowY = y + 9;
      for (let i = 0; i < rows.length; i++) {
        const [label, value] = rows[i];
        if (i > 0) {
          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.2);
          doc.line(margin + 4, rowY - 4, W - margin - 4, rowY - 4);
        }
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(148, 163, 184);
        doc.text(label, margin + 6, rowY);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 41, 59);
        doc.text(value || "—", margin + 6, rowY + 5);
        rowY += rowH;
      }

      y += cardH + 10;

      // ─── Legal text ───────────────────────────────────────────────────
      const legalText =
        "ARIFA Ingeniería en Seguridad Contra Incendios certifica que la presente instalación recibe mantenimiento preventivo periódico conforme a controles técnicos efectuados según normativa IRAM 3546 y disposiciones vigentes.";
      const legalLines = doc.splitTextToSize(legalText, W - margin * 2 - 12);
      const legalH = (legalLines as string[]).length * 4.5 + 10;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, W - margin * 2, legalH, 2, 2, "FD");
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(legalLines as string[], margin + 6, y + 7);

      y += legalH + 8;

      // ─── Timestamp ────────────────────────────────────────────────────
      const now = new Date();
      const ts = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} hs.`;
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Documento generado: ${ts}`, margin, y);

      // ─── Footer ───────────────────────────────────────────────────────
      doc.setFillColor(0, 34, 68);
      doc.rect(0, 275, W, 22, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("www.arifa.com.ar", W / 2, 283, { align: "center" });

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160, 190, 220);
      doc.text(`Verificación online: arifa.com.ar/verificar/${props.qrId}`, W / 2, 289, { align: "center" });
      doc.text("Este documento es válido con verificación online mediante código QR.", W / 2, 294, { align: "center" });

      doc.save(`Certificacion-${props.sedeNombre.replace(/\s+/g, "-")}.pdf`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
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
