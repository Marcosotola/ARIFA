"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, getDocs, where, doc, getDoc, orderBy, limit } from "firebase/firestore";
import Link from "next/link";

// ─── Module definitions ───────────────────────────────────────────────────────
// Each module card: icon, label, description, href, color, roles that can see it
const MODULES = [
  {
    icon: "📧",
    label: "Consultas",
    description: "Mensajes entrantes y seguimiento de clientes.",
    href: "/admin/consultas",
    color: "#A31F1D",
    roles: ["admin", "tecnico", "superadmin", "secretaria", "cliente"],
    clientLabel: "Mis Consultas",
    clientDescription: "Tus consultas enviadas y su estado.",
    showBadge: true,
  },
  {
    icon: "📋",
    label: "OT",
    description: "Inspecciones en campo, checklists de detección, extinción y registros fotográficos.",
    href: "/admin/planillas",
    color: "#2b6cb0",
    roles: ["admin", "tecnico", "superadmin", "secretaria", "cliente"],
    clientLabel: "Mis Órdenes",
    clientDescription: "Órdenes de trabajo e inspecciones de tus instalaciones.",
  },
  {
    icon: "🧯",
    label: "Matafuegos",
    description: "Gestión de remitos de logística y fichas técnicas de taller.",
    href: "/admin/planillas/matafuegos",
    color: "#c2410c",
    roles: ["admin", "tecnico", "superadmin"],
  },
  {
    icon: "📜",
    label: "Certificados",
    description: "Emisión y gestión de certificados de instalación.",
    href: "/admin/certificados",
    color: "#0369a1",
    roles: ["admin", "tecnico", "superadmin"],
  },
  {
    icon: "🦺",
    label: "HyS",
    description: "Visitas, capacitaciones, ATS y programas de seguridad.",
    href: "/admin/hys",
    color: "#15803d",
    roles: ["admin", "tecnico", "superadmin"],
  },
  {
    icon: "🛒",
    label: "Productos",
    description: "Catálogo de precios y gestión de stock.",
    href: "/admin/productos",
    color: "#b45309",
    roles: ["admin", "tecnico", "superadmin"],
  },
  {
    icon: "👥",
    label: "Usuarios",
    description: "Alta, edición y roles de acceso de usuarios.",
    href: "/admin/usuarios",
    color: "#7c3aed",
    roles: ["admin", "superadmin"],
  },
  {
    icon: "🔔",
    label: "Notificaciones",
    description: "Alertas y comunicados enviados a clientes.",
    href: "/admin/notificaciones",
    color: "#0891b2",
    roles: ["admin", "tecnico", "superadmin"],
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

  const isClient = role === "cliente";
  const isSuperAdmin = role === "superadmin";
  const isStaff = role === "admin" || role === "tecnico" || role === "secretaria" || isSuperAdmin;

  // Filter modules by role
  const visibleModules = MODULES.filter(m => role && m.roles.includes(role));

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
    <div style={{ maxWidth: "1100px" }}>
      {/* ── Greeting ── */}
      <header style={{ marginBottom: "36px" }}>
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "4px" }}>
          {greeting()},
        </p>
        <h1 style={{ fontSize: "1.9rem", fontWeight: 900, color: "var(--primary-blue)", letterSpacing: "-0.3px" }}>
          {user?.email?.split("@")[0]} 👋
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "6px", fontSize: "0.88rem" }}>
          {isClient
            ? "Bienvenido a tu panel de cliente ARIFA."
            : isStaff
            ? "Panel de Gestión y Operaciones · ARIFA Seguridad"
            : "Acceso al sistema."}
        </p>
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
                  width: "46px", height: "46px", borderRadius: "12px",
                  background: `${m.color}15`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.4rem", flexShrink: 0,
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
