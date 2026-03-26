import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Clientes | ARIFA – Seguridad e Higiene",
  description: "Empresas, industrias e instituciones que confían en ARIFA para su seguridad e higiene laboral en Córdoba, Argentina.",
};

const CLIENTS = [
  "Empresas Industriales", "Consorcios de Copropietarios", "Pymes y Emprendimientos",
  "Comercios y Locales", "Establecimientos Educativos", "Hospitales y Clínicas",
  "Organismos Públicos", "Municipios y Comunas", "Empresas de Logística",
  "Construcción y Obras", "Gastronómicos y Hoteles", "Depósitos y Almacenes",
  "Playas de Estacionamiento", "Centros Comerciales", "Empresas de Salud",
];

export default function ClientesPage() {
  return (
    <>
      <div className="page-banner">
        <div className="container">
          <h1>Clientes</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href="/la-empresa">La Empresa</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Clientes</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Clientes que Confían en ARIFA</h2>
            <div className="section-line"></div>
            <p style={{marginTop:'15px'}}>
              Trabajamos con empresas e instituciones de todos los rubros y tamaños en toda la Provincia de Córdoba.
            </p>
          </div>

          <div className="clients-grid">
            {CLIENTS.map((c, i) => (
              <div key={i} className="client-logo">
                <div className="client-logo-text">{c}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sectores que atendemos */}
      <section className="section-padding bg-gray">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Sectores que Atendemos</h2>
            <div className="section-line"></div>
          </div>
          <div className="sectors-grid">
            {[
              { icon:'🏭', title:'Empresas e Industrias', desc:'Soluciones integrales para grandes industrias, plantas de producción y empresas de servicios.', href:'/servicios' },
              { icon:'🏢', title:'Consorcios', desc:'Asesoramiento y cumplimiento normativo para edificios residenciales y de uso mixto.', href:'/servicios' },
              { icon:'🏪', title:'Pymes y Comercios', desc:'Servicios adaptados al tamaño y presupuesto de medianas y pequeñas empresas.', href:'/servicios' },
              { icon:'🏫', title:'Establecimientos Educativos', desc:'Seguridad escolar, planes de evacuación y capacitación docente.', href:'/servicios' },
              { icon:'🏥', title:'Salud y Hospitales', desc:'Normativas específicas para establecimientos del sector salud.', href:'/servicios' },
              { icon:'🏛️', title:'Organismos Públicos', desc:'Adecuación normativa para organismos municipales, provinciales y nacionales.', href:'/servicios' },
            ].map((s, i) => (
              <Link key={i} href={s.href} className="sector-card" style={{display:'block'}}>
                <div className="sector-icon" style={{fontSize:'1.8rem'}}>{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial / CTA */}
      <section className="section-padding" style={{background:'var(--primary-blue)', color:'#fff'}}>
        <div className="container" style={{textAlign:'center'}}>
          <div style={{maxWidth:'700px', margin:'0 auto'}}>
            <div style={{fontSize:'3rem', marginBottom:'20px', opacity:0.3}}>"</div>
            <p style={{fontSize:'1.25rem', lineHeight:1.8, marginBottom:'30px', color:'rgba(255,255,255,0.9)'}}>
              En ARIFA nos inspiran confianza porque se adaptan a nuestras necesidades, asesoran
              para contar con la protección necesaria y realizan los mantenimientos reglamentarios
              según los estándares vigentes, evitando multas y garantizando seguridad.
            </p>
            <p style={{color:'rgba(255,255,255,0.5)', fontSize:'0.9rem', marginBottom:'30px'}}>— Clientes de ARIFA</p>
            <Link href="/contacto" className="btn-red">Sumarse como Cliente</Link>
          </div>
        </div>
      </section>
    </>
  );
}
