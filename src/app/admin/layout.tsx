"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
          // Only show admin to authorized roles (admin, tecnico, vendedor, etc.)
          if (userData.rol === "cliente") {
             // Redirect clients or just let them see a "Customer panel" (we can handle that later)
             // For now, allow entry but we'll filter content
          }
        }
        setLoading(false);
      }
    });
    return () => unsub();
  }, [pathname, router]);

  if (loading) return <div style={{height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>Cargando Panel...</div>;

  const sidebarLinks = [
    { label: "Panel Principal", href: "/admin", icon: "📊" },
    { label: "Consultas", href: "/admin/consultas", icon: "📧" },
    { label: "Órdenes de Trabajo", href: "/admin/ordenes", icon: "🛠️" },
    { label: "Productos", href: "/admin/productos", icon: "🛒" },
    { label: "Usuarios", href: "/admin/usuarios", icon: "👥" },
    { label: "Configuración", href: "/admin/config", icon: "⚙️" },
  ];

  return (
    <div className="admin-container" style={{ display: "flex", minHeight: "100vh", background: "#f8fafd" }}>
      {/* Sidebar */}
      <aside style={{ width: "260px", background: "var(--primary-blue)", color: "#fff", padding: "30px 20px" }}>
        <div style={{ marginBottom: "40px", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 900, letterSpacing: "1px" }}>ARIFA <span style={{fontSize:'0.8rem', fontWeight:400, opacity:0.8}}>ADMIN</span></h2>
        </div>
        <nav>
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
                      borderRadius: "6px",
                      textDecoration: "none",
                      color: active ? "#fff" : "rgba(255,255,255,0.7)",
                      background: active ? "rgba(255,255,255,0.1)" : "transparent",
                      fontWeight: active ? 700 : 500,
                      transition: "0.2s"
                    }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>{link.icon}</span>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div style={{ marginTop: "100px", padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{ width: "35px", height: "35px", borderRadius: "50%", background: "#fff", display:'flex', alignItems:'center', justifyContent:'center', color:'var(--primary-blue)', fontWeight:700 }}>{user?.email?.charAt(0).toUpperCase()}</div>
            <div style={{ fontSize: "0.85rem" }}>
              <div style={{ fontWeight: 700 }}>{user?.email?.split('@')[0]}</div>
              <div style={{ opacity: 0.6, fontSize: "0.75rem", textTransform: "capitalize" }}>{role}</div>
            </div>
          </div>
          <button 
            onClick={() => auth.signOut().then(() => router.push("/"))}
            style={{ width: "100%", padding: "10px", borderRadius: "4px", background: "rgba(211, 47, 47, 0.2)", color: "#ff8a80", border: "1px solid rgba(211, 47, 47, 0.4)", cursor: "pointer", fontWeight: 700 }}
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "40px", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
