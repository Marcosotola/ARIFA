export const generateMantenimientoPDF = async (ficha: any) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297; const ML = 14; const MR = 14; const TW = W - ML - MR;
    const ftNum = String(ficha.numeroFicha).padStart(5, "0");
    const fecStr = ficha.fechaServicio ? new Date(ficha.fechaServicio + "T12:00:00").toLocaleDateString("es-AR") : "-";

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

    // ── Encabezado ──
    const HEADER_H = 28;
    const top = 10;
    pdf.setDrawColor(0, 34, 68);
    pdf.setLineWidth(0.5);
    pdf.rect(ML, top, TW, HEADER_H);

    if (logoPng) pdf.addImage(logoPng, "PNG", ML + 1, top + 1, 28, 24);
    pdf.line(ML + 31, top, ML + 31, top + HEADER_H);

    const rx = W - MR - 60;
    const cx = ML + 31 + (rx - ML - 31) / 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(0, 34, 68);
    pdf.text("CERTIFICADO TÉCNICO", cx, top + 9, { align: "center" });
    pdf.text("Mantenimiento de Extintores", cx, top + 16, { align: "center" });
    pdf.setFontSize(15);
    pdf.setTextColor(163, 31, 29);
    pdf.text(`FT-${ftNum}`, cx, top + 24, { align: "center" });

    pdf.line(rx, top, rx, top + HEADER_H);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(0);
    pdf.text("Fecha Serv.:", rx + 2, top + 7);
    pdf.text("Taller:", rx + 2, top + 14);
    pdf.text("Técnico:", rx + 2, top + 21);
    pdf.setFont("helvetica", "normal");
    pdf.text(fecStr, rx + 22, top + 7);
    pdf.text(ficha.tallerNombre || "ARIFA - Taller Central", rx + 22, top + 14);
    pdf.text(ficha.tecnicoNombre || "-", rx + 22, top + 21);

    let y = top + HEADER_H + 6;

    // ── Datos cliente (2 columnas para aprovechar el ancho landscape) ──
    autoTable(pdf, {
      startY: y,
      margin: { left: ML, right: MR },
      body: [
        [
          { content: "CLIENTE:", styles: { fontStyle: "bold", cellWidth: 30 } },
          { content: ficha.clienteNombre || "-", styles: { cellWidth: 80 } },
          { content: "DNI/CUIT:", styles: { fontStyle: "bold", cellWidth: 25 } },
          ficha.dniCuit || "-",
        ],
        [
          { content: "EMPRESA:", styles: { fontStyle: "bold" } },
          ficha.clienteEmpresa || "-",
          { content: "TELÉFONO:", styles: { fontStyle: "bold" } },
          ficha.telefono || "-",
        ],
        [
          { content: "DOMICILIO:", styles: { fontStyle: "bold" } },
          { content: ficha.domicilio || "-", colSpan: 3 },
        ],
        [
          { content: "RECIBIDO POR:", styles: { fontStyle: "bold" } },
          { content: ficha.quienRecibe || "-", colSpan: 3 },
        ],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      tableLineColor: [0, 34, 68],
      tableLineWidth: 0.2,
    });
    y = (pdf as any).lastAutoTable.finalY + 6;

    // ── Título tabla ──
    pdf.setFillColor(0, 34, 68);
    pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8);
    pdf.setTextColor(255);
    pdf.text("REGISTRO DE EXTINTORES", ML + 3, y + 5);
    y += 7;

    // ── Tabla principal ──
    autoTable(pdf, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [[
        "Nº",
        "Sector",
        "Tipo",
        "Base",
        "Cap. (Kg/L)",
        "Marca / Nº Fab.",
        "Nº Tarjeta",
        "Fecha PH",
        "Fec. Mant.",
        "Vence Mant.",
      ]],
      body: ficha.items.map((item: any, idx: number) => {
        const marcaDisplay = item.marca === "Otro" ? (item.marcaOtro || "-") : (item.marca || "-");
        const nroFab = item.nroFabricacion || "-";
        const fechaPH = item.ultimaPH ? new Date(item.ultimaPH + "T12:00:00").toLocaleDateString("es-AR") : "-";
        const venceMant = item.vencimientoCarga
          ? item.vencimientoCarga.split("-").reverse().join("/")
          : "-";
        return [
          idx + 1,
          item.sector || "-",
          item.agente || "-",
          item.base || "-",
          item.capacidad || "-",
          `${marcaDisplay} / ${nroFab}`,
          item.nroTarjeta || "-",
          fechaPH,
          fecStr,
          venceMant,
        ];
      }),
      theme: "grid",
      headStyles: { fillColor: [0, 34, 68], fontSize: 8, halign: "center" },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        6: { halign: "center" },
        7: { halign: "center" },
        8: { halign: "center" },
        9: { halign: "center" },
      },
    });

    y = (pdf as any).lastAutoTable.finalY + 10;
    if (y > 165) { pdf.addPage(); y = 20; }

    pdf.setFontSize(7.5);
    pdf.setTextColor(100);
    pdf.setFont("helvetica", "normal");
    pdf.text("Se certifica que los extintores detallados han sido procesados bajo normativas de seguridad vigentes.", ML, y);
    pdf.text("La vigencia de las cargas es de 1 año a partir de la fecha de servicio. Se recomienda control mensual.", ML, y + 5);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 34, 68);
    pdf.text("EMPRESA QUE REALIZÓ EL MANTENIMIENTO ANUAL DE EXTINTORES SEGÚN NORMA IRAM 3517-2: ARIFA", ML, y + 12);

    y += 40;
    if (y > 185) { pdf.addPage(); y = 40; }

    pdf.setTextColor(0);
    pdf.line(W - MR - 65, y, W - MR - 5, y);
    if (ficha.firmaTecnico) {
      pdf.addImage(ficha.firmaTecnico, "PNG", W - MR - 60, y - 22, 50, 18);
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Firma Responsable Técnico", W - MR - 35, y + 5, { align: "center" });

    pdf.save(`Certificado_Tecnico_FT${ftNum}.pdf`);
};

