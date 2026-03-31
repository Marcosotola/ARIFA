import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Habilitaciones y Certificaciones | ARIFA",
  description: "Conocé todas las habilitaciones y certificaciones de ARIFA para operar en seguridad e higiene laboral y protección contra incendios en Córdoba.",
};

const CERTS = [
  {
    label: "Habilitación Municipal – Ciudad de Córdoba",
    body: "Municipalidad de Córdoba",
    desc: "Empresa habilitada por la Municipalidad de Córdoba para realizar servicios de seguridad e higiene laboral y protección contra incendios.",
  },
  {
    label: "Registro de Profesionales – SRT",
    body: "Superintendencia de Riesgos del Trabajo",
    desc: "Profesionales registrados ante la Superintendencia de Riesgos del Trabajo para el asesoramiento en materia de seguridad e higiene.",
  },
  {
    label: "Habilitación Provincial – Provincia de Córdoba",
    body: "Gobierno de la Provincia de Córdoba",
    desc: "Habilitados para operar en toda la Provincia de Córdoba en servicios de prevención de riesgos laborales.",
  },
  {
    label: "Normas NFPA",
    body: "NFPA – Asociación Nacional de Protección Contra el Fuego",
    desc: "Aplicación de normas NFPA bajo estándares internacionales para la prevención, instalación y uso de medios de protección contra incendio.",
  },
  {
    label: "Capacitadores Certificados – ART",
    body: "Aseguradoras de Riesgo del Trabajo",
    desc: "Capacitadores habilitados para dictar cursos y capacitaciones reconocidos por las principales ART del país.",
  },
  {
    label: "Acreditación en Seguridad e Higiene Industrial",
    body: "Ministerio de Trabajo – Córdoba",
    desc: "Profesionales acreditados ante el Ministerio de Trabajo para el ejercicio de la seguridad e higiene industrial en la Provincia de Córdoba.",
  },
  {
    label: "Especialización en Protección Contra Incendios",
    body: "Formación Académica Superior",
    desc: "Nuestros profesionales cuentan con formación universitaria y especializaciones en protección contra incendios y seguridad laboral.",
  },
  {
    label: "Capacitación Continua en Normativas",
    body: "Actualización Permanente",
    desc: "Nuestro equipo se mantiene permanentemente actualizado en las normativas vigentes a nivel nacional, provincial y municipal.",
  },
  {
    label: "Miembros de Cámara de Seguridad – Córdoba",
    body: "Cámara Argentina de Seguridad",
    desc: "Miembros activos de la Cámara de Seguridad, participando en el desarrollo y actualización de estándares para el sector.",
  },
];

export default function CertificacionesPage() {
  return (
    <>
      <div className="page-banner">
        <div className="container">
          <h1>Habilitaciones y Certificaciones</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href="/la-empresa">La Empresa</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Habilitaciones</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Nuestras Habilitaciones</h2>
            <div className="section-line"></div>
            <p style={{marginTop:'15px'}}>
              ARIFA cuenta con todas las habilitaciones y certificaciones necesarias para operar en
              materia de seguridad e higiene laboral y protección contra incendios.
            </p>
          </div>

          <div className="cert-grid">
            {CERTS.map((c, i) => (
              <div key={i} className="cert-card">
                <div className="cert-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
                </div>
                <h3>{c.label}</h3>
                <p style={{fontSize:'0.78rem', color:'var(--primary-red)', fontWeight:700, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.5px'}}>{c.body}</p>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-gray">
        <div className="container" style={{textAlign:'center'}}>
          <div className="section-title-wrap">
            <h2>¿Por qué confiar en ARIFA?</h2>
            <div className="section-line"></div>
          </div>
          <div className="grid-3" style={{marginTop:'0'}}>
            {[
              { n:'✓', t:'Profesionales Habilitados', d:'Todo nuestro personal cuenta con las habilitaciones exigidas.' },
              { n:'✓', t:'Normativa Actualizada', d:'Nos mantenemos al día con todas las normativas vigentes.' },
              { n:'✓', t:'Experiencia Comprobada', d:'Más de una década brindando servicios de calidad en Córdoba.' },
            ].map((item, i) => (
              <div key={i} style={{background:'#fff', padding:'30px', borderRadius:'4px', boxShadow:'0 4px 15px rgba(0,0,0,0.05)'}}>
                <div style={{fontSize:'2rem', color:'var(--primary-red)', fontWeight:900, marginBottom:'10px'}}>{item.n}</div>
                <h3 style={{color:'var(--primary-blue)', fontSize:'1.05rem', fontWeight:700, marginBottom:'8px'}}>{item.t}</h3>
                <p style={{color:'var(--text-muted)', fontSize:'0.9rem'}}>{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="full-cta">
        <div className="container full-cta-inner">
          <div>
            <div className="full-cta-tag">¿Tenés dudas?</div>
            <h2>Consultanos sobre nuestras habilitaciones</h2>
          </div>
          <Link href="/contacto" className="btn-red">Contactenos</Link>
        </div>
      </section>
    </>
  );
}
