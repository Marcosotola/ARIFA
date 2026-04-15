"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PlanillasHubPage() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ ots: 0, certs: 0 });
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      const roleData = userDoc.exists() ? userDoc.data().rol : "cliente";
      setRole(roleData);

      // Fetch specific counts for the hub (consistent with list filtering)
      const [otSnap, certSnap] = await Promise.all([
        getDocs(query(collection(db, "ordenes_trabajo"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "certificados"), orderBy("createdAt", "desc")))
      ]);
      setStats({ ots: otSnap.size, certs: certSnap.size });
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) return <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Cargando Gestor de Planillas...</div>;

  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "tecnico";

  const modules = [
    {
      title: "Órdenes de Trabajo",
      desc: "Gestión de inspecciones en campo, checklists de detección, extinción y registros fotográficos.",
      icon: "📋",
      count: stats.ots,
      color: "#2b6cb0",
      links: [
        { label: "Ver Listado", href: "/admin/planillas/deteccion", primary: false },
        { label: "Nueva OT", href: "/admin/planillas/deteccion/nueva", primary: true },
      ]
    },
    {
      title: "Certificaciones",
      desc: "Certificados de instalación y mantenimiento con carácter de Declaración Jurada para clientes.",
      icon: "📜",
      count: stats.certs,
      color: "#2e7d32",
      links: [
        { label: "Ver Listado", href: "/admin/certificados", primary: false },
        { label: "Nuevo Certificado", href: "/admin/certificados/nuevo", primary: true },
      ]
    },
    {
      title: "Matafuegos",
      desc: "Control de carga, vencimientos y mantenimiento preventivo de extintores portátiles.",
      icon: "🧯",
      count: null,
      color: "#c53030",
      comingSoon: true,
      links: []
    },
  ];

  if (isAdmin) {
    modules.push({
      title: "Gestor de Plantillas",
      desc: "Configuración de la estructura de las planillas, grupos de ítems y lógicas de validación.",
      icon: "🗂️",
      count: null,
      color: "#4a5568",
      links: [
        { label: "Administrar Plantillas", href: "/admin/templates", primary: true },
      ]
    });
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <header style={{ marginBottom: "40px" }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
          <span style={{ background: '#ebf4ff', color:'#2b6cb0', padding:'4px 12px', borderRadius:'20px', fontSize:'0.75rem', fontWeight:800, textTransform:'uppercase' }}>Módulo de Servicio</span>
        </div>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 900, color: "var(--primary-blue)" }}>Gestión de Planillas</h1>
        <p style={{ color: "var(--text-muted)", marginTop: "8px", fontSize: "1.05rem", maxWidth: '700px' }}>
          Centralizá todas las inspecciones, certificados y mantenimiento preventivo desde este panel operativo.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "25px" }}>
        {modules.map((m, i) => (
          <div key={i} style={{ 
            background: "#fff", 
            borderRadius: "16px", 
            padding: "30px", 
            boxShadow: "0 10px 30px rgba(0,0,0,0.05)", 
            display: "flex", 
            flexDirection: "column",
            border: "1px solid rgba(0,0,0,0.05)",
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Background Accent */}
            <div style={{ position:'absolute', top:0, right:0, width:'100px', height:'100px', background: `${m.color}08`, borderRadius: '0 0 0 100%', zIndex: 0 }}></div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", position:'relative', zIndex: 1 }}>
              <div style={{ fontSize: "2.5rem" }}>{m.icon}</div>
              {m.count !== null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: m.color }}>{m.count}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase' }}>Registros</div>
                </div>
              )}
              {m.comingSoon && (
                <span style={{ background: '#fff5f5', color: '#c53030', fontSize: '0.65rem', fontWeight: 800, padding: '4px 10px', borderRadius: '10px', textTransform: 'uppercase', border: '1px solid #feb2b2' }}>Próximamente</span>
              )}
            </div>

            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "12px", color: "#1a202c", position:'relative', zIndex: 1 }}>{m.title}</h3>
            <p style={{ color: "#4a5568", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "30px", flex: 1, position:'relative', zIndex: 1 }}>{m.desc}</p>

            <div style={{ display: "flex", gap: "10px", marginTop: "auto", position:'relative', zIndex: 1 }}>
              {m.links.map((link, li) => (
                <Link key={li} href={link.href} style={{ 
                  flex: 1,
                  textAlign: 'center',
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  transition: '0.2s',
                  background: link.primary ? m.color : '#f7fafc',
                  color: link.primary ? '#fff' : '#4a5568',
                  border: link.primary ? 'none' : '1px solid #edf2f7'
                }}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Footer Info */}
      <footer style={{ marginTop: '60px', padding: '30px', background: '#f8fafc', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ fontSize: '2rem' }}>💡</div>
        <div>
          <h4 style={{ fontWeight: 800, color: '#2d3748', marginBottom: '4px' }}>¿Necesitás una nueva plantilla?</h4>
          <p style={{ fontSize: '0.9rem', color: '#718096' }}>Si un servicio requiere un formato de planilla diferente, podés solicitarlo a administración o crearlo en el Gestor de Plantillas.</p>
        </div>
      </footer>
    </div>
  );
}
