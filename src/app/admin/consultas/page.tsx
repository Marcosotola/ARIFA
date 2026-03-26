"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy, updateDoc, doc, deleteDoc } from "firebase/firestore";

export default function ConsultasAdmin() {
  const [consultas, setConsultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConsultas = async () => {
    try {
      const q = query(collection(db, "consultas"), orderBy("fecha", "desc"));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setConsultas(docs);
    } catch (e) {
      console.error("Error fetching consultas:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultas();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "consultas", id), { estado: newStatus });
      setConsultas(prev => prev.map(c => c.id === id ? { ...c, estado: newStatus } : c));
    } catch (e) {
      alert("Error actualizando estado: " + e);
    }
  };

  const deleteConsulta = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta consulta?")) {
      try {
        await deleteDoc(doc(db, "consultas", id));
        setConsultas(prev => prev.filter(c => c.id !== id));
      } catch (e) {
        alert("Error eliminando consulta: " + e);
      }
    }
  };

  if (loading) return <div>Cargando Consultas...</div>;

  return (
    <div style={{ maxWidth: "1200px" }}>
      <header style={{ marginBottom: "35px" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary-blue)" }}>Listado de Consultas / Cotizaciones</h1>
        <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>Gestione los pedidos de información y presupuestos recibidos.</p>
      </header>

      <div style={{ background: "#fff", padding: "30px", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.03)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ borderBottom: "1.5px solid var(--border-light)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 10px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Fecha</th>
                <th style={{ textAlign: "left", padding: "12px 10px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Cliente / Empresa</th>
                <th style={{ textAlign: "left", padding: "12px 10px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Interés</th>
                <th style={{ textAlign: "left", padding: "12px 10px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Mensaje</th>
                <th style={{ textAlign: "left", padding: "12px 10px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Estado</th>
                <th style={{ textAlign: "right", padding: "12px 10px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {consultas.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f2f5f9" }}>
                  <td style={{ padding: "15px 10px", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                    {new Date(c.fecha?.seconds * 1000).toLocaleDateString()}
                    <div style={{ fontSize: "0.7rem", color: "#888" }}>{new Date(c.fecha?.seconds * 1000).toLocaleTimeString()}</div>
                  </td>
                  <td style={{ padding: "15px 10px", fontSize: "0.88rem" }}>
                    <div style={{ fontWeight: 700 }}>{c.nombre || "---"}</div>
                    <div style={{ color: "#666" }}>{c.email}</div>
                    <div style={{ color: "#888", fontSize: "0.75rem" }}>{c.empresa || "---"} | {c.telefono || "---"}</div>
                  </td>
                  <td style={{ padding: "15px 10px", fontSize: "0.85rem", color: "var(--primary-red)", fontWeight: 700 }}>{c.servicio || "General"}</td>
                  <td style={{ padding: "15px 10px", fontSize: "0.85rem", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.mensaje || "---"}</td>
                  <td style={{ padding: "15px 10px" }}>
                    <select 
                      value={c.estado || "nueva"} 
                      onChange={(e) => updateStatus(c.id, e.target.value)}
                      style={{ 
                        fontSize: "0.75rem", 
                        padding: "5px 10px", 
                        borderRadius: "20px",
                        border: "none",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        cursor: "pointer",
                        background: c.estado === "atendida" ? "#e8f5e9" : c.estado === "cancelada" ? "#fee" : "#e0f2f1",
                        color: c.estado === "atendida" ? "#2e7d32" : c.estado === "cancelada" ? "#c62828" : "#00796b"
                      }}
                    >
                      <option value="nueva">Nueva</option>
                      <option value="atendida">Atendida</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </td>
                  <td style={{ padding: "15px 10px", textAlign: "right" }}>
                    <button 
                      onClick={() => deleteConsulta(c.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                    <button 
                      onClick={() => window.open(`https://wa.me/${c.telefono?.replace(/\D/g, '')}`, '_blank')}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", marginLeft: "10px" }}
                      title="Contactar WhatsApp"
                    >
                      💬
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
