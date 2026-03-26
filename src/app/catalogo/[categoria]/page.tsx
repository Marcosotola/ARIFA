import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CATEGORIAS_PLACEHOLDER,
  getCategoriaBySlug,
  getProductosByCategoria,
} from "@/lib/productos";

type Props = { params: { categoria: string } };

export async function generateStaticParams() {
  return CATEGORIAS_PLACEHOLDER.map((c) => ({ categoria: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categoria: slug } = await params;
  const cat = getCategoriaBySlug(slug);
  if (!cat) return { title: "Categoría | ARIFA" };
  return {
    title: `${cat.nombre} | Catálogo ARIFA`,
    description: cat.descripcion,
  };
}

export default async function CategoriaPage({ params }: Props) {
  const { categoria: slug } = await params;
  const cat = getCategoriaBySlug(slug);
  if (!cat) notFound();

  const productos = getProductosByCategoria(cat.id);

  return (
    <>
      <div className="page-banner">
        <div className="container">
          <h1>{cat.nombre}</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href="/catalogo">Catálogo</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{cat.nombre}</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "40px", alignItems: "start" }}>
            {/* Sidebar categorías */}
            <aside>
              <div className="service-sidebar">
                <h3>Categorías</h3>
                <ul className="sidebar-link-list">
                  {CATEGORIAS_PLACEHOLDER.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/catalogo/${c.slug}`}
                        style={c.slug === slug ? { color: "var(--primary-red)", fontWeight: 700 } : undefined}
                      >
                        <span style={{ marginRight: "6px" }}>{c.icono}</span>
                        {c.nombre}
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* CTA sidebar */}
                <div style={{ marginTop: "22px", background: "var(--primary-red)", padding: "20px", borderRadius: "4px", color: "#fff", textAlign: "center" }}>
                  <p style={{ fontWeight: 700, marginBottom: "8px", fontSize: "0.95rem" }}>¿Necesitás asesoramiento?</p>
                  <a
                    href="https://wa.me/5493512449504"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-block", background: "#25D366", color: "#fff", padding: "8px 16px", borderRadius: "4px", fontSize: "0.85rem", fontWeight: 700 }}
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </aside>

            {/* Productos */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "2rem", marginBottom: "4px" }}>{cat.icono}</div>
                  <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--primary-blue)" }}>{cat.nombre}</h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "4px" }}>{cat.descripcion}</p>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  {productos.length} producto{productos.length !== 1 ? "s" : ""}
                </div>
              </div>

              {productos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-light)", borderRadius: "4px" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📦</div>
                  <h3 style={{ color: "var(--primary-blue)", marginBottom: "8px" }}>Próximamente</h3>
                  <p style={{ color: "var(--text-muted)" }}>Estamos cargando los productos de esta categoría. Consultanos directamente.</p>
                  <Link href="/contacto" className="btn-red" style={{ marginTop: "20px", display: "inline-block" }}>
                    Consultar
                  </Link>
                </div>
              ) : (
                <div className="prod-grid">
                  {productos.map((prod) => (
                    <Link
                      key={prod.id}
                      href={`/catalogo/producto/${prod.slug}`}
                      className="prod-card"
                    >
                      <div className="prod-img-wrap">
                        {prod.imagenes[0] || cat.imagen ? (
                          <img src={prod.imagenes[0] || cat.imagen} alt={prod.nombre} />
                        ) : (
                          <div className="prod-img-placeholder">{cat.icono}</div>
                        )}
                        {prod.destacado && <span className="prod-badge">Destacado</span>}
                      </div>
                      <div className="prod-body">
                        <h3>{prod.nombre}</h3>
                        <p>{prod.descripcionCorta}</p>
                        <span className="prod-cta">Ver producto →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
