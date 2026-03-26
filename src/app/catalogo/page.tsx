import type { Metadata } from "next";
import Link from "next/link";
import {
  CATEGORIAS_PLACEHOLDER,
  getProductosDestacados,
} from "@/lib/productos";

export const metadata: Metadata = {
  title: "Catálogo de Productos | ARIFA",
  description:
    "Catálogo online de productos de seguridad contra incendios: matafuegos, detectores de humo, señalización, rociadores, mangueras y más. ARIFA – Córdoba.",
};

export default function CatalogoPage() {
  const destacados = getProductosDestacados();

  return (
    <>
      <div className="page-banner" style={{ background: "linear-gradient(rgba(0,10,30,0.8), rgba(0,10,30,0.8)), url('/banner_catalogo.png') center/cover no-repeat" }}>
        <div className="container">
          <h1>Catálogo de Productos</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Catálogo</span>
          </div>
        </div>
      </div>

      <section style={{ background: "var(--primary-blue)", padding: "28px 0" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <div style={{ color: "#fff", flex: "1", minWidth: "300px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: "4px" }}>
              Matafuegos · Detectores · Señalización · Rociadores · EPP y más
            </h2>
            <div style={{ position: "relative", marginTop: "12px", maxWidth: "450px" }}>
              <input
                type="text"
                placeholder="Buscar productos (ej: extintor, casco)..."
                disabled
                style={{ width: "100%", padding: "12px 18px", borderRadius: "50px", border: "none", fontSize: "0.9rem", color: "var(--primary-blue)", background: "rgba(255,255,255,0.9)" }}
              />
              <span style={{ position: "absolute", right: "15px", top: "50%", transform: "translateY(-50%)", color: "var(--primary-blue)", fontSize: "1.2rem", fontWeight: 700, opacity: 0.5 }}>🔍</span>
            </div>
          </div>
          <Link href="/contacto" className="btn-red" style={{ flexShrink: 0 }}>
            Solicitar Cotización
          </Link>
        </div>
      </section>

      {/* Categorías */}
      <section className="section-padding bg-gray">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Categorías</h2>
            <div className="section-line"></div>
            <p style={{ marginTop: "12px" }}>
              Seleccioná una categoría para ver todos los productos disponibles.
            </p>
          </div>

          <div className="cat-grid">
            {CATEGORIAS_PLACEHOLDER.map((cat) => (
              <Link
                key={cat.id}
                href={`/catalogo/${cat.slug}`}
                className="cat-card"
                style={{
                  position: "relative",
                  color: cat.imagen ? "#fff" : "inherit",
                  overflow: "hidden",
                  padding: "0"
                }}
              >
                {cat.imagen && (
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.85)), url(${cat.imagen}) center/cover no-repeat`,
                    transition: "transform 0.4s",
                    zIndex: 0
                  }} className="cat-bg-image" />
                )}
                <div style={{ position: "relative", zIndex: 1, padding: "35px 25px" }}>
                  <div className="cat-icon" style={{ fontSize: "3.5rem", marginBottom: "15px", filter: cat.imagen ? "drop-shadow(2px 2px 5px rgba(0,0,0,0.5))" : "none" }}>{cat.icono}</div>
                  <h3 style={{ color: cat.imagen ? "#fff" : "var(--primary-blue)", textShadow: cat.imagen ? "1px 1px 10px rgba(0,0,0,0.8)" : "none" }}>{cat.nombre}</h3>
                  <p style={{ color: cat.imagen ? "rgba(255,255,255,0.9)" : "var(--text-muted)" }}>{cat.descripcion}</p>
                  <span className="cat-link" style={{ color: cat.imagen ? "#fff" : "var(--primary-red)" }}>Explorar más →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Productos Destacados */}
      {destacados.length > 0 && (
        <section className="section-padding">
          <div className="container">
            <div className="section-title-wrap">
              <h2>Productos Destacados</h2>
              <div className="section-line"></div>
            </div>

            <div className="prod-grid">
              {destacados.map((prod) => {
                const cat = CATEGORIAS_PLACEHOLDER.find(
                  (c) => c.id === prod.categoriaId
                );
                return (
                  <Link
                    key={prod.id}
                    href={`/catalogo/producto/${prod.slug}`}
                    className="prod-card"
                  >
                    <div className="prod-img-wrap">
                      {prod.imagenes[0] || cat?.imagen ? (
                        <img src={prod.imagenes[0] || cat?.imagen} alt={prod.nombre} />
                      ) : (
                        <div className="prod-img-placeholder">{cat?.icono || "📦"}</div>
                      )}
                      {prod.destacado && (
                        <span className="prod-badge">Destacado</span>
                      )}
                    </div>
                    <div className="prod-body">
                      <div className="prod-cat">{cat?.nombre}</div>
                      <h3>{prod.nombre}</h3>
                      <p>{prod.descripcionCorta}</p>
                      <span className="prod-cta">Ver producto →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA Empresas */}
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
