"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, addDoc, getDocs, orderBy, updateDoc, doc, serverTimestamp } from "firebase/firestore";

export default function OrdenesAdmin() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newOrder, setNewOrder] = useState({ cliente: "", direccion: "", tipo: "Mantenimiento", estado: "Pendiente", tecnico: "" });

  const fetchOrdenes = async () => {
    try {
      const q = query(collection(db, "ordenes_trabajo"), orderBy("fechaCreacion", "desc"));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrdenes(docs);
    } catch (e) {
      console.error("Error fetching admin stats:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdenes();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "ordenes_trabajo"), {
        ...newOrder,
        fechaCreacion: serverTimestamp(),
      });
      fetchOrdenes();
      setShowForm(false);
      setNewOrder({ cliente: "", direccion: "", tipo: "Mantenimiento", estado: "Pendiente", tecnico: "" });
    } catch (e) {
      alert("Error al crear la orden: " + e);
    }
  };

  const setStatus = async (id: string, s: string) => {
    try {
      await updateDoc(doc(db, "ordenes_trabajo", id), { estado: s });
      setOrdenes(prev => prev.map(o => o.id === id ? { ...o, estado: s } : o));
    } catch (e) {
      alert("Error: " + e);
    }
  };

  if (loading) return <div>Cargando Órdenes...</div>;

  return (
    <div style={{ maxWidth: "1200px" }}>
      <header style={{ marginBottom: "35px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary-blue)" }}>Órdenes de Trabajo</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>Gestión de visitas técnicas y mantenimientos.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="btn-red"
          style={{ padding: "12px 25px" }}
        >
          {showForm ? "✖ Cancelar" : "➕ Nueva Orden"}
        </button>
      </header>

      {showForm && (
        <section style={{ background: "#fff", padding: "30px", borderRadius: "12px", marginBottom: "30px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "20px" }}>Crear Nueva Orden de Trabajo</h2>
          <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div className="form-group">
               <label>Cliente / Razón Social</label>
               <input type="text" required value={newOrder.cliente} onChange={(e) => setNewOrder({...newOrder, cliente: e.target.value})} placeholder="Ej: Industria S.A." style={{width:'100%', padding:'12px', borderRadius:'4px', border:'1px solid #ddd'}} />
            </div>
            <div className="form-group">
               <label>Dirección del Servicio</label>
               <input type="text" required value={newOrder.direccion} onChange={(e) => setNewOrder({...newOrder, direccion: e.target.value})} placeholder="Ej: Av. Colon 1200" style={{width:'100%', padding:'12px', borderRadius:'4px', border:'1px solid #ddd'}} />
            </div>
            <div className="form-group">
               <label>Tipo de Trabajo</label>
               <select value={newOrder.tipo} onChange={(e) => setNewOrder({...newOrder, tipo: e.target.value})} style={{width:'100%', padding:'12px', borderRadius:'4px', border:'1px solid #ddd'}}>
                  <option>Mantenimiento Matafuegos</option>
                  <option>Revisión Instalación Fija</option>
                  <option>Cálculo Carga de Fuego</option>
                  <option>Capacitación al Personal</option>
                  <option>Emergencia / Urgencia</option>
               </select>
            </div>
            <div className="form-group">
               <label>Técnico Asignado</label>
               <input type="text" value={newOrder.tecnico} onChange={(e) => setNewOrder({...newOrder, tecnico: e.target.value})} placeholder="Nombre del técnico" style={{width:'100%', padding:'12px', borderRadius:'4px', border:'1px solid #ddd'}} />
            </div>
            <div style={{ gridColumn: "span 2", textAlign: "right", marginTop: "10px" }}>
              <button type="submit" className="btn-blue" style={{ minWidth: "180px", padding: "14px" }}>Guardar Orden 🛠️</button>
            </div>
          </form>
        </section>
      )}

      <div style={{ background: "#fff", padding: "30px", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.03)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid var(--border-light)" }}>
                <th style={{ textAlign: "left", padding: "12px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>ID / Fecha</th>
                <th style={{ textAlign: "left", padding: "12px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Cliente</th>
                <th style={{ textAlign: "left", padding: "12px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Tipo de Servicio</th>
                <th style={{ textAlign: "left", padding: "12px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Técnico</th>
                <th style={{ textAlign: "center", padding: "12px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid #f2f5f9" }}>
                  <td style={{ padding: "15px 12px", fontSize: "0.85rem" }}>
                    <div style={{ fontWeight: 800, color: "#999" }}>#{o.id.slice(0, 6)}</div>
                    <div style={{ fontSize: "0.7rem", color: "#666" }}>{new Date(o.fechaCreacion?.seconds * 1000).toLocaleDateString()}</div>
                  </td>
                  <td style={{ padding: "15px 12px", fontSize: "0.88rem" }}>
                    <div style={{ fontWeight: 700 }}>{o.cliente}</div>
                    <div style={{ fontSize: "0.75rem", color: "#888" }}>{o.direccion}</div>
                  </td>
                  <td style={{ padding: "15px 12px", fontSize: "0.85rem" }}>
                    <div style={{ padding: "3px 10px", borderRadius: "20px", display: "inline-block", background: "#f0f0f0", fontWeight: 700, fontSize: "0.75rem" }}>{o.tipo}</div>
                  </td>
                  <td style={{ padding: "15px 12px", fontSize: "0.85rem", color: "#666" }}>{o.tecnico || "Sin asignar"}</td>
                  <td style={{ padding: "15px 12px", textAlign: "center" }}>
                    <select 
                      value={o.estado} 
                      onChange={(e) => setStatus(o.id, e.target.value)}
                      style={{ 
                        fontSize: "0.7rem", padding: "5px 10px", borderRadius: "20px", border: "none", fontWeight: 900, textTransform: "uppercase" ,
                        background: o.estado === "Completada" ? "#e8f5e9" : o.estado === "En Proceso" ? "#fff3e0" : "#f5f5f5",
                        color: o.estado === "Completada" ? "#2e7d32" : o.estado === "En Proceso" ? "#ef6c00" : "#555",
                      }}
                    >
                      <option>Pendiente</option>
                      <option>En Proceso</option>
                      <option>Completada</option>
                      <option>Cancelada</option>
                    </select>
                  </td>
                </tr>
              ))}
              {ordenes.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>No hay órdenes de trabajo abiertas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
