import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PRODUCTOS_PLACEHOLDER,
  CATEGORIAS_PLACEHOLDER,
  getProductoBySlug,
  getCategoriaBySlug,
  getProductosByCategoria,
} from "@/lib/productos";

type Props = { params: { slug: string } };

export async function generateStaticParams() {
  return PRODUCTOS_PLACEHOLDER.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const prod = getProductoBySlug(slug);
  if (!prod) return { title: "Producto | ARIFA" };
  return {
    title: `${prod.nombre} | Catálogo ARIFA`,
    description: prod.descripcion.slice(0, 160),
  };
}

export default async function ProductoDetailPage({ params }: Props) {
  const { slug } = await params;
  const prod = getProductoBySlug(slug);
  if (!prod) notFound();

  const cat = getCategoriaBySlug(
    CATEGORIAS_PLACEHOLDER.find((c) => c.id === prod.categoriaId)?.slug || ""
  );

  // Productos relacionados (misma categoría, excluye este)
  const relacionados = getProductosByCategoria(prod.categoriaId)
    .filter((p) => p.id !== prod.id)
    .slice(0, 3);

  return (
    <>
      <div className="page-banner">
        <div className="container">
          <h1>{prod.nombre}</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href="/catalogo">Catálogo</Link>
            <span className="breadcrumb-sep">/</span>
            {cat && (
              <>
                <Link href={`/catalogo/${cat.slug}`}>{cat.nombre}</Link>
                <span className="breadcrumb-sep">/</span>
              </>
            )}
            <span>{prod.nombre}</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "50px", alignItems: "start" }}>
            {/* Imagen */}
            <div>
              <div
                style={{
                  background: "var(--bg-light)",
                  borderRadius: "4px",
                  aspectRatio: "1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "6rem",
                  border: "1px solid var(--border-light)",
                  position: "relative",
                }}
              >
                {prod.imagenes[0] || cat?.imagen ? (
                  <img
                    src={prod.imagenes[0] || cat?.imagen}
                    alt={prod.nombre}
                    style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "4px" }}
                  />
                ) : (
                  <span>{cat?.icono || "📦"}</span>
                )}
                {prod.destacado && (
                  <span
                    style={{
                      position: "absolute",
                      top: "16px",
                      left: "16px",
                      background: "var(--primary-red)",
                      color: "#fff",
                      padding: "4px 12px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      borderRadius: "3px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Destacado
                  </span>
                )}
              </div>

              {/* Nota Firebase */}
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 14px",
                  background: "#fff3cd",
                  borderRadius: "4px",
                  border: "1px solid #ffc107",
                  fontSize: "0.8rem",
                  color: "#856404",
                }}
              >
                📸 Las imágenes se cargarán desde Firebase Storage una vez configurado el panel de administración.
              </div>
            </div>

            {/* Info */}
            <div>
              {cat && (
                <Link
                  href={`/catalogo/${cat.slug}`}
                  style={{
                    display: "inline-block",
                    background: "var(--bg-light)",
                    color: "var(--primary-red)",
                    padding: "4px 12px",
                    borderRadius: "3px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: "12px",
                  }}
                >
                  {cat.icono} {cat.nombre}
                </Link>
              )}

              <h2 style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--primary-blue)", marginBottom: "16px", lineHeight: 1.3 }}>
                {prod.nombre}
              </h2>

              <p style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "24px" }}>
                {prod.descripcion}
              </p>

              {/* Características */}
              {prod.caracteristicas.length > 0 && (
                <div style={{ marginBottom: "28px" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--primary-blue)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                    Características técnicas
                  </h3>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {prod.caracteristicas.map((c, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                          <td style={{ padding: "9px 12px 9px 0", fontWeight: 600, color: "var(--primary-blue)", fontSize: "0.88rem", width: "40%" }}>
                            {c.clave}
                          </td>
                          <td style={{ padding: "9px 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                            {c.valor}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* CTAs */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
                <Link href="/contacto" className="btn-red" style={{ flex: "1", textAlign: "center" }}>
                  Solicitar cotización
                </Link>
                <a
                  href={`https://wa.me/5493512449504?text=${encodeURIComponent(`Hola ARIFA! Me interesa el producto: ${prod.nombre}. ¿Pueden darme más información?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    background: "#25D366",
                    color: "#fff",
                    padding: "13px 20px",
                    borderRadius: "4px",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    transition: "opacity 0.2s",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center", color: "var(--text-muted)", fontSize: "0.83rem" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14z"/></svg>
                <span>Llamanos: <a href="tel:+5493512449504" style={{ color: "var(--primary-red)", fontWeight: 600 }}>+54 9 351 244-9504</a></span>
              </div>
            </div>
          </div>

          {/* Productos relacionados */}
          {relacionados.length > 0 && (
            <div style={{ marginTop: "70px" }}>
              <div className="section-title-wrap" style={{ textAlign: "left", marginBottom: "30px" }}>
                <h2>Productos Relacionados</h2>
                <div className="section-line" style={{ margin: "10px 0 0" }}></div>
              </div>
              <div className="prod-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                {relacionados.map((rel) => (
                  <Link key={rel.id} href={`/catalogo/producto/${rel.slug}`} className="prod-card">
                    <div className="prod-img-wrap">
                      {rel.imagenes[0] || cat?.imagen ? (
                        <img src={rel.imagenes[0] || cat?.imagen} alt={rel.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div className="prod-img-placeholder">{cat?.icono || "📦"}</div>
                      )}
                    </div>
                    <div className="prod-body">
                      <h3>{rel.nombre}</h3>
                      <p>{rel.descripcionCorta}</p>
                      <span className="prod-cta">Ver producto →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
