"use client";
export default function ExtincionPage() {
  return (
    <div style={{ maxWidth: "900px" }}>
      <header style={{ marginBottom: "30px" }}>
        <span style={{ fontSize: "0.8rem", background: "#fff3e0", color: "#e65100", padding: "3px 10px", borderRadius: "20px", fontWeight: 700 }}>
          🧯 Planillas / Extinción
        </span>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)", marginTop: "10px" }}>Órdenes de Trabajo — Extinción</h1>
        <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>Sistema de Extinción de Incendios — planillas de inspección y mantenimiento.</p>
      </header>
      <div style={{ background: "#fff", borderRadius: "12px", padding: "60px 40px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>🧯</div>
        <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "10px" }}>Módulo Extinción</h2>
        <p style={{ color: "var(--text-muted)", maxWidth: "460px", margin: "0 auto 24px" }}>
          Las OT de Extinción comparten el mismo sistema de planillas. Podés usar las planillas de categoría <strong>Extinción</strong> desde cualquier OT en Detección,
          o próximamente este módulo tendrá su propio listado independiente.
        </p>
        <a href="/admin/planillas/deteccion/nueva" className="btn-red" style={{ display: "inline-block", padding: "12px 28px" }}>
          ➕ Crear OT con planillas de Extinción
        </a>
      </div>
    </div>
  );
}
