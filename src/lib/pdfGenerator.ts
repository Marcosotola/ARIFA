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
    // ── Remito de Entrega de Materiales (módulo Documentos) ──
    if (remito.items && Array.isArray(remito.items) && !remito.equipos) {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
        const rmNum = String(remito.numero).padStart(5, "0");
        const fecStr = remito.fecha ? new Date(remito.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";

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

        const HEADER_H = 38; const top = 10;
        pdf.setDrawColor(0, 34, 68); pdf.setLineWidth(0.5);
        pdf.rect(ML, top, TW, HEADER_H);
        if (logoPng) pdf.addImage(logoPng, "PNG", ML + 2, top + 3, 32, 32);
        pdf.line(ML + 37, top, ML + 37, top + HEADER_H);

        const rx = W - MR - 52;
        const cx = ML + 37 + (rx - ML - 37) / 2;
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(0, 34, 68);
        pdf.text("REMITO DE ENTREGA", cx, top + 11, { align: "center" });
        pdf.setFontSize(9); pdf.setFont("helvetica", "normal"); pdf.setTextColor(80, 80, 80);
        pdf.text("ARIFA - Servicios de Protección contra Incendios", cx, top + 19, { align: "center" });
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(163, 31, 29);
        pdf.text(`RM-${rmNum}`, cx, top + 31, { align: "center" });

        pdf.line(rx, top, rx, top + HEADER_H);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(0);
        pdf.text("Fecha:", rx + 2, top + 10);
        pdf.text("Emitido por:", rx + 2, top + 22);
        pdf.text("Receptor:", rx + 2, top + 34);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
        pdf.text(fecStr, rx + 28, top + 10);
        pdf.text(remito.creadoPorNombre || "ARIFA", rx + 28, top + 22);
        pdf.text(remito.nombreReceptor || "-", rx + 28, top + 34);

        let y = top + HEADER_H + 8;

        pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
        pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255);
        pdf.text("DATOS DEL CLIENTE", ML + 3, y + 5);
        y += 7;

        const empresa = remito.sedeNombre
            ? `${remito.clienteEmpresa || "-"} — Sede: ${remito.sedeNombre}`
            : (remito.clienteEmpresa || "-");

        autoTable(pdf, {
            startY: y, margin: { left: ML, right: MR, bottom: 18 },
            body: [
                [{ content: "RAZÓN SOCIAL / CONTACTO:", styles: { fontStyle: "bold", cellWidth: 55 } }, `${remito.clienteNombre || "-"}${remito.clienteApellido ? " " + remito.clienteApellido : ""}`],
                [{ content: "EMPRESA / SEDE:", styles: { fontStyle: "bold" } }, empresa],
                [{ content: "DNI / CUIT:", styles: { fontStyle: "bold" } }, remito.clienteDniCuit || "-"],
                [{ content: "DIRECCIÓN:", styles: { fontStyle: "bold" } }, remito.clienteDireccion || "-"],
                [{ content: "TELÉFONO:", styles: { fontStyle: "bold" } }, remito.clienteTelefono || "-"],
            ],
            styles: { fontSize: 8.5, cellPadding: 2.5 },
            tableLineColor: [0, 34, 68], tableLineWidth: 0.2,
        });
        y = (pdf as any).lastAutoTable.finalY + 8;

        pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
        pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255);
        pdf.text("MATERIALES / EQUIPOS ENTREGADOS", ML + 3, y + 5);
        y += 7;

        autoTable(pdf, {
            startY: y, margin: { left: ML, right: MR, bottom: 18 },
            head: [["Cant.", "Descripción"]],
            body: (remito.items || []).map((item: any) => [item.cantidad, item.descripcion || "-"]),
            theme: "grid",
            headStyles: { fillColor: [0, 34, 68], fontSize: 8.5, halign: "center" },
            bodyStyles: { fontSize: 9 },
            columnStyles: { 0: { cellWidth: 20, halign: "center" } },
        });
        y = (pdf as any).lastAutoTable.finalY + 8;

        if (remito.descripcionGeneral?.trim()) {
            const noteLines = pdf.splitTextToSize(remito.descripcionGeneral, TW) as string[];
            const lineH = 4.5;
            const pageBottom = 278;

            if (y + 6 + lineH > pageBottom || y > 240) { pdf.addPage(); y = 20; }

            pdf.setFillColor(248, 249, 252); pdf.rect(ML, y, TW, 6, "F");
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(0, 34, 68);
            pdf.text("MOTIVO DE ENTREGA", ML + 3, y + 4);
            y += 8;
            pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(60, 60, 60);
            for (const line of noteLines) {
                if (y + lineH > pageBottom) { pdf.addPage(); y = 20; }
                pdf.text(line, ML, y);
                y += lineH;
            }
            y += 6;
        }

        if (y > 220) { pdf.addPage(); y = 20; }
        const bw = 100; const bx = (W - bw) / 2;
        pdf.setDrawColor(200); pdf.setLineWidth(0.2);
        pdf.rect(bx, y, bw, 45);
        pdf.setFontSize(8); pdf.setTextColor(100);
        pdf.text("FIRMA DEL RECEPTOR", bx + bw / 2, y + 5, { align: "center" });
        if (remito.firmaReceptor) {
            try { pdf.addImage(remito.firmaReceptor, "PNG", bx + 5, y + 8, bw - 10, 26); } catch { /* skip */ }
        }
        pdf.setDrawColor(80); pdf.setLineWidth(0.2);
        pdf.line(bx + 5, y + 37, bx + bw - 5, y + 37);
        pdf.setFontSize(9); pdf.setTextColor(0); pdf.setFont("helvetica", "bold");
        pdf.text((remito.nombreReceptor || "").toUpperCase(), bx + bw / 2, y + 43, { align: "center" });

        const pageCount = pdf.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            const fy = 287;
            pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(ML, fy - 5, W - MR, fy - 5);
            pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5); pdf.setTextColor(120);
            pdf.text(`Remito emitido el ${fecStr}.`, ML, fy);
            pdf.text(`Página ${i} de ${pageCount}`, W / 2, fy, { align: "center" });
            pdf.text("ARIFA - Protección contra Incendios", W - MR, fy, { align: "right" });
        }

        pdf.save(`Remito-RM${rmNum}.pdf`);
        return;
    }

    // ── Remito de Movimiento de Inventario (legacy) ──
    const _generateRemitoPDF = async (remito: any) => {
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
    await _generateRemitoPDF(remito);
};

