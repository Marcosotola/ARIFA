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
          <div className="catalog-container" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "40px", alignItems: "start" }}>
            {/* Sidebar categorías */}
            <aside className="catalog-sidebar">
              <div className="service-sidebar" style={{ background: '#fff', padding: '25px', borderRadius: '12px', border: '1px solid #f0f0f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '20px', color: 'var(--primary-blue)', paddingBottom: '12px', borderBottom: '2px solid var(--bg-light)' }}>Categorías</h3>
                <ul className="sidebar-link-list">
                  {CATEGORIAS_PLACEHOLDER.map((c) => (
                    <li key={c.id} style={{ marginBottom: '8px' }}>
                      <Link
                        href={`/catalogo/${c.slug}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          background: c.slug === slug ? 'rgba(163, 31, 29, 0.05)' : 'transparent',
                          color: c.slug === slug ? 'var(--primary-red)' : 'var(--text-dark)',
                          fontWeight: c.slug === slug ? 700 : 500,
                          transition: '0.2s'
                        }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>{c.icono}</span>
                        {c.nombre}
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* CTA sidebar */}
                <div style={{ marginTop: "30px", background: "var(--primary-blue)", padding: "25px", borderRadius: "12px", color: "#fff", textAlign: "center" }}>
                  <p style={{ fontWeight: 700, marginBottom: "15px", fontSize: "0.95rem", lineHeight: '1.4' }}>¿Necesitás asesoramiento técnico?</p>
                  <a
                    href="https://wa.me/5493512449504"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ 
                      display: "block", 
                      background: "#25D366", 
                      color: "#fff", 
                      padding: "12px", 
                      borderRadius: "8px", 
                      fontSize: "0.85rem", 
                      fontWeight: 800,
                      textTransform: 'uppercase'
                    }}
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </aside>

            {/* Productos */}
            <div className="catalog-main">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "35px", flexWrap: "wrap", gap: "20px" }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px' }}>
                    <div style={{ fontSize: "2.5rem" }}>{cat.icono}</div>
                    <h2 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>{cat.nombre}</h2>
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: "1rem", maxWidth: '600px' }}>{cat.descripcion}</p>
                </div>
                <div style={{ background: 'var(--bg-light)', padding: '6px 15px', borderRadius: '20px', fontSize: "0.85rem", fontWeight: 700, color: 'var(--primary-blue)' }}>
                  {productos.length} producto{productos.length !== 1 ? "s" : ""}
                </div>
              </div>

              {productos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 40px", background: "#fff", borderRadius: "12px", border: '1px dashed #ccc' }}>
                  <div style={{ fontSize: "4rem", marginBottom: "20px" }}>📦</div>
                  <h3 style={{ color: "var(--primary-blue)", fontSize: '1.4rem', fontWeight: 800, marginBottom: "10px" }}>Próximamente más productos</h3>
                  <p style={{ color: "var(--text-muted)", maxWidth: '400px', margin: '0 auto 25px' }}>Estamos actualizando nuestro catálogo para ofrecerte lo mejor. Si no encontrás lo que buscás, contactanos.</p>
                  <Link href="/contacto" className="btn-red">
                    Consultar Disponibilidad
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
                        <span className="prod-cta">Ver detalles →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <style jsx>{`
              @media (max-width: 991px) {
                .catalog-container {
                  grid-template-columns: 1fr !important;
                }
                .catalog-sidebar {
                  order: 2;
                }
                .catalog-main {
                  order: 1;
                }
              }
            `}</style>
          </div>
        </div>
      </section>
    </>
  );
}
