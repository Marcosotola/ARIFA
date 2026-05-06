"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, ChevronRight, Package } from "lucide-react";

export default function DocumentosPage() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      const r = userDoc.exists() ? userDoc.data().rol : null;
      if (r === "tecnico") { router.push("/admin"); return; }
      setRole(r);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) return (
    <div style={{ padding: "100px", textAlign: "center", color: "var(--text-muted)" }}>Cargando...</div>
  );

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <header style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>
          Documentos
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
          Gestión de documentos comerciales y administrativos.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
        {[
          {
            href: "/admin/documentos/presupuestos",
            icon: <FileText size={26} color="#0d9488" strokeWidth={2} />,
            iconBg: "rgba(13,149,136,0.1)",
            title: "Presupuestos",
            desc: "Cotizaciones para clientes",
            hoverShadow: "0 8px 30px rgba(13,149,136,0.12)",
          },
          {
            href: "/admin/documentos/recibos",
            icon: <FileText size={26} color="#7c3aed" strokeWidth={2} />,
            iconBg: "rgba(124,58,237,0.1)",
            title: "Recibos",
            desc: "Comprobantes de cobro",
            hoverShadow: "0 8px 30px rgba(124,58,237,0.12)",
          },
          {
            href: "/admin/documentos/remitos",
            icon: <Package size={26} color="#ea580c" strokeWidth={2} />,
            iconBg: "rgba(234,88,12,0.1)",
            title: "Remitos",
            desc: "Entrega de materiales y equipos",
            hoverShadow: "0 8px 30px rgba(234,88,12,0.12)",
          },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                padding: "28px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                border: "1px solid #eee",
                cursor: "pointer",
                transition: "transform 0.15s, box-shadow 0.15s",
                display: "flex",
                alignItems: "center",
                gap: "18px",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = item.hoverShadow;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)";
              }}
            >
              <div style={{
                width: "52px", height: "52px", borderRadius: "14px",
                background: item.iconBg, display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary-blue)", marginBottom: "4px" }}>
                  {item.title}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#888" }}>
                  {item.desc}
                </div>
              </div>
              <ChevronRight size={18} color="#ccc" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
