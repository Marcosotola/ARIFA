"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, getDocs, where, doc, getDoc, orderBy, limit } from "firebase/firestore";
import Link from "next/link";
import { 
  Mail, 
  ClipboardList, 
  Flame, 
  FileCheck, 
  TrendingUp, 
  HardHat, 
  ShoppingCart, 
  Users, 
  Bell,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  Sparkles,
  ShieldCheck
} from "lucide-react";

// ─── Module definitions ───────────────────────────────────────────────────────
// Each module card: icon, label, description, href, color, roles that can see it
const MODULES = [
  {
    icon: <Mail size={24} />,
    label: "Consultas",
    description: "Mensajes entrantes y seguimiento de clientes.",
    href: "/admin/consultas",
    color: "#A31F1D",
    roles: ["admin", "superadmin", "secretaria"],
    showBadge: true,
  },
  {
    icon: <ClipboardList size={24} />,
    label: "OT",
    description: "Inspecciones en campo, checklists de detección, extinción y registros fotográficos.",
    href: "/admin/planillas",
    color: "#2b6cb0",
    roles: ["admin", "tecnico", "superadmin", "secretaria", "cliente"],
    clientLabel: "Mis Órdenes",
    clientDescription: "Órdenes de trabajo e inspecciones de tus instalaciones.",
  },
  {
    icon: <Flame size={24} />,
    label: "Matafuegos",
    description: "Gestión de remitos de logística y fichas técnicas de taller.",
    href: "/admin/planillas/matafuegos",
    color: "#c2410c",
    roles: ["admin", "tecnico", "superadmin", "cliente", "secretaria"],
    clientLabel: "Mis Matafuegos",
    clientDescription: "Estado de mantenimiento y remitos de tus extintores.",
  },
  {
    icon: <FileCheck size={24} />,
    label: "Certificados",
    description: "Emisión y gestión de certificados de instalación.",
    href: "/admin/certificados",
    color: "#0369a1",
    roles: ["admin", "superadmin", "cliente"],
    clientLabel: "Mis Certificados",
    clientDescription: "Certificados de tus instalaciones.",
  },
  {
    icon: <TrendingUp size={24} />,
    label: "Plan de Acción",
    description: "Seguimiento de mejoras, prioridades y costos por consorcio.",
    href: "/admin/plan-accion",
    color: "#6b46c1",
    roles: ["admin", "superadmin", "secretaria", "cliente"],
    clientLabel: "Mi Plan de Acción",
    clientDescription: "Mejoras propuestas y estado de ejecución.",
  },
  {
    icon: <HardHat size={24} />,
    label: "HyS",
    description: "Visitas, capacitaciones, ATS y programas de seguridad.",
    href: "/admin/hys",
    color: "#15803d",
    roles: ["admin", "superadmin", "cliente"],
  },
  {
    icon: <ShoppingCart size={24} />,
    label: "Productos",
    description: "Catálogo de precios y gestión de stock.",
    href: "/admin/productos",
    color: "#b45309",
    roles: ["admin", "superadmin", "tecnico", "secretaria"],
  },
  {
    icon: <Users size={24} />,
    label: "Usuarios",
    description: "Alta, edición y roles de acceso de usuarios.",
    href: "/admin/usuarios",
    color: "#7c3aed",
    roles: ["admin", "superadmin", "secretaria"],
  },
  {
    icon: <Bell size={24} />,
    label: "Notificaciones",
    description: "Alertas y comunicados enviados a clientes.",
    href: "/admin/notificaciones",
    color: "#0891b2",
    roles: ["admin", "superadmin", "secretaria"],
  },
];

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDoc = await getDoc(doc(db, "usuarios", u.uid));
        const roleData = userDoc.exists() ? userDoc.data().rol : "cliente";
        setRole(roleData);

        // Fetch unread consultas count
        try {
          const snap = await getDocs(query(collection(db, "consultas"), where("estado", "==", "nueva")));
          setUnread(snap.size);
        } catch { /* ok */ }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const isClient = role?.toLowerCase() === "cliente";
  const isSuperAdmin = role?.toLowerCase() === "superadmin";
  const isStaff = ["admin", "tecnico", "secretaria", "superadmin"].includes(role?.toLowerCase() || "");

  // Filter modules by role
  const visibleModules = MODULES.filter(m => {
    const currentRole = role?.toLowerCase() || "";
    // Ocultar consultas para clientes (Filtro de seguridad absoluta)
    if (currentRole === "cliente" && (m.label === "Consultas" || m.href.includes("consultas"))) return false;
    return m.roles.some(r => r.toLowerCase() === currentRole);
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  if (loading) return (
    <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
      Sincronizando panel...
    </div>
  );

  return (
    <div style={{ maxWidth: "1350px", margin: "0 auto" }}>
      {/* ── Greeting ── */}
      <header style={{ marginBottom: "40px", display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: "8px", fontWeight: 600 }}>
            <Sparkles size={16} style={{ color: '#f59e0b' }} /> {greeting()}
          </div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 900, color: "var(--primary-blue)", letterSpacing: "-1px", margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user?.email?.split("@")[0]} <span style={{ fontSize: '2rem' }}>👋</span>
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "10px", fontSize: "1rem", display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} style={{ color: 'var(--primary-blue)' }} />
            {isClient
              ? "Panel de Cliente · ARIFA Seguridad"
              : role?.toLowerCase() === "tecnico"
              ? "Panel de Técnico · Gestión de OT y Matafuegos"
              : isStaff
              ? "Panel de Gestión y Operaciones · ARIFA Seguridad"
              : "Acceso al sistema."}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
           <div style={{ padding: '12px 20px', background: '#fff', border: '1.5px solid #eee', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ width: '35px', height: '35px', borderRadius: '8px', background: 'rgba(0,34,68,0.08)', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LayoutDashboard size={20} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Rol Actual</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-blue)', textTransform: 'capitalize' }}>{role}</div>
              </div>
           </div>
        </div>
      </header>

      {/* ── Module Cards ── */}
      <div className="dashboard-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "14px",
      }}>
        {visibleModules.map(m => {
          const label = (isClient && m.clientLabel) ? m.clientLabel : m.label;
          const description = (isClient && m.clientDescription) ? m.clientDescription : m.description;
          const hasBadge = m.showBadge && unread > 0;

          return (
            <Link
              key={m.href}
              href={m.href}
              style={{
                background: "#fff",
                borderRadius: "14px",
                border: "1.5px solid #eee",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                padding: "22px 20px",
                transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget;
                el.style.transform = "translateY(-3px)";
                el.style.boxShadow = "0 10px 30px rgba(0,0,0,0.10)";
                el.style.borderColor = m.color;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget;
                el.style.transform = "";
                el.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)";
                el.style.borderColor = "#eee";
              }}
            >
              {/* Color accent top bar */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                height: "3px", background: m.color, borderRadius: "14px 14px 0 0",
              }} />

              {/* Icon + badge */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "12px",
                  background: `${m.color}15`,
                  color: m.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {m.icon}
                </div>
                {hasBadge && (
                  <span style={{
                    background: "var(--primary-red)", color: "#fff",
                    fontSize: "0.65rem", fontWeight: 900,
                    padding: "3px 8px", borderRadius: "20px",
                    letterSpacing: "0.2px",
                  }}>
                    {unread} nuevo{unread !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Label */}
              <div style={{
                fontWeight: 800, fontSize: "0.95rem",
                color: "var(--primary-blue)", marginBottom: "5px",
                lineHeight: 1.3,
              }}>
                {label}
              </div>

              {/* Description — hidden on very small screens via CSS */}
              <p className="module-desc" style={{
                fontSize: "0.78rem", color: "var(--text-muted)",
                lineHeight: 1.5, margin: 0, flex: 1,
              }}>
                {description}
              </p>


            </Link>
          );
        })}
      </div>

      {/* Mobile responsive styles */}
      <style jsx>{`
        @media (max-width: 600px) {
          .module-desc { display: none !important; }
          .dashboard-grid {
             grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
