"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Module {
  title: string;
  desc: string;
  icon: string;
  count: number | null;
  color: string;
  comingSoon?: boolean;
  links: { label: string; href: string; primary: boolean }[];
}

export default function PlanillasHubPage() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ ots: 0, certs: 0, remitos: 0, maintenance: 0 });
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      const roleData = userDoc.exists() ? userDoc.data().rol : "cliente";
      setRole(roleData);

      try {
        const [otSnap, certSnap, remSnap, mantSnap] = await Promise.all([
          getDocs(collection(db, "ordenes_trabajo")),
          getDocs(collection(db, "certificados")),
          getDocs(collection(db, "remitos_matafuegos")),
          getDocs(collection(db, "mantenimiento_matafuegos"))
        ]);
        setStats({ 
          ots: otSnap.size, 
          certs: certSnap.size, 
          remitos: remSnap.size,
          maintenance: mantSnap.size 
        });
      } catch (e) {
        console.error("Error fetching stats:", e);
      }
      
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) return <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Cargando Gestor de Planillas...</div>;

  const isAdmin = role === "admin";

  const modules: Module[] = [
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
      desc: "Gestión integral de remitos de logística y fichas técnicas de mantenimiento en taller.",
      icon: "🧯",
      count: stats.remitos + stats.maintenance,
      color: "#c53030",
      links: [
        // Orden de links: 0: Ver Remitos, 1: Nuevo Remito, 2: Ver Fichas, 3: Nueva Ficha
        { label: "Ver Remitos", href: "/admin/planillas/matafuegos", primary: false },
        { label: "Nuevo Remito", href: "/admin/planillas/matafuegos/nuevo", primary: true },
        { label: "Ver Fichas", href: "/admin/planillas/matafuegos/mantenimiento", primary: false },
        { label: "Nueva Ficha", href: "/admin/planillas/matafuegos/mantenimiento/nuevo", primary: true },
      ]
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
            border: "1px solid rgba(0,0,0,0.1)",
            position: 'relative'
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ fontSize: "2.5rem" }}>{m.icon}</div>
              {m.count !== null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: m.color }}>{m.count}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase' }}>Registros</div>
                </div>
              )}
            </div>

            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "12px", color: "#1a202c" }}>{m.title}</h3>
            <p className="card-desc" style={{ color: "#4a5568", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "30px", flex: 1 }}>{m.desc}</p>

            <style jsx>{`
              @media (max-width: 768px) {
                .card-desc { display: none; }
                header { margin-bottom: 25px !important; }
                h1 { fontSize: 1.8rem !important; }
              }
            `}</style>

            <div style={{ marginTop: "auto" }}>
              {m.title === "Matafuegos" ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {/* SECCION LOGISTICA */}
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>📦 LOGÍSTICA (REMITOS)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Link href={m.links[0].href} style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>{m.links[0].label}</Link>
                      <Link href={m.links[1].href} style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', background: m.color, color: '#fff' }}>{m.links[1].label}</Link>
                    </div>
                  </div>
                  <div style={{ height: '1px', background: '#f1f5f9' }}></div>
                  {/* SECCION TALLER */}
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>🛠️ TALLER (FICHAS TÉCNICAS)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Link href={m.links[2].href} style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>{m.links[2].label}</Link>
                      <Link href={m.links[3].href} style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', background: '#0f172a', color: '#fff' }}>{m.links[3].label}</Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {m.links.map((link, li) => (
                    <Link key={li} href={link.href} style={{ 
                      textAlign: 'center',
                      padding: '12px',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      background: link.primary ? m.color : '#f8fafc',
                      color: link.primary ? '#fff' : '#64748b',
                      border: link.primary ? 'none' : '1px solid #e2e8f0'
                    }}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