export const generatePresupuestoPDF = async (pres: any) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
    const presNum = String(pres.numero).padStart(5, "0");
    const fecStr = pres.fecha ? new Date(pres.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";

    const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    const HEADER_H = 32; const top = 10;
    pdf.setDrawColor(0, 34, 68); pdf.setLineWidth(0.5);
    pdf.rect(ML, top, TW, HEADER_H);

    if (logoPng) pdf.addImage(logoPng, "PNG", ML + 2, top + 2, 30, 28);
    pdf.line(ML + 35, top, ML + 35, top + HEADER_H);

    const rx = W - MR - 52;
    const cx = ML + 35 + (rx - ML - 35) / 2;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(0, 34, 68);
    pdf.text("PRESUPUESTO", cx, top + 10, { align: "center" });
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal"); pdf.setTextColor(80, 80, 80);
    pdf.text("ARIFA - Servicios de Protección contra Incendios", cx, top + 17, { align: "center" });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(163, 31, 29);
    pdf.text(`P-${presNum}`, cx, top + 27, { align: "center" });

    pdf.line(rx, top, rx, top + HEADER_H);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(0);
    pdf.text("Fecha:", rx + 2, top + 8);
    pdf.text("Validez:", rx + 2, top + 15);
    pdf.text("Estado:", rx + 2, top + 22);
    pdf.text("Emitido por:", rx + 2, top + 29);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
    pdf.text(fecStr, rx + 22, top + 8);
    pdf.text(`${pres.validezDias || 15} días`, rx + 22, top + 15);
    const estadoLabel = pres.estado === "aceptado" ? "ACEPTADO" : pres.estado === "cancelado" ? "CANCELADO" : "PENDIENTE";
    pdf.text(estadoLabel, rx + 22, top + 22);
    pdf.text(pres.creadoPorNombre || "ARIFA", rx + 22, top + 29);

    let y = top + HEADER_H + 8;

    // ── Datos del cliente ──
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255);
    pdf.text("DATOS DEL CLIENTE", ML + 3, y + 5);
    y += 7;

    const empresa = pres.sedeNombre
        ? `${pres.clienteEmpresa || "-"} — Sede: ${pres.sedeNombre}`
        : (pres.clienteEmpresa || "-");

    autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR, bottom: 18 },
        body: [
            [{ content: "RAZÓN SOCIAL / CONTACTO:", styles: { fontStyle: "bold", cellWidth: 55 } }, `${pres.clienteNombre || "-"}${pres.clienteApellido ? " " + pres.clienteApellido : ""}`],
            [{ content: "EMPRESA / SEDE:", styles: { fontStyle: "bold" } }, empresa],
            [{ content: "DNI / CUIT:", styles: { fontStyle: "bold" } }, pres.clienteDniCuit || "-"],
            [{ content: "DIRECCIÓN:", styles: { fontStyle: "bold" } }, pres.clienteDireccion || "-"],
            [{ content: "TELÉFONO:", styles: { fontStyle: "bold" } }, pres.clienteTelefono || "-"],
            [{ content: "EMAIL:", styles: { fontStyle: "bold" } }, pres.clienteEmail || "-"],
        ],
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        tableLineColor: [0, 34, 68], tableLineWidth: 0.2,
    });
    y = (pdf as any).lastAutoTable.finalY + 8;

    // ── Detalle de ítems ──
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255);
    pdf.text("DETALLE DE SERVICIOS / PRODUCTOS", ML + 3, y + 5);
    y += 7;

    autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR, bottom: 18 },
        head: [["Cant.", "Descripción", "P. Unitario", "Subtotal"]],
        body: (pres.items || []).map((item: any) => [
            item.cantidad,
            item.descripcion || "-",
            `$ ${fmt(item.precioUnitario || 0)}`,
            `$ ${fmt(item.subtotal || 0)}`,
        ]),
        theme: "grid",
        headStyles: { fillColor: [0, 34, 68], fontSize: 8.5, halign: "center" },
        bodyStyles: { fontSize: 9 },
        showHead: "everyPage",
        columnStyles: {
            0: { cellWidth: 18, halign: "center" },
            2: { cellWidth: 35, halign: "right" },
            3: { cellWidth: 35, halign: "right" },
        },
    });
    y = (pdf as any).lastAutoTable.finalY + 10;

    // ── Totales ── (si no hay espacio suficiente, nueva página)
    if (y > 225) { pdf.addPage(); y = 20; }

    const totW = 110; const totX = W - MR - totW;

    const addTotalRow = (label: string, value: string, bold = false, colorRed = false) => {
        y += 4;
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(bold ? 10 : 9);
        if (colorRed) pdf.setTextColor(163, 31, 29); else pdf.setTextColor(0);
        pdf.text(label, totX + 2, y);
        pdf.text(value, W - MR - 2, y, { align: "right" });
        y += bold ? 4 : 3;
    };

    // Línea superior antes del subtotal
    pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(totX, y, W - MR, y);
    addTotalRow("Subtotal:", `$ ${fmt(pres.subtotal || 0)}`);

    if ((pres.descuentoMonto || 0) > 0) {
        const descLabel = pres.descuentoTipo === "porcentaje"
            ? `Descuento (${pres.descuentoValor}%):`
            : "Descuento:";
        addTotalRow(descLabel, `- $ ${fmt(pres.descuentoMonto || 0)}`);
    }
    if ((pres.impuestoMonto || 0) > 0) {
        const impLabel = pres.impuestoTipo === "porcentaje"
            ? `Impuesto (${pres.impuestoValor}%):`
            : "Impuesto:";
        addTotalRow(impLabel, `+ $ ${fmt(pres.impuestoMonto || 0)}`);
    }

    // Línea gruesa antes del TOTAL
    y += 3;
    pdf.setDrawColor(0, 34, 68); pdf.setLineWidth(0.5); pdf.line(totX, y, W - MR, y);
    addTotalRow("TOTAL:", `$ ${fmt(pres.total || 0)}`, true, true);
    y += 8;

    // ── Notas ──
    if (pres.notas?.trim()) {
        const noteLines = pdf.splitTextToSize(pres.notas, TW) as string[];
        const lineH = 4.5;
        const pageBottom = 278; // safe margin before footer at y=287

        if (y + 6 + lineH > pageBottom || y > 240) { pdf.addPage(); y = 20; }

        pdf.setFillColor(248, 249, 252); pdf.rect(ML, y, TW, 6, "F");
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(0, 34, 68);
        pdf.text("NOTAS / CONDICIONES", ML + 3, y + 4);
        y += 8;

        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(60, 60, 60);
        for (const line of noteLines) {
            if (y + lineH > pageBottom) { pdf.addPage(); y = 20; }
            pdf.text(line, ML, y);
            y += lineH;
        }
    }

    // ── Pie de página en todas las páginas con paginación ──
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        const fy = 287;
        pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(ML, fy - 5, W - MR, fy - 5);
        pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5); pdf.setTextColor(120);
        pdf.text(`Este presupuesto tiene validez de ${pres.validezDias || 15} días desde su fecha de emisión.`, ML, fy);
        pdf.text(`Página ${i} de ${pageCount}`, W / 2, fy, { align: "center" });
        pdf.text("ARIFA - Protección contra Incendios", W - MR, fy, { align: "right" });
    }

    pdf.save(`Presupuesto-P${presNum}.pdf`);
};

