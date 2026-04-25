"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";

interface Producto {
  id: string;
  titulo: string;
  descripcion?: string;
  categoria?: string;
  proveedor?: string;
  precioVenta?: number;
  activo?: boolean;
}

// Category icons mapping
const CAT_ICONS: Record<string, string> = {
  "Matafuegos": "🧯",
  "Detectores y Alarmas": "🔔",
  "Señalización": "🚨",
  "Rociadores y Sprinklers": "💧",
  "Mangueras y Accesorios": "🔧",
  "Equipos de Protección Personal": "⛑️",
  "Iluminación de Emergencia": "💡",
  "Botiquines y Primeros Auxilios": "🩺",
  "Otro": "📦",
};

const CAT_COLORS: Record<string, string> = {
  "Matafuegos": "#dc2626",
  "Detectores y Alarmas": "#2563eb",
  "Señalización": "#d97706",
  "Rociadores y Sprinklers": "#0891b2",
  "Mangueras y Accesorios": "#7c3aed",
  "Equipos de Protección Personal": "#059669",
  "Iluminación de Emergencia": "#d97706",
  "Botiquines y Primeros Auxilios": "#dc2626",
  "Otro": "#6b7280",
};

export default function CatalogoPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catActiva, setCatActiva] = useState("Todas");

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const q = query(
          collection(db, "productos"),
          where("activo", "==", true),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Producto)));
      } catch (e) {
        console.error("Error fetching productos:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProductos();
  }, []);

  // Derive categories from products
  const categorias = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria || "Otro").filter(Boolean));
    return Array.from(cats).sort();
  }, [productos]);

  const visible = useMemo(() => {
    return productos.filter(p => {
      const matchCat = catActiva === "Todas" || p.categoria === catActiva;
      const q = search.toLowerCase();
      const matchQ = !q || p.titulo.toLowerCase().includes(q) || p.categoria?.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [productos, catActiva, search]);

  const fmtPeso = (n: number) => `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;

  return (
    <>
      {/* ── Banner ── */}
      <div className="page-banner" style={{ background: "linear-gradient(rgba(0,10,30,0.82), rgba(0,10,30,0.82)), url('/banner_catalogo.png') center/cover no-repeat" }}>
        <div className="container">
          <h1>Catálogo de Productos</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Catálogo</span>
          </div>
        </div>
      </div>

      {/* ── Search bar ── */}
      <section style={{ background: "var(--primary-blue)", padding: "28px 0" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <div style={{ color: "#fff", flex: "1", minWidth: "280px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "10px" }}>
              Matafuegos · Detectores · Señalización · EPP y más
            </h2>
            <div style={{ position: "relative", maxWidth: "480px" }}>
              <input
                type="text"
                placeholder="Buscar productos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: "100%", padding: "12px 44px 12px 18px", borderRadius: "50px", border: "none", fontSize: "0.92rem", color: "var(--primary-blue)", background: "rgba(255,255,255,0.95)", boxSizing: "border-box" }}
              />
              <span style={{ position: "absolute", right: "15px", top: "50%", transform: "translateY(-50%)", color: "var(--primary-blue)", opacity: 0.5, fontSize: "1.1rem" }}>🔍</span>
            </div>
          </div>
          <Link href="/contacto" className="btn-red" style={{ flexShrink: 0 }}>
            Solicitar Cotización
          </Link>
        </div>
      </section>

      {/* ── Category filter chips ── */}
      {!loading && categorias.length > 0 && (
        <section style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "16px 0" }}>
          <div className="container">
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
              {["Todas", ...categorias].map(cat => {
                const active = catActiva === cat;
                const color = cat !== "Todas" ? (CAT_COLORS[cat] || "#334155") : "#334155";
                return (
                  <button key={cat} onClick={() => setCatActiva(cat)}
                    style={{
                      padding: "8px 16px", borderRadius: "20px", border: `2px solid ${active ? color : "#e2e8f0"}`,
                      background: active ? color : "#fff", color: active ? "#fff" : "#555",
                      fontWeight: active ? 800 : 500, fontSize: "0.8rem", cursor: "pointer",
                      whiteSpace: "nowrap", flexShrink: 0, transition: "0.2s",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}>
                    {cat !== "Todas" && <span>{CAT_ICONS[cat] || "📦"}</span>}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Products Grid ── */}
      <section className="section-padding" style={{ background: "#fff" }}>
        <div className="container">
          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>⏳</div>
              <p style={{ color: "var(--text-muted)" }}>Cargando catálogo...</p>
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔍</div>
              <h3 style={{ color: "var(--primary-blue)", marginBottom: "8px" }}>
                {search || catActiva !== "Todas" ? "Sin resultados para tu búsqueda" : "Catálogo vacío"}
              </h3>
              <p style={{ color: "var(--text-muted)" }}>
                {search ? `No encontramos productos para "${search}".` : "Volvé pronto, estamos actualizando el catálogo."}
              </p>
              {(search || catActiva !== "Todas") && (
                <button onClick={() => { setSearch(""); setCatActiva("Todas"); }}
                  style={{ marginTop: "20px", padding: "10px 22px", borderRadius: "8px", border: "none", background: "var(--primary-blue)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  Ver todos los productos
                </button>
              )}
            </div>
          ) : (
            <>
              <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "0.9rem" }}>
                Mostrando {visible.length} producto{visible.length !== 1 ? "s" : ""}
                {catActiva !== "Todas" ? ` en "${catActiva}"` : ""}
                {search ? ` para "${search}"` : ""}
              </p>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "24px",
              }}>
                {visible.map(p => {
                  const color = CAT_COLORS[p.categoria || "Otro"] || "#334155";
                  const icon = CAT_ICONS[p.categoria || "Otro"] || "📦";
                  return (
                    <div key={p.id} style={{
                      background: "#fff",
                      borderRadius: "16px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                      overflow: "hidden",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      display: "flex",
                      flexDirection: "column",
                    }}
                      onMouseEnter={e => { (e.currentTarget as any).style.transform = "translateY(-4px)"; (e.currentTarget as any).style.boxShadow = "0 12px 36px rgba(0,0,0,0.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as any).style.transform = ""; (e.currentTarget as any).style.boxShadow = "0 4px 20px rgba(0,0,0,0.05)"; }}>
                      {/* Image placeholder */}
                      <div style={{
                        background: `linear-gradient(135deg, ${color}15, ${color}25)`,
                        height: "160px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: "4rem" }}>{icon}</span>
                        {p.categoria && (
                          <span style={{
                            position: "absolute", top: "12px", left: "12px",
                            background: color, color: "#fff",
                            fontSize: "0.65rem", fontWeight: 800,
                            padding: "3px 9px", borderRadius: "20px", letterSpacing: "0.3px",
                            textTransform: "uppercase",
                          }}>
                            {p.categoria}
                          </span>
                        )}
                      </div>
                      {/* Body */}
                      <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <h3 style={{ fontSize: "0.98rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "8px", lineHeight: 1.3 }}>{p.titulo}</h3>
                        {p.descripcion && (
                          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "14px", flex: 1,
                            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}>
                            {p.descripcion}
                          </p>
                        )}
                        {/* Price */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "12px", borderTop: "1px solid #f0f0f0" }}>
                          {p.precioVenta ? (
                            <div>
                              <div style={{ fontSize: "0.65rem", color: "#aaa", fontWeight: 600, textTransform: "uppercase" }}>Precio</div>
                              <div style={{ fontSize: "1.2rem", fontWeight: 900, color: color }}>{fmtPeso(p.precioVenta)}</div>
                            </div>
                          ) : (
                            <div style={{ fontSize: "0.82rem", color: "#aaa", fontStyle: "italic" }}>Consultar precio</div>
                          )}
                          <Link href="/contacto"
                            style={{
                              background: color, color: "#fff", fontSize: "0.72rem", fontWeight: 800,
                              padding: "8px 14px", borderRadius: "8px", textDecoration: "none",
                              transition: "opacity 0.2s",
                            }}
                            onMouseEnter={e => (e.currentTarget as any).style.opacity = "0.85"}
                            onMouseLeave={e => (e.currentTarget as any).style.opacity = "1"}>
                            Consultar →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── CTA Empresas ── */}
      <section className="section-padding bg-gray">
        <div className="container" style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🏢</div>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--primary-blue)", marginBottom: "12px" }}>
            Beneficios exclusivos para empresas
          </h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "25px", lineHeight: 1.8 }}>
            Contactate con nuestro equipo para recibir asesoramiento personalizado,
            precios especiales por volumen y condiciones exclusivas para empresas e industrias.
          </p>
          <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/contacto" className="btn-red">Consultar ahora</Link>
            <a href="https://wa.me/5493512449504" target="_blank" rel="noopener noreferrer" className="btn-blue">
              WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
