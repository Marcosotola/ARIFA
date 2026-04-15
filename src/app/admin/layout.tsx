"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        if (!["/login", "/register"].includes(pathname)) {
          router.push("/login");
        }
        setLoading(false);
      } else {
        setUser(u);
        const userDoc = await getDoc(doc(db, "usuarios", u.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setRole(userData.rol);
        }
        
        // Fetch unread count
        const q = query(collection(db, "consultas"), where("estado", "==", "nueva"));
        const snapshot = await getDocs(q);
        setUnreadCount(snapshot.size);
        
        setLoading(false);
      }
    });
    return () => unsub();
  }, [pathname, router]);

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) return <div style={{height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontStyle:'italic', color:'var(--text-muted)'}}>Cargando Panel ARIFA...</div>;

  const isClient = role === "cliente";
  const isAdmin = role === "admin";
  const isTecnico = role === "tecnico";
  const sidebarLinks = [
    { label: "Mi Panel", href: "/admin", icon: "📊" },
    { label: isClient ? "Mis Consultas" : "Consultas", href: "/admin/consultas", icon: "📧", badge: !isClient && unreadCount > 0 ? unreadCount : null },
  ];

  if (isAdmin || isTecnico) {
    sidebarLinks.push({ label: "Productos", href: "/admin/productos", icon: "🛒" });
  }

  if (isAdmin) {
    sidebarLinks.push({ label: "Usuarios", href: "/admin/usuarios", icon: "👥" });
  }

  // Planillas as a top-level item now
  sidebarLinks.push({ label: "Planillas", href: "/admin/planillas", icon: "📋" });

  const configLink = { label: "Configuración", href: "/admin/config", icon: "⚙️" };


  return (
    <div className="admin-layout" style={{ display: "flex", minHeight: "100vh", background: "#f0f2f5", position: 'relative' }}>
      
      {/* Mobile Header */}
      <div style={{ 
        display: 'none', 
        position: 'fixed', 
        top: 0, left: 0, right: 0, 
        height: '60px', 
        background: 'var(--primary-blue)', 
        zIndex: 100, 
        alignItems: 'center', 
        padding: '0 20px',
        color: '#fff',
        justifyContent: 'space-between'
      }} className="mobile-admin-header">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>ARIFA ADMIN</div>
        <div style={{ width: '40px' }}></div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.5)', 
            zIndex: 150 
          }} 
        />
      )}

      {/* Sidebar */}
      <aside 
        style={{ 
          width: "260px", 
          background: "var(--primary-blue)", 
          color: "#fff", 
          padding: "30px 20px",
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.3s ease',
          zIndex: 200,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto'
        }} 
        className={`admin-aside ${sidebarOpen ? 'open' : ''}`}
      >
        <div style={{ marginBottom: "40px", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 900, letterSpacing: "1px" }}>ARIFA <span style={{fontSize:'0.7rem', fontWeight:400, opacity:0.6}}>ADMIN</span></h2>
        </div>
        
        <nav style={{ flex: 1 }}>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {sidebarLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href} style={{ marginBottom: "8px" }}>
                  <Link 
                    href={link.href} 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "12px", 
                      padding: "12px 15px", 
                      borderRadius: "8px",
                      textDecoration: "none",
                      color: active ? "#fff" : "rgba(255,255,255,0.7)",
                      background: active ? "rgba(255,255,255,0.15)" : "transparent",
                      fontWeight: active ? 700 : 500,
                      transition: "0.2s"
                    }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>{link.icon}</span>
                    <span style={{ flex: 1 }}>{link.label}</span>
                    {link.badge && (
                      <span style={{ 
                        background: 'var(--primary-red)', 
                        color: '#fff', 
                        fontSize: '0.7rem', 
                        padding: '2px 8px', 
                        borderRadius: '10px',
                        fontWeight: 800
                      }}>
                        {link.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}

            {/* Configuración - Final item in list */}
            <li style={{ marginBottom: "8px" }}>
              <Link 
                href={configLink.href} 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px", 
                  padding: "12px 15px", 
                  borderRadius: "8px",
                  textDecoration: "none",
                  color: pathname === configLink.href ? "#fff" : "rgba(255,255,255,0.7)",
                  background: pathname === configLink.href ? "rgba(255,255,255,0.15)" : "transparent",
                  fontWeight: pathname === configLink.href ? 700 : 500,
                  transition: "0.2s"
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>{configLink.icon}</span>
                <span style={{ flex: 1 }}>{configLink.label}</span>
              </Link>
            </li>
          </ul>
        </nav>
        
        <div style={{ marginTop: "auto", padding: "20px 0 40px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{ 
              width: "38px", 
              height: "38px", 
              borderRadius: "50%", 
              background: "#fff", 
              display:'flex', 
              alignItems:'center', 
              justifyContent:'center', 
              color:'var(--primary-blue)', 
              fontWeight:800,
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
            }}>{user?.email?.charAt(0).toUpperCase()}</div>
            <div style={{ fontSize: "0.85rem" }}>
              <div style={{ fontWeight: 700 }}>{user?.email?.split('@')[0]}</div>
              <div style={{ opacity: 0.6, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: '0.5px' }}>{role}</div>
            </div>
          </div>

          <Link href="/" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            padding: '12px 15px', 
            color: '#fff', 
            fontSize: '0.9rem', 
            fontWeight: 700,
            textDecoration: 'none',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
            marginBottom: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
            transition: 'background 0.2s'
          }} className="return-site-btn">
            <span>🌐</span> Volver al Sitio
          </Link>

          <button 
            onClick={() => auth.signOut().then(() => router.push("/"))}
            style={{ 
              width: "100%", 
              padding: "12px", 
              borderRadius: "6px", 
              background: "rgba(211, 47, 47, 0.15)", 
              color: "#ff8a80", 
              border: "1px solid rgba(211, 47, 47, 0.3)", 
              cursor: "pointer", 
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>🚪</span> Cerrar Sesión
          </button>
        </div>
      </aside>

      <style jsx>{`
        .return-site-btn:hover {
          background: rgba(255,255,255,0.15) !important;
        }
      `}</style>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "40px", width: '100%' }} className="admin-main">
        {children}
      </main>

      <style jsx global>{`
        @media (max-width: 991px) {
          .mobile-admin-header { display: flex !important; }
          .admin-aside {
            position: fixed !important;
            top: 60px !important;
            left: 0 !important;
            height: calc(100vh - 60px) !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            transform: translateX(-100%);
            padding-bottom: 30px !important;
          }
          .admin-aside.open {
            transform: translateX(0);
          }
          .admin-main {
            padding: 80px 20px 40px !important;
          }
        }
      `}</style>
    </div>
  );
}
