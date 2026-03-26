import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Trabajá con Nosotros | ARIFA",
  description: "¿Querés sumarte al equipo de ARIFA? Buscamos profesionales comprometidos con la seguridad e higiene laboral. Envianos tu CV.",
};

export default function TrabajaConNosotrosPage() {
  return (
    <>
      <div className="page-banner">
        <div className="container">
          <h1>Trabajá con Nosotros</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href="/la-empresa">La Empresa</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Trabajá con Nosotros</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container">
          <div className="jobs-box">
            <div style={{fontSize:'3.5rem', marginBottom:'20px'}}>🚀</div>
            <h2>¿Te gustaría formar parte de un equipo de alta performance?</h2>
            <p>
              Sos responsable, te atraen los desafíos, te interesa trabajar en un ambiente dinámico,
              ágil y colaborativo, entonces podrías formar parte de nuestro equipo de ARIFA.
            </p>
            <p>
              ¡Animate! Construyamos algo grande juntos. Envianos tu CV y, ante cualquier oportunidad,
              nos pondremos en contacto contigo. ¡Mucha suerte!
            </p>
            <a href="mailto:arifa.seguridadcontraincendios@gmail.com?subject=CV - Postulación a ARIFA" className="jobs-email">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Enviar CV por E-mail
            </a>
          </div>

          {/* What we look for */}
          <div style={{marginTop:'70px'}}>
            <div className="section-title-wrap">
              <h2>¿Qué Buscamos?</h2>
              <div className="section-line"></div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'25px'}}>
              {[
                { emoji:'🎓', title:'Formación Técnica o Universitaria', desc:'Lic. en Higiene y Seguridad, Técnico en Seguridad e Higiene, Ingeniería o afines.' },
                { emoji:'📋', title:'Conocimiento Normativo', desc:'Manejo de legislación nacional y provincial en materia de seguridad laboral y protección contra incendios.' },
                { emoji:'🤝', title:'Trabajo en Equipo', desc:'Capacidad para integrarse a equipos de trabajo multidisciplinarios y colaborar con diferentes áreas.' },
                { emoji:'💼', title:'Orientación al Cliente', desc:'Actitud proactiva, vocación de servicio y habilidades de comunicación efectiva con clientes.' },
                { emoji:'⚡', title:'Proactividad y Compromiso', desc:'Iniciativa propia, responsabilidad y predisposición para asumir nuevos desafíos.' },
                { emoji:'🚗', title:'Disponibilidad para Viajar', desc:'Posibilidad de traslado a distintas localidades de la Provincia de Córdoba.' },
              ].map((item, i) => (
                <div key={i} style={{background:'#fff', border:'1px solid var(--border-light)', padding:'24px', borderRadius:'4px', display:'flex', gap:'16px', alignItems:'flex-start'}}>
                  <div style={{fontSize:'1.8rem', flexShrink:0}}>{item.emoji}</div>
                  <div>
                    <h3 style={{color:'var(--primary-blue)', fontSize:'1rem', fontWeight:700, marginBottom:'6px'}}>{item.title}</h3>
                    <p style={{color:'var(--text-muted)', fontSize:'0.88rem'}}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="full-cta">
        <div className="container full-cta-inner">
          <div>
            <div className="full-cta-tag">¿Tenés alguna duda?</div>
            <h2>Contactanos y te respondemos a la brevedad</h2>
          </div>
          <Link href="/contacto" className="btn-red">Contactenos</Link>
        </div>
      </section>
    </>
  );
}
