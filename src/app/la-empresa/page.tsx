import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "La Empresa | ARIFA – Seguridad e Higiene",
  description: "Conocé a ARIFA: nuestras áreas de trabajo, trayectoria y compromiso con la seguridad laboral en Córdoba, Argentina.",
};

const AREAS = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    ),
    title: "Área de Seguridad e Higiene Laboral",
    desc: "Desarrollamos un relevamiento exhaustivo de las condiciones de trabajo para garantizar el cumplimiento de la normativa vigente. Elaboramos programas de seguridad personalizados para cada empresa.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>
    ),
    title: "Área de Protección Contra Incendios",
    desc: "Realizamos el mantenimiento de todos los sistemas fijos contra incendios, asegurándonos una respuesta eficaz de tus instalaciones ante el inicio de un eventual siniestro.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    ),
    title: "Área de Capacitaciones",
    desc: "Desarrollamos planes de evacuación y realizamos capacitaciones a instituciones, profesionales y empresas, acerca de cómo actuar ante un siniestro y las mejores prácticas de seguridad.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    ),
    title: "Área de Documentación Técnica",
    desc: "Elaboramos toda la documentación técnica requerida por ART, municipalidades y aseguradoras: cálculo de carga de fuego, planimetrías, planes de emergencia y más.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    ),
    title: "Área de Auditorías e Inspecciones",
    desc: "Realizamos auditorías técnicas para evaluar el estado de las instalaciones, los procesos de trabajo y el cumplimiento de la normativa vigente en materia de seguridad.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
    ),
    title: "Área de Asesoramiento Integral",
    desc: "Brindamos asesoramiento permanente a nuestros clientes, acompañándolos en cada etapa del proceso de adecuación normativa y prevención de riesgos laborales.",
  },
];

export default function LaEmpresaPage() {
  return (
    <>
      <div className="page-banner">
        <div className="container">
          <h1>La Empresa</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <span>La Empresa</span>
          </div>
        </div>
      </div>

      {/* Intro */}
      <section className="section-padding">
        <div className="container about-grid">
          <div className="about-img-wrap">
            <img src="/safety_engineers.png" alt="Equipo ARIFA" className="about-img" />
          </div>
          <div className="about-text">
            <h2>Nuestra Empresa</h2>
            <div className="section-bar"></div>
            <h3>Somos expertos en Seguridad e Higiene Laboral.</h3>
            <p>
              ARIFA es un equipo de profesionales con vasta experiencia en el servicio de asesoramiento
              en materia de seguridad e higiene laboral, fuertemente enfocados en el cuidado de la salud
              de las personas y del medio ambiente a su alrededor.
            </p>
            <p>
              Contamos con profesionales especializados en cada área para poder brindarte el mejor servicio.
              Nos adaptamos a la particularidad de cada rubro o sector, ofreciendo soluciones a medida
              para cada cliente.
            </p>
            <p>
              Mediante inspección constante y asesoramiento continuo, reducimos drásticamente todo tipo
              de contingencias y garantizamos el cumplimiento de la normativa vigente.
            </p>
            <div style={{marginTop:'28px', display:'flex', gap:'15px', flexWrap:'wrap'}}>
              <Link href="/nosotros" className="btn-red">Ver Nosotros</Link>
              <Link href="/certificaciones" className="btn-blue">Nuestras Habilitaciones</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Áreas */}
      <section className="section-padding bg-gray">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Nuestras Áreas de Trabajo</h2>
            <div className="section-line"></div>
            <p style={{marginTop:'15px'}}>Contamos con equipos especializados en cada área para brindarte el mejor servicio.</p>
          </div>
          <div className="areas-grid">
            {AREAS.map((a, i) => (
              <div key={i} className="area-card">
                <div style={{color:'var(--primary-red)', marginBottom:'12px'}}>{a.icon}</div>
                <h3>{a.title}</h3>
                <p>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sub-nav links */}
      <section className="section-padding">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Más Información</h2>
            <div className="section-line"></div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'20px'}}>
            {[
              { label:'Nosotros', href:'/nosotros', desc:'Quiénes somos y nuestra historia' },
              { label:'Habilitaciones', href:'/certificaciones', desc:'Nuestras certificaciones y habilitaciones' },
              { label:'Clientes', href:'/clientes', desc:'Empresas que confían en ARIFA' },
              { label:'Código de Ética', href:'/etica', desc:'Nuestros valores y compromiso' },
              { label:'Trabaja con Nosotros', href:'/trabaja-con-nosotros', desc:'Sumate a nuestro equipo' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  background:'#fff',
                  border:'1px solid var(--border-light)',
                  borderRadius:'4px',
                  padding:'24px',
                  transition:'all 0.3s',
                  display:'block',
                  borderTop:'4px solid var(--primary-red)',
                }}
                className="sector-card"
              >
                <h3 style={{color:'var(--primary-blue)', fontWeight:800, marginBottom:'8px'}}>{item.label}</h3>
                <p style={{color:'var(--text-muted)', fontSize:'0.88rem'}}>{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="full-cta">
        <div className="container full-cta-inner">
          <div>
            <div className="full-cta-tag">¿Necesitás asesoramiento?</div>
            <h2>Contactanos y recibí atención personalizada</h2>
          </div>
          <Link href="/contacto" className="btn-red">Contactenos</Link>
        </div>
      </section>
    </>
  );
}
