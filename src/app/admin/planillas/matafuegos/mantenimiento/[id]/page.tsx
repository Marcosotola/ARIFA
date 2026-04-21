"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { generateMantenimientoPDF } from "@/lib/pdfGenerator";

export default function DetalleMantenimientoPage() {
  const { id } = useParams();
  const router = useRouter();
  const [ficha, setFicha] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      setRole(userDoc.exists() ? userDoc.data().rol : "cliente");

      const docRef = doc(db, "mantenimiento_matafuegos", id as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setFicha({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id, router]);

  const handleDownloadPDF = async () => {
    if (!ficha) return;
    try {
        await generateMantenimientoPDF(ficha);
    } catch (error) {
        console.error("Error al generar PDF:", error);
        alert("Hubo un error al generar el PDF.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "mantenimiento_matafuegos", id as string));
      router.push("/admin/planillas/matafuegos/mantenimiento");
    } catch (e) {
      alert("Error al eliminar la ficha.");
    }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando ficha...</div>;
  if (!ficha) return <div style={{ padding: "100px", textAlign: "center" }}>No se encontró la ficha técnica.</div>;

  const isAdmin = role === "admin";

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", paddingBottom: "100px" }}>
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <button onClick={() => router.push("/admin/planillas/matafuegos/mantenimiento")} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: '10px', display: 'block', padding: 0 }}>← Volver a la lista</button>
          <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "var(--primary-blue)" }}>Ficha Técnica FT-{String(ficha.numeroFicha).padStart(5, "0")}</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isAdmin && (
            <button onClick={() => setDeleteConfirm(true)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ffddd9', background: '#fff5f4', color: 'var(--primary-red)', cursor: 'pointer' }}>
              🗑️
            </button>
          )}
          <button onClick={() => router.push(`/admin/planillas/matafuegos/mantenimiento/nuevo?edit=${ficha.id}`)} style={{ padding: '12px 18px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            ✏️ Editar
          </button>
          <button onClick={handleDownloadPDF} className="btn-red" style={{ padding: "12px 25px", fontWeight: 700 }}>
            📥 Descargar PDF
          </button>
        </div>
      </header>

      {/* CONFIRMACION ELIMINAR ESTILO OT */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar esta ficha técnica?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer y el registro desaparecerá del sistema.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleDelete} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#999', margin: 0, textTransform: 'uppercase' }}>Cliente / Razón Social</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: '5px 0' }}>{ficha.clienteNombre}</p>
            <p style={{ color: '#666' }}>{ficha.clienteEmpresa || "S/D"}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#999', margin: 0, textTransform: 'uppercase' }}>Fecha de Servicio</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: '5px 0' }}>{new Date(ficha.fechaServicio).toLocaleDateString("es-AR")}</p>
            <p style={{ color: '#666' }}>Técnico: {ficha.tecnicoNombre}</p>
          </div>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-blue)', marginBottom: '15px' }}>Equipos Procesados</h3>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #f0f0f0' }}>
                <th style={{ padding: '12px 8px' }}>Tarj. N°</th>
                <th style={{ padding: '12px 8px' }}>Agente / Cap.</th>
                <th style={{ padding: '12px 8px' }}>Marca / Año</th>
                <th style={{ padding: '12px 8px' }}>Clase</th>
                <th style={{ padding: '12px 8px' }}>Estado</th>
                <th style={{ padding: '12px 8px' }}>Venc. Carga</th>
              </tr>
            </thead>
            <tbody>
              {ficha.items.map((item: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f9f9f9' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 800 }}>{item.nroTarjeta}</td>
                  <td style={{ padding: '12px 8px' }}>{item.agente} {item.capacidad}</td>
                  <td style={{ padding: '12px 8px' }}>{item.marca} ({item.anioFab})</td>
                  <td style={{ padding: '12px 8px' }}>
                    {item.claseFuego?.map((c: string) => (
                      <span key={c} style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px', marginRight: '3px', fontSize: '0.7rem' }}>{c}</span>
                    ))}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ 
                      fontSize: '0.65rem', padding: '3px 8px', borderRadius: '10px', fontWeight: 800,
                      background: item.estadoCilindro === 'aprobado' ? '#dcfce7' : '#fee2e2',
                      color: item.estadoCilindro === 'aprobado' ? '#166534' : '#991b1b'
                    }}>
                      {item.estadoCilindro?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--primary-red)' }}>{item.vencimientoCarga}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '30px', padding: '20px', background: '#f8fafc', borderRadius: '12px' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', textTransform: 'uppercase' }}>Observaciones Generales</h4>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>
            Los extintores detallados cumplen con las normas de seguridad vigentes para su uso inmediato. Se recomienda el control visual mensual de la presión.
          </p>
        </div>
      </div>
    </div>
  );
}
