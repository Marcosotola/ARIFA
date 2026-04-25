"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, addDoc, getDocs, orderBy, updateDoc, doc, serverTimestamp, where, getDoc } from "firebase/firestore";

export default function OrdenesAdmin() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [newOrder, setNewOrder] = useState({ cliente: "", direccion: "", tipo: "Mantenimiento Matafuegos", estado: "Pendiente", tecnico: "" });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDoc = await getDoc(doc(db, "usuarios", u.uid));
        const roleData = userDoc.exists() ? userDoc.data().rol : "cliente";
        setRole(roleData);
        fetchOrdenes(u.uid, roleData);
      }
    });
    return () => unsub();
  }, []);

  const fetchOrdenes = async (uid: string, role: string) => {
    try {
      let q;
      if (role === 'admin' || role === 'superadmin') {
        q = query(collection(db, "ordenes_trabajo"), orderBy("fechaCreacion", "desc"));
      } else {
        q = query(collection(db, "ordenes_trabajo"), where("userId", "==", uid), orderBy("fechaCreacion", "desc"));
      }
      
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrdenes(docs);
    } catch (e) {
      console.error("Error fetching ordenes:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'admin') return;
    try {
      await addDoc(collection(db, "ordenes_trabajo"), {
        ...newOrder,
        fechaCreacion: serverTimestamp(),
      });
      fetchOrdenes(user.uid, role!);
      setShowForm(false);
      setNewOrder({ cliente: "", direccion: "", tipo: "Mantenimiento Matafuegos", estado: "Pendiente", tecnico: "" });
    } catch (e) {
      alert("Error al crear la orden: " + e);
    }
  };

  const setStatus = async (id: string, s: string) => {
    if (role !== 'admin') return;
    try {
      await updateDoc(doc(db, "ordenes_trabajo", id), { estado: s });
      setOrdenes(prev => prev.map(o => o.id === id ? { ...o, estado: s } : o));
    } catch (e) {
      alert("Error: " + e);
    }
  };

  if (loading) return <div style={{padding: '50px', textAlign:'center', color:'var(--text-muted)'}}>Cargando Órdenes...</div>;

  const isAdmin = role === 'admin' || role === 'superadmin';

  return (
    <div style={{ maxWidth: "1200px" }}>
      <header style={{ marginBottom: "35px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary-blue)" }}>
            {isAdmin ? "Órdenes de Trabajo" : "Mis Órdenes de Trabajo"}
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>
            {isAdmin ? "Gestión de visitas técnicas y mantenimientos." : "Seguí el progreso de tus servicios técnicos contratados."}
          </p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="btn-red"
            style={{ padding: "12px 25px" }}
          >
            {showForm ? "✖ Cancelar" : "➕ Nueva Orden"}
          </button>
        )}
      </header>

      {showForm && isAdmin && (
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

      <div style={{ background: "#fff", padding: isAdmin ? "30px" : "20px", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.03)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid var(--border-light)" }}>
                <th style={{ textAlign: "left", padding: "12px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>ID / Fecha</th>
                {isAdmin && <th style={{ textAlign: "left", padding: "12px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Cliente</th>}
                <th style={{ textAlign: "left", padding: "12px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Servicio</th>
                {!isAdmin && <th style={{ textAlign: "left", padding: "12px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Dirección</th>}
                <th style={{ textAlign: "left", padding: "12px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Técnico</th>
                <th style={{ textAlign: "center", padding: "12px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.length > 0 ? ordenes.map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid #f2f5f9" }}>
                  <td style={{ padding: "15px 12px", fontSize: "0.85rem" }}>
                    <div style={{ fontWeight: 800, color: "#999" }}>#{o.id.slice(0, 6)}</div>
                    <div style={{ fontSize: "0.7rem", color: "#666" }}>{new Date(o.fechaCreacion?.seconds * 1000).toLocaleDateString()}</div>
                  </td>
                  {isAdmin && (
                    <td style={{ padding: "15px 12px", fontSize: "0.88rem" }}>
                      <div style={{ fontWeight: 700 }}>{o.cliente}</div>
                      <div style={{ fontSize: "0.75rem", color: "#888" }}>{o.direccion}</div>
                    </td>
                  )}
                  <td style={{ padding: "15px 12px", fontSize: "0.85rem" }}>
                    <div style={{ padding: "3px 10px", borderRadius: "20px", display: "inline-block", background: "#f0f0f0", fontWeight: 700, fontSize: "0.75rem" }}>{o.tipo}</div>
                  </td>
                  {!isAdmin && <td style={{ padding: "15px 12px", fontSize: "0.85rem", color: "#666" }}>{o.direccion}</td>}
                  <td style={{ padding: "15px 12px", fontSize: "0.85rem", color: "#666" }}>{o.tecnico || "Sin asignar"}</td>
                  <td style={{ padding: "15px 12px", textAlign: "center" }}>
                    {isAdmin ? (
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
                    ) : (
                      <span style={{ 
                        fontSize: "0.6rem", padding: "4px 10px", borderRadius: "20px", fontWeight: 900, textTransform: "uppercase",
                        background: o.estado === "Completada" ? "#e8f5e9" : o.estado === "En Proceso" ? "#fff3e0" : "#f5f5f5",
                        color: o.estado === "Completada" ? "#2e7d32" : o.estado === "En Proceso" ? "#ef6c00" : "#555",
                      }}>
                        {o.estado}
                      </span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: "center", padding: "40px", color: "#bbb" }}>
                    No tenés órdenes registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
