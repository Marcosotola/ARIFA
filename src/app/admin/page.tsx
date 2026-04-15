"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, getDocs, where, doc, getDoc, orderBy } from "firebase/firestore";
import Link from "next/link";

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [stats, setStats] = useState({ unread: 0, ordenes: 0, certificados: 0, productos: 0, usuarios: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDoc = await getDoc(doc(db, "usuarios", u.uid));
        const roleData = userDoc.exists() ? userDoc.data().rol : "cliente";
        setRole(roleData);
        fetchStats(u.uid, u.email, roleData);
      }
    });
    return () => unsub();
  }, []);

  const fetchStats = async (uid: string, email: string | null, role: string) => {
    try {
      setLoading(true);
      if (role === 'admin' || role === 'tecnico') {
        const qUnread = query(collection(db, "consultas"), where("estado", "==", "nueva"));
        const unreadSnap = await getDocs(qUnread);
        const otSnap = await getDocs(query(collection(db, "ordenes_trabajo"), orderBy("createdAt", "desc")));
        const certSnap = await getDocs(query(collection(db, "certificados"), orderBy("createdAt", "desc")));
        const prodSnap = await getDocs(collection(db, "productos"));
        const userSnap = await getDocs(collection(db, "usuarios"));
        setStats({
          unread: unreadSnap.size,
          ordenes: otSnap.size,
          certificados: certSnap.size,
          productos: prodSnap.size,
          usuarios: userSnap.size
        });
      } else {
        const qMyConsultas = query(collection(db, "consultas"), where("email", "==", email));
        const myConsSnap = await getDocs(qMyConsultas);
        const qMyOrdenes = query(collection(db, "ordenes_trabajo"), where("clienteId", "==", uid));
        const myOrdSnap = await getDocs(qMyOrdenes);
        setStats({
          unread: myConsSnap.size,
          ordenes: myOrdSnap.size,
          certificados: 0,
          productos: 0,
          usuarios: 0
        });
      }
    } catch (e) {
      console.error("Error fetching stats:", e);
    } finally {
      setLoading(false);
    }
  };


  const isClient = role === "cliente";
  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "tecnico";

  const statCards = isClient ? [
    { label: "Mis Consultas", value: stats.unread, color: "var(--primary-red)", icon: "📧", href: "/admin/consultas" },
    { label: "Mis Planillas", value: stats.ordenes + stats.certificados, color: "var(--primary-blue)", icon: "📋", href: "/admin/planillas" },
  ] : [
    { label: "Consultas", value: stats.unread, color: "var(--primary-red)", icon: "📧", href: "/admin/consultas" },
    { label: "Total Planillas", value: stats.ordenes + stats.certificados, color: "#2b6cb0", icon: "📋", href: "/admin/planillas" },
    { label: "Productos", value: stats.productos, color: "#FF9800", icon: "🛒", href: "/admin/productos" },
    { label: "Usuarios", value: stats.usuarios, color: "#9C27B0", icon: "👥", href: "/admin/usuarios" },
  ];

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <header style={{ marginBottom: "35px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>
          {loading ? "Sincronizando..." : `Hola, ${user?.email?.split('@')[0]}`}
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px", fontSize: "0.95rem" }}>
          {isClient ? "Bienvenido a tu panel de cliente ARIFA." : isStaff ? "Panel de Gestión y Operaciones ARIFA." : "Acceso al Sistema."}
        </p>
      </header>


      {/* Stats Grid */}
      <div className="dashboard-grid-4" style={{ 
        display: "grid", 
        gridTemplateColumns: isClient ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(180px, 1fr))", 
        gap: "20px", 
        marginBottom: "40px",
        maxWidth: "100%" 
      }}>
        {statCards.map((card) => (
          <Link href={card.href} key={card.label} 
                className="stat-card-item"
                style={{ 
                  background: "#fff", 
                  padding: "25px", 
                  borderRadius: "12px", 
                  boxShadow: "0 4px 15px rgba(0,0,0,0.04)", 
                  border: !isClient && card.value > 0 && card.label === "Consultas" ? "2px solid var(--primary-red)" : "1px solid rgba(0,0,0,0.06)",
                  transition: 'transform 0.2s',
                  display: 'block',
                  position: 'relative'
                }}>
            <div className="card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="card-icon" style={{ fontSize: "1.8rem" }}>{card.icon}</div>
              {!isClient && card.value > 0 && card.label === "Consultas" && (
                <span className="card-badge" style={{ background: 'var(--primary-red)', color: '#fff', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>NUEVO</span>
              )}
            </div>
            <div className="card-label" style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginTop: '15px' }}>{card.label}</div>
            <div className="card-value" style={{ fontSize: "2rem", fontWeight: 900, color: card.color, marginTop: "5px" }}>{card.value}</div>
          </Link>
        ))}
      </div>

      <div className="dashboard-flex-main" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "25px" }}>
        {/* Quick Actions Panel */}
        <section style={{ background: isClient ? "var(--bg-light)" : "var(--primary-blue)", padding: "25px", borderRadius: "12px", color: isClient ? "var(--text-dark)" : "#fff", border: isClient ? "1px solid #ddd" : "none" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "18px" }}>{isClient ? "Tus Datos" : "Operaciones Rápidas"}</h2>
          {isClient ? (
            <div style={{ fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '10px' }}><strong>Email:</strong> {user?.email}</div>
              <div style={{ marginBottom: '10px' }}><strong>Rol:</strong> {role}</div>
              <Link href="/admin/config" className="btn-blue" style={{ marginTop: '10px', fontSize: '0.8rem', padding: '8px 15px' }}>Editar Perfil</Link>
            </div>
          ) : (
            <div className="grid-2-mobile" style={{ display: "grid", gridTemplateColumns: '1fr 1fr', gap: "10px" }}>
              <Link href="/admin/planillas" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", padding: "14px 15px", borderRadius: "8px", color: "#fff", fontWeight: 700, cursor: "pointer", textAlign: "left", fontSize: '0.85rem', display: 'block' }}>📋 Gestionar Planillas</Link>
              <Link href="/admin/productos" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", padding: "14px 15px", borderRadius: "8px", color: "#fff", fontWeight: 700, cursor: "pointer", textAlign: "left", fontSize: '0.85rem', display: 'block' }}>📦 Catálogo & Prod.</Link>
              <Link href="/admin/consultas" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", padding: "14px 15px", borderRadius: "8px", color: "#fff", fontWeight: 700, cursor: "pointer", textAlign: "left", fontSize: '0.85rem', display: 'block' }}>📧 Consultas Recib.</Link>
              {isAdmin && <Link href="/admin/usuarios" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", padding: "14px 15px", borderRadius: "8px", color: "#fff", fontWeight: 700, cursor: "pointer", textAlign: "left", fontSize: '0.85rem', display: 'block' }}>👥 Usuarios Sist.</Link>}
            </div>
          )}
        </section>

        {/* Info Box */}
        <section style={{ background: "#fff", padding: "25px", borderRadius: "12px", border: "1px solid #eee", display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>{isClient ? "🔔" : "🚀"}</div>
          <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "8px", color: 'var(--primary-blue)' }}>
            {isClient ? "Centro de Ayuda" : "Atención de Consultas"}
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: "1.6" }}>
            {isClient 
              ? "¿Tenés dudas sobre tu servicio? Podés enviarnos una nueva consulta desde el catálogo o la página de contacto." 
              : "Recordá que los clientes esperan una respuesta en menos de 24hs. Gestioná las solicitudes desde el módulo."}
          </p>
        </section>
      </div>

      <style jsx>{`
        @media (max-width: 991px) {
          .dashboard-grid-4 { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          .dashboard-flex-main { grid-template-columns: 1fr !important; }
          .stat-card-item { padding: 15px !important; border-radius: 8px !important; }
          .card-icon { font-size: 1.4rem !important; }
          .card-value { font-size: 1.5rem !important; }
          .card-label { font-size: 0.6rem !important; margin-top: 10px !important; }
          .card-badge { font-size: 0.55rem !important; padding: 1px 5px !important; }
        }
        @media (max-width: 480px) {
          .grid-2-mobile { grid-template-columns: 1fr !important; }
        }
        .stat-card-item:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.08) !important;
        }
      `}</style>
    </div>
  );
}