export const generateReciboPDF = async (recibo: any) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
    const rcNum = String(recibo.numero).padStart(5, "0");
    const fecStr = recibo.fecha ? new Date(recibo.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";
    const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const FORMA_PAGO_LABELS: Record<string, string> = {
        efectivo: "Efectivo",
        transferencia: "Transferencia bancaria",
        cheque: "Cheque",
        tarjeta_credito: "Tarjeta de crédito",
        tarjeta_debito: "Tarjeta de débito",
        otro: "Otro",
    };

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
    const HEADER_H = 32; const top = 10;
    pdf.setDrawColor(0, 34, 68); pdf.setLineWidth(0.5);
    pdf.rect(ML, top, TW, HEADER_H);

    if (logoPng) pdf.addImage(logoPng, "PNG", ML + 2, top + 2, 30, 28);
    pdf.line(ML + 35, top, ML + 35, top + HEADER_H);

    const rx = W - MR - 52;
    const cx = ML + 35 + (rx - ML - 35) / 2;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(0, 34, 68);
    pdf.text("RECIBO DE COBRO", cx, top + 10, { align: "center" });
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal"); pdf.setTextColor(80, 80, 80);
    pdf.text("ARIFA - Servicios de Protección contra Incendios", cx, top + 17, { align: "center" });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(163, 31, 29);
    pdf.text(`RC-${rcNum}`, cx, top + 27, { align: "center" });

    pdf.line(rx, top, rx, top + HEADER_H);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(0);
    pdf.text("Fecha:", rx + 2, top + 9);
    pdf.text("Forma pago:", rx + 2, top + 19);
    pdf.text("Emitido por:", rx + 2, top + 29);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
    pdf.text(fecStr, rx + 26, top + 9);
    pdf.text(FORMA_PAGO_LABELS[recibo.formaPago] || recibo.formaPago || "-", rx + 26, top + 19);
    pdf.text(recibo.creadoPorNombre || "ARIFA", rx + 26, top + 29);

    let y = top + HEADER_H + 8;

    // ── Datos del cliente ──
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255);
    pdf.text("DATOS DEL CLIENTE", ML + 3, y + 5);
    y += 7;

    const empresa = recibo.sedeNombre
        ? `${recibo.clienteEmpresa || "-"} — Sede: ${recibo.sedeNombre}`
        : (recibo.clienteEmpresa || "-");

    autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR, bottom: 18 },
        body: [
            [{ content: "RAZÓN SOCIAL / CONTACTO:", styles: { fontStyle: "bold", cellWidth: 55 } }, `${recibo.clienteNombre || "-"}${recibo.clienteApellido ? " " + recibo.clienteApellido : ""}`],
            [{ content: "EMPRESA / SEDE:", styles: { fontStyle: "bold" } }, empresa],
            [{ content: "DNI / CUIT:", styles: { fontStyle: "bold" } }, recibo.clienteDniCuit || "-"],
            [{ content: "DIRECCIÓN:", styles: { fontStyle: "bold" } }, recibo.clienteDireccion || "-"],
            [{ content: "TELÉFONO:", styles: { fontStyle: "bold" } }, recibo.clienteTelefono || "-"],
            [{ content: "EMAIL:", styles: { fontStyle: "bold" } }, recibo.clienteEmail || "-"],
        ],
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        tableLineColor: [0, 34, 68], tableLineWidth: 0.2,
    });
    y = (pdf as any).lastAutoTable.finalY + 8;

    // ── Detalle del cobro ──
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255);
    pdf.text("DETALLE DEL COBRO", ML + 3, y + 5);
    y += 7;

    autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR, bottom: 18 },
        body: [
            [{ content: "FORMA DE PAGO:", styles: { fontStyle: "bold", cellWidth: 55 } }, FORMA_PAGO_LABELS[recibo.formaPago] || recibo.formaPago || "-"],
            [{ content: "CONCEPTO:", styles: { fontStyle: "bold" } }, recibo.concepto || "-"],
            ...(recibo.observaciones?.trim() ? [[{ content: "OBSERVACIONES:", styles: { fontStyle: "bold" } }, recibo.observaciones]] : []),
        ],
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        tableLineColor: [0, 34, 68], tableLineWidth: 0.2,
    });
    y = (pdf as any).lastAutoTable.finalY + 8;

    // ── Monto recibido ──
    if (y > 220) { pdf.addPage(); y = 20; }
    const totW = 110; const totX = W - MR - totW;
    pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(totX, y, W - MR, y);
    y += 6;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(0, 34, 68);
    pdf.text("MONTO RECIBIDO:", totX + 2, y);
    pdf.setFontSize(14); pdf.setTextColor(163, 31, 29);
    pdf.text(`$ ${fmt(recibo.monto || 0)}`, W - MR - 2, y, { align: "right" });
    y += 8;
    pdf.setDrawColor(0, 34, 68); pdf.setLineWidth(0.5); pdf.line(totX, y, W - MR, y);
    y += 16;

    // ── Firma del receptor ──
    if (y > 220) { pdf.addPage(); y = 20; }
    const bw = 100; const bx = (W - bw) / 2;
    pdf.setDrawColor(200); pdf.setLineWidth(0.2);
    pdf.rect(bx, y, bw, 45);
    pdf.setFontSize(8); pdf.setTextColor(100);
    pdf.text("FIRMA DEL RECEPTOR", bx + bw / 2, y + 5, { align: "center" });

    if (recibo.firmaReceptor) {
        try {
            pdf.addImage(recibo.firmaReceptor, "PNG", bx + 5, y + 8, bw - 10, 26);
        } catch { /* skip */ }
    }

    pdf.setDrawColor(80); pdf.setLineWidth(0.2);
    pdf.line(bx + 5, y + 37, bx + bw - 5, y + 37);
    pdf.setFontSize(9); pdf.setTextColor(0); pdf.setFont("helvetica", "bold");
    pdf.text((recibo.nombreReceptor || "").toUpperCase(), bx + bw / 2, y + 43, { align: "center" });
    y += 55;

    // ── Pie de página ──
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        const fy = 287;
        pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(ML, fy - 5, W - MR, fy - 5);
        pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5); pdf.setTextColor(120);
        pdf.text(`Recibo emitido el ${fecStr}.`, ML, fy);
        pdf.text(`Página ${i} de ${pageCount}`, W / 2, fy, { align: "center" });
        pdf.text("ARIFA - Protección contra Incendios", W - MR, fy, { align: "right" });
    }

    pdf.save(`Recibo-RC${rcNum}.pdf`);
};

