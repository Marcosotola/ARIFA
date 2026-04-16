"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";

interface Equipo {
  id: string;
  tipo: string;
  capacidad: string;
  cantidad: string;
  esPrestamo: boolean;
  estado: string;
}

interface Remito {
  id: string;
  numero: number;
  tipo: "retiro" | "entrega";
  fecha: string;
  clienteNombre: string;
  clienteEmpresa: string;
  clienteDireccion: string;
  clienteTelefono: string;
  tecnicoNombre: string;
  equipos: Equipo[];
  firma: string;
  aclaracion: string;
  createdAt: any;
}

export default function DetalleRemitoPage() {
  const params = useParams();
  const router = useRouter();
  const [remito, setRemito] = useState<Remito | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRemito = async () => {
      try {
        const docRef = doc(db, "remitos_matafuegos", params.id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRemito({ id: docSnap.id, ...docSnap.data() } as Remito);
        } else {
          alert("Remito no encontrado");
          router.push("/admin/planillas/matafuegos");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRemito();
  }, [params.id, router]);

  const handlePDF = async () => {
    if (!remito) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 14; const MR = 14; const TW = W - ML - MR;
    const remNum = String(remito.numero).padStart(5, "0");
    const fecStr = remito.fecha ? new Date(remito.fecha).toLocaleDateString("es-AR") : "-";

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
    const drawHeader = (pg: any) => {
      const top = 10;
      pg.setDrawColor(0, 34, 68); pg.setLineWidth(0.5);
      pg.rect(ML, top, TW, HEADER_H);

      if (logoPng) pg.addImage(logoPng, "PNG", ML + 1, top + 2, 30, 26);
      pg.line(ML + 33, top, ML + 33, top + HEADER_H);

      const rx = W - MR - 48;
      const cx = ML + 33 + (rx - ML - 33) / 2;
      pg.setFont(undefined as any, "bold"); pg.setFontSize(10); pg.setTextColor(0, 34, 68);
      pg.text("REMITO DE MOVIMIENTO", cx, top + 9, { align: "center" });
      pg.text("Mantenimiento de Extintores", cx, top + 15, { align: "center" });
      pg.setFontSize(14); pg.setTextColor(163, 31, 29);
      pg.text(`R-${remNum}`, cx, top + 24, { align: "center" });

      pg.line(rx, top, rx, top + HEADER_H);
      pg.setFont(undefined as any, "bold"); pg.setFontSize(7); pg.setTextColor(0);
      pg.text("Fecha:", rx + 2, top + 8);
      pg.text("Tipo:", rx + 2, top + 15);
      pg.text("Técnico:", rx + 2, top + 22);
      
      pg.setFont(undefined as any, "normal");
      pg.text(fecStr, rx + 18, top + 8);
      pg.text(remito.tipo.toUpperCase(), rx + 18, top + 15);
      pg.text(remito.tecnicoNombre.split(" ")[0], rx + 18, top + 22);

      return top + HEADER_H + 8;
    };

    let y = drawHeader(pdf);

    // Cliente
    autoTable(pdf, {
      startY: y,
      margin: { left: ML, right: MR },
      body: [
        [{ content: "CLIENTE:", styles: { fontStyle: "bold", cellWidth: 40 } }, remito.clienteNombre],
        [{ content: "EMPRESA:", styles: { fontStyle: "bold" } }, remito.clienteEmpresa || "-"],
        [{ content: "DIRECCIÓN:", styles: { fontStyle: "bold" } }, remito.clienteDireccion || "-"],
        [{ content: "TELÉFONO:", styles: { fontStyle: "bold" } }, remito.clienteTelefono || "-"],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      tableLineColor: [0, 34, 68], tableLineWidth: 0.2,
    });
    y = (pdf as any).lastAutoTable.finalY + 8;

    // Equipos
    pdf.setFillColor(0, 34, 68);
    pdf.rect(ML, y, TW, 7, "F");
    pdf.setFontSize(8); pdf.setTextColor(255);
    pdf.text("DETALLE DE EQUIPOS", ML + 3, y + 5);
    y += 7;

    autoTable(pdf, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [["Cant.", "ID / Código", "Agente", "Capac.", "Estado", "Tipo"]],
      body: remito.equipos.map(eq => [
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

    // Firmas (Centralizada y limpia)
    if (y > 240) { pdf.addPage(); y = 50; }
    
    const bw = 100; // Recuadro más ancho
    const bx = (W - bw) / 2; // Centrado
    pdf.setDrawColor(200); pdf.setLineWidth(0.2);
    pdf.rect(bx, y, bw, 40);

    pdf.setFontSize(8); pdf.setTextColor(100);
    pdf.text("CONFORMIDAD Y RECEPCIÓN DEL CLIENTE", bx + bw/2, y + 5, { align: "center" });

    if (remito.firma) {
      pdf.addImage(remito.firma, "PNG", bx + 10, y + 7, bw - 20, 25);
    }
    
    pdf.setFontSize(10); pdf.setTextColor(0); pdf.setFont(undefined as any, "bold");
    pdf.text((remito.aclaracion || "").toUpperCase(), bx + bw/2, y + 36, { align: "center" });

    pdf.save(`Remito-${remito.tipo}-${remNum}.pdf`);
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando remito...</div>;
  if (!remito) return null;

  const isRetiro = remito.tipo === "retiro";

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ marginBottom: "30px", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link href="/admin/planillas/matafuegos" style={{ textDecoration: 'none', color: '#666', fontSize: '0.9rem' }}>← Volver al listado</Link>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary-blue)", marginTop: '5px' }}>
            Remito R-{String(remito.numero).padStart(5, "0")}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => router.push(`/admin/planillas/matafuegos/nuevo?edit=${remito.id}`)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            ✏️ Editar
          </button>
          <button onClick={handlePDF} className="btn-blue" style={{ padding: '10px 20px', borderRadius: '10px' }}>
            📥 Descargar PDF
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
             <span style={{ background: isRetiro ? '#fff1f2' : '#f0fdf4', color: isRetiro ? '#e11d48' : '#16a34a', padding: '5px 15px', borderRadius: '20px', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase' }}>
               {remito.tipo}
             </span>
             <span style={{ color: '#666', fontSize: '0.9rem' }}>Emitido el {new Date(remito.fecha).toLocaleDateString("es-AR")}</span>
          </div>

          <div style={{ marginBottom: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h4 style={{ color: '#999', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Cliente / Empresa</h4>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{remito.clienteNombre}</div>
              <div style={{ color: '#666' }}>{remito.clienteEmpresa}</div>
            </div>
            <div>
              <h4 style={{ color: '#999', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Logística</h4>
              <div style={{ fontSize: '0.9rem', color: '#444' }}>📍 {remito.clienteDireccion || 'Sin dirección'}</div>
              <div style={{ fontSize: '0.9rem', color: '#444' }}>📞 {remito.clienteTelefono || 'Sin teléfono'}</div>
            </div>
          </div>

          <h4 style={{ color: '#999', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '15px' }}>Equipos Afectados</h4>
          <div style={{ display: 'grid', gap: '10px' }}>
            {remito.equipos.map((eq, i) => (
              <div key={i} style={{ padding: '15px', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ background: 'var(--primary-blue)', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontWeight: 900 }}>{eq.cantidad}</div>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--primary-blue)' }}>{eq.id || 'S/ID'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{eq.tipo} — {eq.capacidad}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {eq.esPrestamo ? (
                    <span style={{ background: '#fff1f2', color: '#e11d48', padding: '5px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid #fda4af' }}>
                      🔥 EQUIPO DE PRÉSTAMO
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#999' }}>{eq.estado}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ background: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #eee', marginBottom: '20px' }}>
            <h4 style={{ color: '#999', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '15px' }}>Técnico Responsable</h4>
            <div style={{ fontWeight: 700 }}>{remito.tecnicoNombre}</div>
          </div>

          <div style={{ background: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
            <h4 style={{ color: '#999', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '15px' }}>Firma del Cliente</h4>
            {remito.firma ? (
              <>
                <img src={remito.firma} alt="Firma" style={{ width: '100%', border: '1px solid #eee', borderRadius: '8px', marginBottom: '10px' }} />
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', color: '#444' }}>{remito.aclaracion}</div>
                <div style={{ fontSize: '0.6rem', textAlign: 'center', color: '#999' }}>ACLARACIÓN</div>
              </>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#ccc', fontStyle: 'italic' }}>Sin firma</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
