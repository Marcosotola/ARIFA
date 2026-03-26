import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nosotros | ARIFA – Seguridad e Higiene",
  description: "Conocé la historia y trayectoria de ARIFA: expertos en seguridad e higiene laboral y protección contra incendios en Córdoba.",
};

export default function NosotrosPage() {
  return (
    <>
      <div className="page-banner" style={{ background: "linear-gradient(rgba(0,15,40,0.85), rgba(0,15,40,0.85)), url('/safety_engineers.png') center/cover no-repeat" }}>
        <div className="container">
          <h1>Nosotros</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href="/la-empresa">La Empresa</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Nosotros</span>
          </div>
        </div>
      </div>

      {/* Intro */}
      <section className="section-padding">
        <div className="container">
          <div className="about-grid">
            <div className="about-img-wrap">
              <img src="/safety_engineers.png" alt="Equipo ARIFA" className="about-img" />
            </div>
            <div className="about-text">
              <h2>Nuestra Empresa</h2>
              <div className="section-bar"></div>
              <h3>Somos expertos en Seguridad e Higiene Laboral.</h3>
              <p>
                ARIFA nació con el objetivo de brindar soluciones profesionales e integrales en materia
                de seguridad e higiene laboral y protección contra incendios. Desde nuestros inicios,
                hemos crecido de la mano de nuestros clientes, sumando áreas de servicio y expandiendo
                nuestra presencia en toda la Provincia de Córdoba.
              </p>
              <p>
                Nuestro equipo está compuesto por profesionales con formación académica y experiencia
                de campo, lo que nos permite abordar cada desafío con precisión técnica y creatividad.
                Nos especializamos en detectar riesgos antes de que se conviertan en problemas.
              </p>
              <p>
                Trabajamos con empresas de todos los rubros y tamaños: desde pequeños comercios hasta
                grandes industrias, consorcios, establecimientos educativos y organismos públicos.
                Cada cliente recibe una solución a medida, adaptada a sus necesidades y normativas específicas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trayectoria / Timeline */}
      <section className="section-padding bg-gray">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Nuestra Trayectoria</h2>
            <div className="section-line"></div>
          </div>
          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <div className="timeline-year">Los Comienzos</div>
                <h3>Fundación de ARIFA</h3>
                <p>ARIFA comenzó a operar como consultora de seguridad e higiene laboral, brindando asesoramiento a empresas de Córdoba Capital.</p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <div className="timeline-year">Expansión</div>
                <h3>Incorporación de Protección Contra Incendios</h3>
                <p>Sumamos el área de protección contra incendios, ofreciendo mantenimiento de matafuegos e instalaciones fijas.</p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <div className="timeline-year">Crecimiento</div>
                <h3>Capacitaciones y Documentación Técnica</h3>
                <p>Incorporamos el área de capacitaciones y la elaboración de documentación técnica, completando nuestra oferta integral.</p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <div className="timeline-year">Actualidad</div>
                <h3>Líderes en Seguridad en Córdoba</h3>
                <p>Hoy ARIFA abarca todos los sectores de la seguridad laboral, protegiendo a más de 200 empresas e instituciones de toda la provincia.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="section-padding">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Nuestros Valores</h2>
            <div className="section-line"></div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'28px'}}>
            {[
              { emoji:'🎯', title:'Compromiso', text:'Nos comprometemos con la seguridad de cada cliente como si fuera la nuestra propia.' },
              { emoji:'🔬', title:'Expertise Técnico', text:'Nuestro equipo está en constante capacitación para mantenerse al día con las normativas vigentes.' },
              { emoji:'🤝', title:'Confianza', text:'Construimos relaciones de largo plazo basadas en la transparencia y la honestidad profesional.' },
              { emoji:'⚡', title:'Agilidad', text:'Respondemos rápidamente ante las necesidades de nuestros clientes, minimizando tiempos de espera.' },
              { emoji:'🌿', title:'Responsabilidad', text:'Promovemos el cuidado del medio ambiente y la salud de las personas en cada servicio que brindamos.' },
              { emoji:'📈', title:'Mejora Continua', text:'Evaluamos y perfeccionamos constantemente nuestros procesos para brindar el mejor servicio posible.' },
            ].map((v, i) => (
              <div key={i} className="sector-card">
                <div style={{fontSize:'2rem', marginBottom:'12px'}}>{v.emoji}</div>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="full-cta">
        <div className="container full-cta-inner">
          <div>
            <div className="full-cta-tag">¿Querés saber más?</div>
            <h2>Consultanos sin compromiso</h2>
          </div>
          <Link href="/contacto" className="btn-red">Contactenos</Link>
        </div>
      </section>
    </>
  );
}