export const generateEstadoCuentaPDF = async (estado: any) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
    const ecNum = String(estado.numero).padStart(5, "0");
    const fecStr = estado.fecha ? new Date(estado.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";
    const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    const HEADER_H = 32; const top = 10;
    pdf.setDrawColor(0, 34, 68); pdf.setLineWidth(0.5);
    pdf.rect(ML, top, TW, HEADER_H);

    if (logoPng) pdf.addImage(logoPng, "PNG", ML + 2, top + 2, 30, 28);
    pdf.line(ML + 35, top, ML + 35, top + HEADER_H);

    const rx = W - MR - 52;
    const cx = ML + 35 + (rx - ML - 35) / 2;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(0, 34, 68);
    pdf.text("ESTADO DE CUENTA", cx, top + 10, { align: "center" });
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal"); pdf.setTextColor(80, 80, 80);
    pdf.text("Seguimiento de Costos de Obra", cx, top + 17, { align: "center" });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(163, 31, 29);
    pdf.text(`EC-${ecNum}`, cx, top + 27, { align: "center" });

    pdf.line(rx, top, rx, top + HEADER_H);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(0);
    pdf.text("Fecha:", rx + 2, top + 11);
    pdf.text("Referencia:", rx + 2, top + 21);
    pdf.text("Emitido por:", rx + 2, top + 31);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
    pdf.text(fecStr, rx + 22, top + 11);
    pdf.text(estado.obraNombre || "-", rx + 22, top + 21);
    pdf.text(estado.creadoPorNombre || "ARIFA", rx + 22, top + 31);

    let y = top + HEADER_H + 8;

    // ── Datos del cliente ──
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255);
    pdf.text("DATOS DEL CLIENTE", ML + 3, y + 5);
    y += 7;

    const empresa = estado.sedeNombre
        ? `${estado.clienteEmpresa || "-"} — Sede: ${estado.sedeNombre}`
        : (estado.clienteEmpresa || "-");

    autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR, bottom: 18 },
        body: [
            [{ content: "RAZÓN SOCIAL / CONTACTO:", styles: { fontStyle: "bold", cellWidth: 55 } }, `${estado.clienteNombre || "-"}${estado.clienteApellido ? " " + estado.clienteApellido : ""}`],
            [{ content: "EMPRESA / SEDE:", styles: { fontStyle: "bold" } }, empresa],
            [{ content: "DNI / CUIT:", styles: { fontStyle: "bold" } }, estado.clienteDniCuit || "-"],
            [{ content: "DIRECCIÓN:", styles: { fontStyle: "bold" } }, estado.clienteDireccion || "-"],
            [{ content: "TELÉFONO:", styles: { fontStyle: "bold" } }, estado.clienteTelefono || "-"],
        ],
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        tableLineColor: [0, 34, 68], tableLineWidth: 0.2,
    });
    y = (pdf as any).lastAutoTable.finalY + 8;

    // ── Detalle de movimientos ──
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255);
    pdf.text("MOVIMIENTOS Y SEGUIMIENTO", ML + 3, y + 5);
    y += 7;

    autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR, bottom: 18 },
        head: [["Descripción", "Tipo", "Monto"]],
        body: (estado.items || []).map((item: any) => [
            item.descripcion || "-",
            item.tipo === "egreso" ? "DEUDA" : "PAGO",
            `$ ${fmt(item.monto || 0)}`,
        ]),
        theme: "grid",
        headStyles: { fillColor: [0, 34, 68], fontSize: 8.5, halign: "center" },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
            1: { cellWidth: 30, halign: "center" },
            2: { cellWidth: 40, halign: "right" },
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
                if (data.cell.raw === 'DEUDA') {
                    data.cell.styles.textColor = [163, 31, 29];
                    data.cell.styles.fontStyle = 'bold';
                } else if (data.cell.raw === 'PAGO') {
                    data.cell.styles.textColor = [22, 163, 74];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });
    y = (pdf as any).lastAutoTable.finalY + 10;

    // ── Totales y Saldo ──
    if (y > 230) { pdf.addPage(); y = 20; }
    const totW = 100; const totX = W - MR - totW;
    
    const addRow = (label: string, value: string, bold = false, color: [number, number, number] = [0, 0, 0]) => {
        y += 5;
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(bold ? 11 : 9);
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(label, totX + 2, y);
        pdf.text(value, W - MR - 2, y, { align: "right" });
        y += 2;
    };

    pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(totX, y, W - MR, y);
    addRow("Total Deudas:", `$ ${fmt(estado.totalEgresos || 0)}`, false, [163, 31, 29]);
    addRow("Total Pagos:", `$ ${fmt(estado.totalIngresos || 0)}`, false, [22, 163, 74]);
    
    y += 4;
    pdf.setDrawColor(0, 34, 68); pdf.setLineWidth(0.5); pdf.line(totX, y, W - MR, y);
    const colorSaldo: [number, number, number] = estado.saldoActual > 0 ? [163, 31, 29] : [22, 163, 74];
    addRow("SALDO ACTUAL:", `$ ${fmt(Math.abs(estado.saldoActual || 0))}`, true, colorSaldo);
    
    y += 10;

    // ── Notas ──
    if (estado.notas?.trim()) {
        const noteLines = pdf.splitTextToSize(estado.notas, TW) as string[];
        const lineH = 4.5;
        const pageBottom = 278;

        if (y + 6 + lineH > pageBottom || y > 245) { pdf.addPage(); y = 20; }

        pdf.setFillColor(248, 249, 252); pdf.rect(ML, y, TW, 6, "F");
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(0, 34, 68);
        pdf.text("OBSERVACIONES ADICIONALES", ML + 3, y + 4);
        y += 11;
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(60, 60, 60);
        for (const line of noteLines) {
            if (y + lineH > pageBottom) { pdf.addPage(); y = 20; }
            pdf.text(line, ML, y);
            y += lineH;
        }
    }

    // ── Pie ──
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        const fy = 287;
        pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(ML, fy - 5, W - MR, fy - 5);
        pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5); pdf.setTextColor(120);
        pdf.text(`Documento generado el ${fecStr}.`, ML, fy);
        pdf.text(`Página ${i} de ${pageCount}`, W / 2, fy, { align: "center" });
        pdf.text("ARIFA - Protección contra Incendios", W - MR, fy, { align: "right" });
    }

    pdf.save(`EstadoCuenta-EC${ecNum}.pdf`);
};

