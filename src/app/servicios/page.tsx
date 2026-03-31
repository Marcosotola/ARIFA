import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Servicios | ARIFA – Seguridad e Higiene",
  description: "Todos los servicios de ARIFA: seguridad e higiene laboral, protección contra incendios, capacitaciones, documentación técnica y más en Córdoba.",
};

const SERVICE_GROUPS = [
  {
    title: "Seguridad e Higiene Laboral",
    icon: "🛡️",
    color: "#002244",
    services: [
      { label: "Análisis y Evaluación de Riesgos", href: "/servicios/analisis-de-riesgos" },
      { label: "Capacitación al Personal", href: "/servicios/capacitacion-personal" },
      { label: "Investigación de Siniestros", href: "/servicios/investigacion-siniestros" },
      { label: "Medición de Contaminantes", href: "/servicios/medicion-contaminantes" },
      { label: "Auditorías e Inspecciones", href: "/servicios/auditorias" },
    ],
  },
  {
    title: "Protección Contra Incendios",
    icon: "🔥",
    color: "#D32F2F",
    services: [
      { label: "Mantenimiento de Matafuegos", href: "/servicios/matafuegos" },
      { label: "Instalaciones Fijas Contra Incendio", href: "/servicios/instalaciones-fijas" },
      { label: "Detección y Alarma de Incendio", href: "/servicios/deteccion-alarma" },
      { label: "Sistemas de Espuma y Gases", href: "/servicios/sistemas-espuma-gases" },
    ],
  },
  {
    title: "Capacitaciones y Documentación",
    icon: "📋",
    color: "#148039",
    services: [
      { label: "Planes de Evacuación", href: "/servicios/planes-evacuacion" },
      { label: "Cálculo de Carga de Fuego", href: "/servicios/carga-de-fuego" },
      { label: "Planimetrías de Seguridad", href: "/servicios/planimetrias" },
      { label: "Capacitacion de Brigadas", href: "/servicios/capacitacion-personal" },
    ],
  },
];

export default function ServiciosPage() {
  return (
    <>
      <div className="page-banner" style={{ background: "linear-gradient(rgba(0,10,30,0.8), rgba(0,10,30,0.8)), url('/fire_protection.png') center/cover no-repeat" }}>
        <div className="container">
          <h1>Servicios</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Servicios</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Todos Nuestros Servicios</h2>
            <div className="section-line"></div>
            <p style={{marginTop:'15px'}}>
              Contamos con soluciones para cada necesidad. Hacé clic en cualquier servicio para obtener más información.
            </p>
          </div>

          <div className="grid-3">
            {SERVICE_GROUPS.map((group, gi) => (
              <div key={gi} style={{background:'#fff', border:'1px solid var(--border-light)', borderRadius:'4px', overflow:'hidden', boxShadow:'0 4px 18px rgba(0,0,0,0.05)'}}>
                <div style={{background:group.color, padding:'24px', color:'#fff'}}>
                  <div style={{fontSize:'2rem', marginBottom:'8px'}}>{group.icon}</div>
                  <h2 style={{fontSize:'1.15rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.5px'}}>{group.title}</h2>
                </div>
                <ul style={{listStyle:'none', padding:'20px'}}>
                  {group.services.map((svc, si) => (
                    <li key={si} style={{borderBottom:'1px solid var(--border-light)'}}>
                      <Link
                        href={svc.href}
                        style={{
                          display:'flex',
                          alignItems:'center',
                          gap:'8px',
                          padding:'11px 0',
                          fontSize:'0.9rem',
                          color:'var(--text-dark)',
                          fontWeight:500,
                          transition:'color 0.2s, padding-left 0.2s',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{color:'var(--primary-red)', flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
                        {svc.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div style={{padding:'0 20px 20px'}}>
                  <Link href="/contacto" className="btn-red" style={{display:'block', textAlign:'center', fontSize:'0.82rem'}}>
                    Solicitar Cotización
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How we work */}
      <section className="section-padding bg-gray">
        <div className="container">
          <div className="section-title-wrap">
            <h2>¿Cómo Trabajamos?</h2>
            <div className="section-line"></div>
          </div>
          <div className="grid-4">
            {[
              { n:'01', t:'Diagnóstico', d:'Evaluamos el estado actual de tu empresa y detectamos los riesgos existentes.' },
              { n:'02', t:'Propuesta', d:'Elaboramos una propuesta de solución a medida, adaptada a tu rubro y presupuesto.' },
              { n:'03', t:'Implementación', d:'Ejecutamos los servicios acordados con el más alto estándar de calidad.' },
              { n:'04', t:'Seguimiento', d:'Hacemos seguimiento continuo para garantizar el cumplimiento normativo permanente.' },
            ].map((step, i) => (
              <div key={i} style={{background:'#fff', padding:'30px 20px', borderRadius:'4px', boxShadow:'0 4px 15px rgba(0,0,0,0.04)'}}>
                <div style={{fontSize:'2.5rem', fontWeight:900, color:'var(--primary-red)', marginBottom:'10px'}}>{step.n}</div>
                <h3 style={{color:'var(--primary-blue)', fontWeight:700, marginBottom:'10px'}}>{step.t}</h3>
                <p style={{color:'var(--text-muted)', fontSize:'0.88rem'}}>{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="full-cta">
        <div className="container full-cta-inner">
          <div>
            <div className="full-cta-tag">Contactanos ahora y asesorate sin cargo</div>
            <h2>Envianos tu consulta y te respondemos a la brevedad</h2>
          </div>
          <Link href="/contacto" className="btn-red">Solicitar Cotización</Link>
        </div>
      </section>
    </>
  );
}
