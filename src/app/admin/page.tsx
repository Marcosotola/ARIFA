"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, getDocs, where, doc, getDoc, orderBy, limit } from "firebase/firestore";
import Link from "next/link";

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [stats, setStats] = useState({ unread: 0, ordenes: 0, certificados: 0, productos: 0, usuarios: 0, notificaciones: 0, matafuegos: 0 });
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
        const [unreadSnap, otSnap, certSnap, prodSnap, userSnap, notifSnap, remSnap, mantSnap] = await Promise.all([
          getDocs(query(collection(db, "consultas"), where("estado", "==", "nueva"))),
          getDocs(query(collection(db, "ordenes_trabajo"), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, "certificados"), orderBy("createdAt", "desc"))),
          getDocs(collection(db, "productos")),
          getDocs(collection(db, "usuarios")),
          getDocs(query(collection(db, "notificaciones_enviadas"), orderBy("creadaEn", "desc"), limit(100))),
          getDocs(collection(db, "remitos_matafuegos")),
          getDocs(collection(db, "mantenimiento_matafuegos"))
        ]);
        
        setStats({
          unread: unreadSnap.size,
          ordenes: otSnap.size,
          certificados: certSnap.size,
          productos: prodSnap.size,
          usuarios: userSnap.size,
          notificaciones: notifSnap.size,
          matafuegos: remSnap.size + mantSnap.size
        });
      } else {
        // Stats para clientes
        const [myConsSnap, myOrdSnap, myRemSnap, myMantSnap] = await Promise.all([
          getDocs(query(collection(db, "consultas"), where("email", "==", email))),
          getDocs(query(collection(db, "ordenes_trabajo"), where("clienteId", "==", uid))),
          getDocs(query(collection(db, "remitos_matafuegos"), where("clienteId", "==", uid))),
          getDocs(query(collection(db, "mantenimiento_matafuegos"), where("clienteId", "==", uid)))
        ]);

        setStats({
          unread: myConsSnap.size,
          ordenes: myOrdSnap.size,
          certificados: 0,
          productos: 0,
          usuarios: 0,
          notificaciones: 0,
          matafuegos: myRemSnap.size + myMantSnap.size
        });
      }
    } catch (e) {
      console.error("Error fetching stats:", e);
    } finally {
      setLoading(false);
    }
  };

  const isClient = role === "cliente";
  const isStaff = role === "admin" || role === "tecnico";

  const statCards = isClient ? [
    { label: "Mis Consultas", value: stats.unread, color: "var(--primary-red)", icon: "📧", href: "/admin/consultas" },
    { label: "Mis Planillas", value: stats.ordenes + stats.certificados + stats.matafuegos, color: "var(--primary-blue)", icon: "📋", href: "/admin/planillas" },
  ] : [
    { label: "Consultas", value: stats.unread, color: "var(--primary-red)", icon: "📧", href: "/admin/consultas" },
    { label: "Total Planillas", value: stats.ordenes + stats.certificados + stats.matafuegos, color: "#2b6cb0", icon: "📋", href: "/admin/planillas" },
    { label: "Productos", value: stats.productos, color: "#FF9800", icon: "🛒", href: "/admin/productos" },
    { label: "Usuarios", value: stats.usuarios, color: "#9C27B0", icon: "👥", href: "/admin/usuarios" },
    { label: "Notificaciones", value: stats.notificaciones, color: "#0891b2", icon: "🔔", href: "/admin/notificaciones" },
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

      <div className="dashboard-grid-4" style={{ 
        display: "grid", 
        gridTemplateColumns: isClient ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(180px, 1fr))", 
        gap: "20px", 
        marginBottom: "40px",
        maxWidth: "100%" 
      }}>
        {statCards.map((card, i) => (
          <Link key={i} href={card.href} style={{ 
            background: "#fff", 
            padding: "25px", 
            borderRadius: "15px", 
            boxShadow: "0 4px 15px rgba(0,0,0,0.05)", 
            textDecoration: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            border: "1px solid #eee",
            transition: "transform 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-5px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <div style={{ fontSize: "2rem", marginBottom: "15px" }}>{card.icon}</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#999", textTransform: "uppercase", marginTop: "5px" }}>{card.label}</div>
          </Link>
        ))}
      </div>

      {/* ACCESOS RAPIDOS */}
      <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "20px", color: "var(--primary-blue)" }}>Accesos Directos</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        <Link href="/admin/planillas" style={{ background: "linear-gradient(135deg, #0f172a 0%, #334155 100%)", padding: "20px", borderRadius: "12px", color: "#fff", textDecoration: "none", display: "block" }}>
          <div style={{ fontWeight: 800, marginBottom: "5px" }}>📦 Gestor de Planillas</div>
          <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>Detección, Extinción y Matafuegos.</div>
        </Link>
        {isStaff && (
          <Link href="/admin/productos" style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #ddd", color: "#334155", textDecoration: "none", display: "block" }}>
            <div style={{ fontWeight: 800, marginBottom: "5px" }}>🛒 Catálogo de Venta</div>
            <div style={{ fontSize: "0.85rem", opacity: 0.6 }}>Gestión de extintores y accesorios.</div>
          </Link>
        )}
      </div>
    </div>
  );
}