export const generateRemitoPDF = async (remito: any) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
    const remNum = String(remito.numero).padStart(5, "0");
    const fecStr = remito.fecha ? new Date(remito.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";

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

    // ── Encabezado ──
    const HEADER_H = 30;
    const top = 10;
    pdf.setDrawColor(0, 34, 68); pdf.setLineWidth(0.5);
    pdf.rect(ML, top, TW, HEADER_H);

    if (logoPng) pdf.addImage(logoPng, "PNG", ML + 1, top + 2, 30, 26);
    pdf.line(ML + 33, top, ML + 33, top + HEADER_H);

    const rx = W - MR - 48;
    const cx = ML + 33 + (rx - ML - 33) / 2;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(0, 34, 68);
    pdf.text("REMITO DE MOVIMIENTO", cx, top + 9, { align: "center" });
    pdf.text("Mantenimiento de Extintores", cx, top + 15, { align: "center" });
    pdf.setFontSize(14); pdf.setTextColor(163, 31, 29);
    pdf.text(`R-${remNum}`, cx, top + 24, { align: "center" });

    pdf.line(rx, top, rx, top + HEADER_H);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0);
    pdf.text("Fecha:", rx + 2, top + 8);
    pdf.text("Tipo:", rx + 2, top + 15);
    pdf.text("Técnico:", rx + 2, top + 22);
    
    pdf.setFont("helvetica", "normal");
    pdf.text(fecStr, rx + 18, top + 8);
    pdf.text(remito.tipo.toUpperCase(), rx + 18, top + 15);
    pdf.text(remito.tecnicoNombre || "-", rx + 18, top + 22);

    let y = top + HEADER_H + 8;

    autoTable(pdf, {
      startY: y,
      margin: { left: ML, right: MR },
      body: [
        [{ content: "CLIENTE:", styles: { fontStyle: "bold", cellWidth: 40 } }, remito.clienteNombre],
        [{ content: "EMPRESA:", styles: { fontStyle: "bold" } }, (remito.sedeRazonSocial || remito.clienteEmpresa || "-") + (remito.sedeNombre ? ` - SEDE: ${remito.sedeNombre}` : "")],
        [{ content: "DIRECCIÓN:", styles: { fontStyle: "bold" } }, remito.clienteDireccion || "-"],
        [{ content: "TELÉFONO:", styles: { fontStyle: "bold" } }, remito.clienteTelefono || "-"],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      tableLineColor: [0, 34, 68], tableLineWidth: 0.2,
    });
    y = (pdf as any).lastAutoTable.finalY + 8;

    pdf.setFillColor(0, 34, 68);
    pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8); pdf.setTextColor(255);
    pdf.text("DETALLE DE EQUIPOS", ML + 3, y + 5);
    y += 7;

    autoTable(pdf, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [["Cant.", "ID / Código", "Agente", "Capac.", "Estado", "Tipo"]],
      body: remito.equipos.map((eq:any) => [
        eq.cantidad || "1",
        eq.id || "-",
        eq.tipo,
        eq.capacidad,
        eq.estado.toUpperCase(),
        eq.esPrestamo ? "EQUIPO DE PRÉSTAMO" : "PROPIO"
      ]),
      headStyles: { fillColor: [0, 34, 68], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5 && data.cell.raw === 'EQUIPO DE PRÉSTAMO') {
          data.cell.styles.textColor = [163, 31, 29];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
    y = (pdf as any).lastAutoTable.finalY + 15;

    if (y > 240) { pdf.addPage(); y = 50; }
    
    const bw = 100;
    const bx = (W - bw) / 2;
    pdf.setDrawColor(200); pdf.setLineWidth(0.2);
    pdf.rect(bx, y, bw, 40);
    pdf.setFontSize(8); pdf.setTextColor(100);
    pdf.text("CONFORMIDAD Y RECEPCIÓN DEL CLIENTE", bx + bw/2, y + 5, { align: "center" });

    if (remito.firma) {
      pdf.addImage(remito.firma, "PNG", bx + 5, y + 7, bw - 10, 25);
    }
    
    pdf.setFontSize(10); pdf.setTextColor(0); pdf.setFont("helvetica", "bold");
    pdf.text((remito.aclaracion || "").toUpperCase(), bx + bw/2, y + 36, { align: "center" });

    pdf.save(`Remito-${remito.tipo}-${remNum}.pdf`);
};
