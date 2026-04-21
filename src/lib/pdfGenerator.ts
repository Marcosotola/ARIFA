export const generateMantenimientoPDF = async (ficha: any) => {
    // Importamos dinámicamente aquí dentro para que no afecte al bundle inicial
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
    const ftNum = String(ficha.numeroFicha).padStart(5, "0");
    const fecStr = ficha.fechaServicio ? new Date(ficha.fechaServicio).toLocaleDateString("es-AR") : "-";

    // ── Logo SVG → PNG ──
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

    // ── Encabezado Estilo Oficial ──
    const HEADER_H = 30;
    const top = 10;
    pdf.setDrawColor(0, 34, 68);
    pdf.setLineWidth(0.5);
    pdf.rect(ML, top, TW, HEADER_H);

    if (logoPng) pdf.addImage(logoPng, "PNG", ML + 1, top + 2, 30, 26);
    pdf.line(ML + 33, top, ML + 33, top + HEADER_H);

    const rx = W - MR - 48;
    const cx = ML + 33 + (rx - ML - 33) / 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(0, 34, 68);
    pdf.text("CERTIFICADO TÉCNICO", cx, top + 9, { align: "center" });
    pdf.text("Mantenimiento de Extintores", cx, top + 15, { align: "center" });
    pdf.setFontSize(14);
    pdf.setTextColor(163, 31, 29);
    pdf.text(`FT-${ftNum}`, cx, top + 24, { align: "center" });

    pdf.line(rx, top, rx, top + HEADER_H);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(0);
    pdf.text("Fecha Serv:", rx + 2, top + 8);
    pdf.text("Taller:", rx + 2, top + 15);
    pdf.text("Técnico:", rx + 2, top + 22);
    
    pdf.setFont("helvetica", "normal");
    pdf.text(fecStr, rx + 18, top + 8);
    pdf.text("CABA / Taller Central", rx + 18, top + 15);
    pdf.text(ficha.tecnicoNombre.split(" ")[0], rx + 18, top + 22);

    let y = top + HEADER_H + 8;

    autoTable(pdf, {
      startY: y,
      margin: { left: ML, right: MR },
      body: [
        [{ content: "CLIENTE:", styles: { fontStyle: "bold", cellWidth: 40 } }, ficha.clienteNombre],
        [{ content: "EMPRESA:", styles: { fontStyle: "bold" } }, ficha.clienteEmpresa || "-"],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      tableLineColor: [0, 34, 68],
      tableLineWidth: 0.2,
    });
    y = (pdf as any).lastAutoTable.finalY + 8;

    pdf.setFillColor(0, 34, 68);
    pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8);
    pdf.setTextColor(255);
    pdf.text("REGISTRO DETALLADO DE MANTENIMIENTO", ML + 3, y + 5);
    y += 7;

    const tableData = ficha.items.map((item: any) => [
      item.nroTarjeta,
      `${item.agente} ${item.capacidad}`,
      item.claseFuego.join("-"),
      item.marca,
      item.anioFab,
      item.componentesReemplazados.length > 0 ? "SI" : "NO",
      item.marbeteColor,
      item.vencimientoCarga
    ]);

    autoTable(pdf, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [["Tarj. N°", "Agente/Cap.", "Clase", "Marca", "Año", "Rep.", "Marbete", "Venc. Carga"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 34, 68], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
    });

    y = (pdf as any).lastAutoTable.finalY + 15;
    if (y > 250) { pdf.addPage(); y = 20; }
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text("Se certifica que los extintores detallados han sido procesados bajo normativas de seguridad vigentes.", ML, y);
    pdf.text("La vigencia de las cargas es de 1 año a partir de la fecha de servicio. Se recomienda control mensual.", ML, y + 5);

    pdf.line(W - MR - 60, y + 25, W - MR, y + 25);
    pdf.setFont("helvetica", "bold");
    pdf.text("Firma Responsable Técnico", W - MR - 30, y + 29, { align: "center" });

    pdf.save(`Certificado_Tecnico_FT${ftNum}.pdf`);
};
