"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, limit, getDocs, orderBy } from "firebase/firestore";
import Link from "next/link";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ consultas: 0, ordenes: 0, productos: 0, usuarios: 0 });
  const [latestConsultas, setLatestConsultas] = useState<any[]>([]);

  useEffect(() => {
    // Fetch stats (In a real app, use a proper function or cloud function)
    const fetchLatest = async () => {
      try {
        const q = query(collection(db, "consultas"), orderBy("fecha", "desc"), limit(5));
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLatestConsultas(docs);
        setStats(prev => ({ ...prev, consultas: docs.length })); // Mock count
      } catch (e) {
        console.error("Error fetching admin stats:", e);
      }
    };
    fetchLatest();
  }, []);

  const statCards = [
    { label: "Consultas Nuevas", value: stats.consultas, color: "#2196F3", icon: "📧" },
    { label: "Órdenes Activas", value: stats.ordenes, color: "#4CAF50", icon: "🛠️" },
    { label: "Productos en Catálogo", value: stats.productos, color: "#FF9800", icon: "🛒" },
    { label: "Total Usuarios", value: stats.usuarios, color: "#9C27B0", icon: "👥" },
  ];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "35px" }}>
        <h1 style={{ fontSize: "2.1rem", fontWeight: 800, color: "var(--primary-blue)" }}>Panel de Control ARIFA</h1>
        <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>Resumen general de las operaciones de la empresa.</p>
      </header>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "25px", marginBottom: "40px" }}>
        {statCards.map((card) => (
          <div key={card.label} style={{ background: "#fff", padding: "28px", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "15px" }}>{card.icon}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{card.label}</div>
            <div style={{ fontSize: "2.3rem", fontWeight: 800, color: card.color, marginTop: "8px" }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" }}>
        {/* Latest Consultas Table */}
        <section style={{ background: "#fff", padding: "30px", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Últimas Consultas / Cotizaciones</h2>
            <Link href="/admin/consultas" style={{ color: "var(--primary-red)", fontWeight: 700, fontSize: "0.85rem" }}>Ver todas 🔗</Link>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ borderBottom: "1.5px solid var(--border-light)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 10px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Fecha</th>
                <th style={{ textAlign: "left", padding: "12px 10px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Nombre</th>
                <th style={{ textAlign: "left", padding: "12px 10px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Asunto</th>
                <th style={{ textAlign: "left", padding: "12px 10px", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {latestConsultas.length > 0 ? latestConsultas.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f2f5f9" }}>
                  <td style={{ padding: "15px 10px", fontSize: "0.9rem" }}>{new Date(c.fecha?.seconds * 1000).toLocaleDateString()}</td>
                  <td style={{ padding: "15px 10px", fontSize: "0.9rem", fontWeight: 600 }}>{c.nombre || "Sin nombre"}</td>
                  <td style={{ padding: "15px 10px", fontSize: "0.9rem", color: "#555" }}>{c.servicio || "General"}</td>
                  <td style={{ padding: "15px 10px" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 800, padding: "4px 10px", borderRadius: "20px", background: "#e3f2fd", color: "#1976d2", textTransform: "uppercase" }}>
                      {c.estado || "Nueva"}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>No hay consultas recientes todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Quick Actions */}
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "var(--primary-blue)", padding: "25px", borderRadius: "12px", color: "#fff" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "15px" }}>Acciones Rápidas</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button style={{ background: "rgba(255,255,255,0.15)", border: "none", padding: "12px", borderRadius: "6px", color: "#fff", fontWeight: 700, cursor: "pointer", textAlign: "left" }}>➕ Crear Orden de Trabajo</button>
              <button style={{ background: "rgba(255,255,255,0.15)", border: "none", padding: "12px", borderRadius: "6px", color: "#fff", fontWeight: 700, cursor: "pointer", textAlign: "left" }}>📂 Cargar Nuevo Producto</button>
              <button style={{ background: "rgba(255,255,255,0.15)", border: "none", padding: "12px", borderRadius: "6px", color: "#fff", fontWeight: 700, cursor: "pointer", textAlign: "left" }}>👤 Ver Técnicos de Campo</button>
            </div>
          </div>
          <div style={{ background: "#fff", padding: "25px", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.05)" }}>
             <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "12px" }}>Ayuda Panel Admin</h3>
             <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: "1.5" }}>Desde aquí podrás visualizar el flujo de trabajo de cada una de las áreas técnicas y comerciales.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