export const generateCertificadoPDF = async (certId: string): Promise<void> => {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const resp = await fetch(`/api/certificado/${certId}`);
  if (!resp.ok) { alert("Certificado no encontrado"); return; }
  const { cert: data, ots } = await resp.json() as { cert: any; ots: any[] };

  const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
  const PAGE_BOTTOM = 268;
  const nCert = String(data.numero || "").padStart(4, "0");
  const fInsp = data.fechaInspeccion ? new Date(data.fechaInspeccion + "T12:00:00").toLocaleDateString("es-AR") : "-";
  const fVenc = data.fechaVencimiento ? new Date(data.fechaVencimiento + "T12:00:00").toLocaleDateString("es-AR") : "-";
  const DECLARACION_JURADA = `La información consignada precedentemente reviste el carácter de Declaración Jurada; su omisión o falsedad precederá al decaimiento de su validez, sin perjuicio de las sanciones que pudiera corresponder. El profesional interviniente declara que cumple con las competencias exigidas, por ley, para completar el presente trabajo.`;

  const fetchImgBase64 = async (url: string): Promise<string | null> => {
    try {
      const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
      if (!img.naturalWidth || !img.naturalHeight) return null;
      const cnv = document.createElement("canvas");
      const maxPx = 1400;
      const ratio = Math.min(maxPx / img.naturalWidth, maxPx / img.naturalHeight, 1);
      cnv.width = Math.round(img.naturalWidth * ratio);
      cnv.height = Math.round(img.naturalHeight * ratio);
      cnv.getContext("2d")!.drawImage(img, 0, 0, cnv.width, cnv.height);
      return cnv.toDataURL("image/jpeg", 0.82);
    } catch { return null; }
  };

  const appendOTPagesToDoc = async (pdf: any, otData: any, logoPng: string | null) => {
    const otNum = String(otData.numero || "").padStart(4, "0");
    const fecStr = otData.fecha ? new Date(otData.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-";
    const planillasEnOT: any[] = otData.planillasSeleccionadas || [];
    const fotosOT: string[] = otData.fotos || [];
    const tecnicosOT: any[] = otData.tecnicosOT || (otData.tecnicos || []).map((t: string) => ({ nombre: t }));
    const nuevaObs: string = otData.diagnostico || "";
    const firmaTecnico: string | null = otData.firmaTecnico || null;
    const firmaCliente: string | null = otData.firmaCliente || null;
    const nombreFirmaTecnico: string = otData.nombreFirmaTecnico || "";
    const nombreFirmaCliente: string = otData.nombreFirmaCliente || "";
    const HEADER_H = 30; const top = 10;

    const drawOTHeader = (pg: any) => {
      pg.setDrawColor(0, 34, 68); pg.setLineWidth(0.5); pg.rect(ML, top, TW, HEADER_H);
      if (logoPng) pg.addImage(logoPng, "PNG", ML + 2, top + 2, 28, 26);
      pg.line(ML + 33, top, ML + 33, top + HEADER_H);
      const rx = W - MR - 48; const cx = ML + 33 + (rx - ML - 33) / 2;
      pg.setFont(undefined as any, "bold"); pg.setFontSize(11); pg.setTextColor(0, 34, 68);
      pg.text("INSPECCIÓN TÉCNICA VINCULADA", cx, top + 9, { align: "center" });
      pg.setFontSize(14); pg.setTextColor(163, 31, 29); pg.text(`IT-${otNum}`, cx, top + 23, { align: "center" });
      pg.line(rx, top, rx, top + HEADER_H);
      pg.setFontSize(7); pg.setTextColor(0); pg.setFont(undefined as any, "normal");
      pg.text("Fecha:", rx + 2, top + 11); pg.text("Estado:", rx + 2, top + 18); pg.text("Planilla:", rx + 2, top + 25);
      pg.text(fecStr, rx + 18, top + 11);
      pg.text((otData.estado || "").toUpperCase(), rx + 18, top + 18);
      pg.text(planillasEnOT[0]?.codigo || "-", rx + 18, top + 25);
    };

    pdf.addPage();
    drawOTHeader(pdf);
    let y = top + HEADER_H + 8;

    autoTable(pdf, {
      startY: y, margin: { left: ML, right: MR },
      body: [
        [{ content: "CLIENTE / RAZÓN SOCIAL:", styles: { fontStyle: "bold", cellWidth: 45 } }, otData.clienteNombre || "-"],
        [{ content: "EMPRESA / SEDE:", styles: { fontStyle: "bold" } }, (otData.sedeRazonSocial || otData.clienteEmpresa || "-") + (otData.sedeNombre ? ` - SEDE: ${otData.sedeNombre}` : "")],
        [{ content: "DIRECCIÓN:", styles: { fontStyle: "bold" } }, otData.clienteDireccion || otData.direccion || "-"],
        [{ content: "TELÉFONO / CEL:", styles: { fontStyle: "bold" } }, otData.clienteTelefono || "-"],
      ],
      styles: { fontSize: 9, cellPadding: 3 }, tableLineColor: [0, 34, 68], tableLineWidth: 0.1
    });
    y = (pdf as any).lastAutoTable.finalY + 8;

    if (tecnicosOT.length > 0) {
      pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
      pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.setFont(undefined as any, "bold");
      pdf.text("EQUIPO TÉCNICO ASIGNADO", ML + 3, y + 5);
      y += 7.5;
      autoTable(pdf, { startY: y, margin: { left: ML, right: MR }, body: tecnicosOT.map((t: any) => [t.nombre]), styles: { fontSize: 8.5, cellPadding: 3 } });
      y = (pdf as any).lastAutoTable.finalY + 8;
    }

    const sevColors: Record<string, number[]> = { leve: [16, 185, 129], moderado: [245, 158, 11], critico: [239, 68, 68] };
    const todasObs = [
      nuevaObs.trim() ? { texto: `[GENERAL] ${nuevaObs}`, sev: "" } : null,
      ...planillasEnOT.flatMap((p: any) => (p.filasChecklist || []).filter((f: any) => f.observacion?.trim()).map((f: any) => ({ texto: `[${p.nombre}] ${f.descripcion}: ${f.observacion}`, sev: f.severidad || "" }))),
    ].filter(Boolean) as { texto: string; sev: string }[];

    if (todasObs.length > 0) {
      if (y > 240) { pdf.addPage(); drawOTHeader(pdf); y = top + HEADER_H + 10; }
      pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
      pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.setFont(undefined as any, "bold");
      pdf.text("RESUMEN DE OBSERVACIONES TÉCNICAS", ML + 3, y + 5);
      y += 7.5;
      autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR },
        body: todasObs.map((o: any) => [o.texto, o.sev ? o.sev.toUpperCase() : ""]),
        styles: { fontSize: 8.5, cellPadding: 3 },
        columnStyles: { 1: { cellWidth: 35, halign: "center", fontStyle: "bold" } },
        willDrawCell: (cellData: any) => {
          if (cellData.column.index === 1 && cellData.section === "body") {
            const sev = todasObs[cellData.row.index]?.sev;
            if (sev && sevColors[sev]) pdf.setTextColor(sevColors[sev][0], sevColors[sev][1], sevColors[sev][2]);
          }
        }
      });
      y = (pdf as any).lastAutoTable.finalY + 10;
    }

    if (fotosOT.length > 0) {
      if (y > 220) { pdf.addPage(); drawOTHeader(pdf); y = top + HEADER_H + 10; }
      pdf.setFillColor(240, 240, 240); pdf.rect(ML, y, TW, 7, "F");
      pdf.setFontSize(8.5); pdf.setTextColor(0); pdf.setFont(undefined as any, "normal");
      pdf.text("REGISTRO FOTOGRÁFICO", ML + 3, y + 5);
      y += 10; let xPh = ML;
      for (const fUrl of fotosOT) {
        const b64 = await fetchImgBase64(fUrl);
        if (b64) {
          if (xPh + 45 > W - MR) { xPh = ML; y += 45; }
          if (y > 240) { pdf.addPage(); drawOTHeader(pdf); y = top + HEADER_H + 10; xPh = ML; }
          pdf.addImage(b64, "JPEG", xPh, y, 42, 42); xPh += 45;
        }
      }
      y += 50;
    }

    for (const p of planillasEnOT) {
      if (y > 240) { pdf.addPage(); drawOTHeader(pdf); y = top + HEADER_H + 10; }
      pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
      pdf.setFontSize(8.5); pdf.setTextColor(255); pdf.setFont(undefined as any, "bold");
      pdf.text(`PLANILLA: ${p.nombre}`, ML + 3, y + 5);
      y += 9;
      autoTable(pdf, {
        startY: y, margin: { left: ML, right: MR },
        head: p.tipo === "checklist" ? [["Ítem", "Res.", "Observación", "Prio."]] : [p.columnas],
        body: p.tipo === "checklist"
          ? (p.filasChecklist || []).filter((f: any) => !f.esGrupo).map((f: any) => [f.descripcion, f.valor?.toUpperCase() || "", f.observacion || "-", f.severidad?.toUpperCase() || "-"])
          : (p.filasTabla || []).map((f: any) => (p.columnas || []).map((c: string) => f.celdas?.[c] || "-")),
        styles: { fontSize: p.tipo === "tabla_piso" && (p.columnas || []).length > 8 ? 6.5 : 7.5, cellPadding: 2 },
        headStyles: { fillColor: [80, 80, 80], overflow: "linebreak" }, theme: "grid"
      });
      y = (pdf as any).lastAutoTable.finalY + 10;
    }

    if (y > 230) { pdf.addPage(); drawOTHeader(pdf); y = top + HEADER_H + 10; }
    pdf.setDrawColor(200); pdf.line(ML, y, W - MR, y); y += 5;
    if (firmaTecnico) {
      try { pdf.addImage(firmaTecnico, "PNG", ML + 10, y, 40, 20); } catch {}
      pdf.setFontSize(8); pdf.setFont(undefined as any, "normal"); pdf.setTextColor(0);
      pdf.text(`Firma Técnico: ${nombreFirmaTecnico}`, ML + 10, y + 25);
    }
    if (firmaCliente) {
      try { pdf.addImage(firmaCliente, "PNG", W - MR - 50, y, 40, 20); } catch {}
      pdf.setFontSize(8); pdf.setFont(undefined as any, "normal"); pdf.setTextColor(0);
      pdf.text(`Firma Cliente: ${nombreFirmaCliente}`, W - MR - 50, y + 25);
    }
  };

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

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
    p.setTextColor(0); p.setFont(undefined, "bold"); p.setFontSize(9);
    p.text(`CERTIFICADO  N°${nCert}`, cx, T + 28, { align: "center" });
    p.setFont(undefined, "italic"); p.setFontSize(7); p.setTextColor(90);
    p.text("Ingeniería contra Incendio", ML + 2, T + H - 2);
    p.line(rx, T, rx, T + H);
    const rows = [["Rubro:", data.rubro || "-"], ["Fecha:", fInsp], ["Rev. planos:", data.revPlanos || "-"], ["Pagina:", String(p.getCurrentPageInfo().pageNumber)]];
    rows.forEach(([k, v]: string[], i: number) => {
      const ry = T + (H / 4) * i + (H / 8) + 1.5;
      p.setFont(undefined, "bold"); p.text(k, rx + 2, ry);
      p.setFont(undefined, "normal"); p.text(v, rx + 24, ry);
      if (i < 3) p.line(rx, T + (H / 4) * (i + 1), W - MR, T + (H / 4) * (i + 1));
    });
    p.line(ML, T + H, W - MR, T + H);
    return T + H + 6;
  };

  let y = drawHeader(pdf);
  autoTable(pdf, {
    startY: y, margin: { left: ML, right: MR },
    body: [
      [{ content: "Fecha de Inspección", styles: { fontStyle: "bold", cellWidth: 45 } }, fInsp, { content: "Fecha de Vencimiento", styles: { fontStyle: "bold", cellWidth: 45 } }, fVenc],
      [{ content: "Sistema certificado:", styles: { fontStyle: "bold" } }, { content: data.sistemaCertificado || "-", colSpan: 3, styles: { fontStyle: "bold", textColor: [163, 31, 29] } }],
      [{ content: "Cliente:", styles: { fontStyle: "bold" } }, { content: (data.clienteNombre || "-") + (data.sedeNombre ? ` - SEDE: ${data.sedeNombre}` : ""), colSpan: 3, styles: { halign: "center", fontStyle: "bold" } }],
      [{ content: "Razón social:", styles: { fontStyle: "bold" } }, { content: data.clienteCuit || data.sedeRazonSocial || data.clienteEmpresa || "-", colSpan: 3, styles: { halign: "center" } }],
      [{ content: "Domicilio:", styles: { fontStyle: "bold" } }, { content: data.clienteDireccion || "-", colSpan: 3 }],
      [{ content: "Responsable certificado:", styles: { fontStyle: "bold" } }, { content: data.responsableCertificado || "-", colSpan: 3 }],
      [{ content: "Empresa Certificante:", styles: { fontStyle: "bold" } }, { content: "ARIFA — INGENIERIA EN SEGURIDAD CONTRA INCENDIOS  |  CUIT 20-35108395-7  |  www.arifa.com.ar", colSpan: 3, styles: { fontStyle: "bold", textColor: [0, 34, 68] } }],
    ],
    styles: { fontSize: 9, cellPadding: 4 }, tableLineColor: [0, 34, 68], tableLineWidth: 0.3,
    didParseCell: (d: any) => { if (d.row.index === 6) d.cell.styles.fillColor = [245, 247, 255]; },
  });
  y = (pdf as any).lastAutoTable.finalY + 10;

  if (data.memoriaDescriptiva?.trim()) {
    if (y + 14 > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; }
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8); pdf.setFont(undefined as any, "bold"); pdf.setTextColor(255);
    pdf.text("MEMORIA DESCRIPTIVA", ML + 3, y + 5);
    y += 11;

    for (const line of data.memoriaDescriptiva.split("\n")) {
      if (!line.trim()) { y += 3; continue; }
      const isHeader = line.trim() === line.trim().toUpperCase() && line.trim().length > 3;
      const lineH = isHeader ? 7 : 5.5;
      const wrapped = pdf.splitTextToSize(line.trim(), isHeader ? TW - 8 : TW);
      const blockH = wrapped.length * lineH + (isHeader ? 10 : 0);
      if (y + blockH > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; }
      if (isHeader) {
        y += 3;
        pdf.setFillColor(240, 244, 255); pdf.rect(ML, y - 3, TW, wrapped.length * lineH + 5, "F");
        pdf.setFillColor(0, 34, 68); pdf.rect(ML, y - 3, 3.5, wrapped.length * lineH + 5, "F");
        pdf.setFont(undefined as any, "bold"); pdf.setFontSize(9.5); pdf.setTextColor(0, 34, 68);
        pdf.text(wrapped, ML + 7, y + 1);
        y += wrapped.length * lineH + 6;
      } else {
        pdf.setFont(undefined as any, "normal"); pdf.setFontSize(9); pdf.setTextColor(40, 40, 40);
        pdf.text(wrapped, ML, y);
        y += wrapped.length * lineH;
      }
    }
    y += 8;
  }

  const fotos: string[] = data.fotos || [];
  if (fotos.length > 0) {
    if (y + 72 > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; }
    pdf.setFillColor(0, 34, 68); pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8); pdf.setFont(undefined as any, "bold"); pdf.setTextColor(255);
    pdf.text("REGISTRO FOTOGRÁFICO", ML + 3, y + 5);
    y += 10;
    let col = 0;
    const imgW = (TW - 5) / 2; const imgH = 55;
    for (const url of fotos) {
      const b64 = await fetchImgBase64(url);
      if (b64) {
        if (y + imgH > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; col = 0; }
        pdf.addImage(b64, "JPEG", ML + col * (imgW + 5), y, imgW, imgH);
        col++;
        if (col === 2) { col = 0; y += imgH + 5; }
      }
    }
    if (col > 0) y += imgH + 5;
    y += 6;
  }

  const djLines = pdf.splitTextToSize(DECLARACION_JURADA, TW);
  if (y + djLines.length * 5 + 40 > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; }
  pdf.setFillColor(248, 249, 252); pdf.rect(ML, y, TW, 6, "F");
  pdf.setFont(undefined as any, "bold"); pdf.setFontSize(8.5); pdf.setTextColor(0, 34, 68);
  pdf.text("DECLARACIÓN JURADA", ML + 3, y + 4); y += 9;
  pdf.setFont(undefined as any, "normal"); pdf.setFontSize(8.5); pdf.setTextColor(40);
  pdf.text(djLines, ML, y); y += djLines.length * 5 + 10;

  if (y + 35 > PAGE_BOTTOM) { pdf.addPage(); y = drawHeader(pdf) + 5; }
  const bw = (TW - 10) / 2;
  pdf.rect(ML, y, bw, 28); pdf.rect(ML + bw + 10, y, bw, 28);
  pdf.setFontSize(8); pdf.setTextColor(80);
  pdf.text("Firma Profesional Interviniente", ML + 2, y + 4);
  pdf.text("Firma Propietario/Responsable del Inmueble", ML + bw + 12, y + 4);
  if (data.firmaProfesional) try { pdf.addImage(data.firmaProfesional, "PNG", ML + 5, y + 6, bw - 10, 18); } catch {}
  if (data.firmaCliente) try { pdf.addImage(data.firmaCliente, "PNG", ML + bw + 15, y + 6, bw - 10, 18); } catch {}

  for (const otData of ots) {
    try { await appendOTPagesToDoc(pdf, otData, logoDataUrl); } catch (e) { console.warn("Error adjuntando IT al PDF:", e); }
  }

  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    const fy = 287;
    pdf.setDrawColor(200); pdf.setLineWidth(0.2); pdf.line(ML, fy - 5, W - MR, fy - 5);
    pdf.setFont(undefined as any, "italic"); pdf.setFontSize(7.5); pdf.setTextColor(120);
    pdf.text(`Emitido el ${fInsp}.`, ML, fy);
    pdf.text(`Página ${i} de ${total}`, W / 2, fy, { align: "center" });
    pdf.text("ARIFA - Protección contra Incendios", W - MR, fy, { align: "right" });
  }

  pdf.save(`ARIFA-Cert-${nCert}.pdf`);
};
