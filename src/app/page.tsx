"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getProductosDestacados, CATEGORIAS_PLACEHOLDER } from "@/lib/productos";

// ---- SLIDER DATA ----
const SLIDES = [
  {
    bg: "linear-gradient(rgba(0,20,50,0.72), rgba(0,20,50,0.62)), url('/hero_people.png') center/cover no-repeat",
    tag: "Expertos en Seguridad",
    title: "Protegemos tu Mayor Capital: Tu Gente",
    sub: "Brindamos soluciones integrales de seguridad e higiene laboral para empresas, industrias y establecimientos educativos de toda la provincia de Córdoba.",
  },
  {
    bg: "linear-gradient(rgba(180,20,20,0.72), rgba(0,15,40,0.70)), url('/fire_protection.png') center/cover no-repeat",
    tag: "Protección Contra Incendios",
    title: "Instalaciones y Mantenimiento de Sistemas Contra Incendio",
    sub: "Detectamos, controlamos y extinguimos el fuego. Diseñamos e instalamos sistemas de detección, rociadores, redes de agua y más.",
  },
  {
    bg: "linear-gradient(rgba(0,20,50,0.72), rgba(0,20,50,0.62)), url('/safety_engineers.png') center/cover no-repeat",
    tag: "Capacitaciones",
    title: "Capacitamos a tu Personal para Actuar ante Emergencias",
    sub: "Formamos brigadas, elaboramos planes de evacuación y brindamos toda la documentación técnica exigida por ART y municipalidades.",
  },
];

// ---- SECTORS ----
const SECTORS = [
  { icon: "🏭", title: "Industrias y Fábricas", desc: "Soluciones a medida para el entorno industrial." },
  { icon: "🏢", title: "Empresas y Oficinas", desc: "Cumplimiento normativo y capacitación laboral." },
  { icon: "🏫", title: "Establecimientos Educativos", desc: "Seguridad escolar y planes de evacuación." },
  { icon: "🏪", title: "Comercios", desc: "Protección integral para locales y negocios." },
  { icon: "🏢", title: "Construcción y Obras", desc: "Seguridad en obra e higiene laboral." }, // Note: duplicate emoji is fine for now
  { icon: "🚢", title: "Navieras y Marítimas", desc: "Mantenimiento y habilitación para embarcaciones." },
];

export default function Home() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrent((c) => (c + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      {/* ===== HERO SLIDER ===== */}
      <section className="hero-slider" aria-label="Slider principal">
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            className={`slide${i === current ? " active" : ""}`}
            style={{ background: slide.bg }}
            aria-hidden={i !== current}
          >
            <div className="slide-overlay" />
            <div className="container">
              <div className="slide-content">
                <div className="slide-tag">{slide.tag}</div>
                <h1>{slide.title}</h1>
                <p>{slide.sub}</p>
                <div className="slide-btns">
                  <Link href="/contacto" className="btn-red">Solicitar Cotización / Consulta</Link>
                  <Link href="/servicios" className="btn-outline-white">Nuestros Servicios</Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Arrows */}
        <button
          className="slider-arrow prev"
          aria-label="Anterior"
          onClick={() => setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button
          className="slider-arrow next"
          aria-label="Siguiente"
          onClick={() => setCurrent((c) => (c + 1) % SLIDES.length)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        {/* Dots */}
        <div className="slider-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`slider-dot${i === current ? " active" : ""}`}
              aria-label={`Ir a slide ${i + 1}`}
              onClick={() => setCurrent(i)}
            />
          ))}
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <div className="stats-bar">
        <div className="container stats-grid">
          <div className="stat-item">
            <div className="stat-number">+10</div>
            <div className="stat-label">Años de Experiencia</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">+200</div>
            <div className="stat-label">Clientes Activos</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">100%</div>
            <div className="stat-label">Compromiso y Calidad</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">+50</div>
            <div className="stat-label">Industrias Atendidas</div>
          </div>
        </div>
      </div>

      {/* ===== SERVICIOS ===== */}
      <section className="section-padding bg-gray" id="servicios">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Nuestros Servicios</h2>
            <div className="section-line"></div>
            <p style={{marginTop:'15px'}}>
              Ofrecemos un servicio integral adaptado a las necesidades de cada cliente y sector.
            </p>
          </div>

          <div className="services-card-grid">
            <div className="service-card-clean">
              <div className="icon-circle">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>Seguridad e Higiene Laboral</h3>
              <p>Asesoramiento especializado para asegurar el bienestar de su personal y la adecuación legal a las normativas vigentes.</p>
              <ul>
                <li>Análisis y Evaluación de Riesgos</li>
                <li>Medición de Contaminantes</li>
                <li>Auditorías y Normas ISO</li>
                <li>Investigación de Siniestros</li>
              </ul>
              <Link href="/servicios/analisis-de-riesgos" className="service-card-link">Ver más →</Link>
            </div>

            <div className="service-card-clean">
              <div className="icon-circle">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>
              </div>
              <h3>Protección Contra Incendios</h3>
              <p>Soluciones de ingeniería enfocadas en detectar, controlar y extinguir el fuego de manera rápida y efectiva.</p>
              <ul>
                <li>Mantenimiento de Matafuegos</li>
                <li>Instalaciones Fijas Contra Incendio</li>
                <li>Detección y Alarma Temprana</li>
                <li>Redes de Agua y Rociadores</li>
              </ul>
              <Link href="/servicios/matafuegos" className="service-card-link">Ver más →</Link>
            </div>

            <div className="service-card-clean">
              <div className="icon-circle">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <h3>Planes e Informes Técnicos</h3>
              <p>Gestión documental rigurosa requerida por ART, municipalidades y aseguradoras de riesgo.</p>
              <ul>
                <li>Cálculo de Carga de Fuego</li>
                <li>Planes de Emergencia y Evacuación</li>
                <li>Planimetrías de Seguridad</li>
                <li>Almacenamiento MATPEL</li>
              </ul>
              <Link href="/servicios/planes-evacuacion" className="service-card-link">Ver más →</Link>
            </div>

            <div className="service-card-clean">
              <div className="icon-circle">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <h3>Capacitaciones</h3>
              <p>Formamos a tu personal para actuar correctamente ante emergencias y minimizar riesgos laborales.</p>
              <ul>
                <li>Brigadas Contra Incendios</li>
                <li>Uso de Matafuegos</li>
                <li>Evacuación de Emergencias</li>
                <li>Primeros Auxilios y RCP</li>
              </ul>
              <Link href="/servicios/capacitacion-personal" className="service-card-link">Ver más →</Link>
            </div>

            <div className="service-card-clean">
              <div className="icon-circle">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <h3>Auditorías e Inspecciones</h3>
              <p>Evaluamos el estado actual de sus instalaciones y procesos para garantizar el cumplimiento normativo.</p>
              <ul>
                <li>Auditorías Contra Incendios</li>
                <li>Verificación de Instalaciones</li>
                <li>Relevamiento de Riesgos</li>
                <li>Informes y Recomendaciones</li>
              </ul>
              <Link href="/servicios/auditorias" className="service-card-link">Ver más →</Link>
            </div>

            <div className="service-card-clean">
              <div className="icon-circle">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <h3>Sistemas de Detección</h3>
              <p>Instalación y mantenimiento de sistemas de detección de humo, calor y gases para protección temprana.</p>
              <ul>
                <li>Detectores de Humo y Calor</li>
                <li>Alarmas de Incendio</li>
                <li>Centrales de Alarma</li>
                <li>Mantenimiento Preventivo</li>
              </ul>
              <Link href="/servicios/deteccion-alarma" className="service-card-link">Ver más →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LA EMPRESA / ABOUT ===== */}
      <section className="section-padding" id="empresa">
        <div className="container about-grid">
          <div className="about-img-wrap" style={{position:'relative'}}>
            <img src="/safety_engineers.png" alt="Profesionales de ARIFA" className="about-img" />
            <div className="about-seal">
              <img src="/logos/logoFondoTransparente.svg" alt="Sello ARIFA" />
            </div>
          </div>
          <div className="about-text">
            <h2>La Empresa</h2>
            <div className="section-bar"></div>
            <h3>Protegemos tu Mayor Capital: Tu Gente.</h3>
            <p>
              <strong>ARIFA</strong> es un equipo de profesionales con vasta experiencia en el
              servicio de asesoramiento en materia de seguridad e higiene laboral, fuertemente
              enfocados en el cuidado de la salud de las personas y del medio ambiente a su alrededor.
            </p>
            <p>
              Cada cliente cuenta con instalaciones y entornos únicos. Nosotros nos encargamos de
              aportar soluciones a medida, adaptándonos asertivamente a la necesidad y normativas de
              su rubro. Mediante inspección constante, reducimos drásticamente todo tipo de contingencias.
            </p>
            <p>
              Contamos con profesionales especializados en cada área para poder brindarte el mejor
              servicio, garantizando el cumplimiento de toda la normativa vigente.
            </p>
            <div className="about-badges">
              <div className="about-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'#D32F2F'}}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
                Profesionales Habilitados
              </div>
              <div className="about-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'#D32F2F'}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Normas Vigentes
              </div>
              <div className="about-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'#D32F2F'}}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                Equipo Especializado
              </div>
            </div>
            <div style={{marginTop:'30px', display:'flex', gap:'15px', flexWrap:'wrap'}}>
              <Link href="/nosotros" className="btn-red">Conocenos Más</Link>
              <Link href="/contacto" className="btn-blue">Solicitar Asesoramiento</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTORES ===== */}
      <section className="section-padding bg-gray bg-brand-texture">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Sectores que Atendemos</h2>
            <div className="section-line"></div>
            <p style={{marginTop:'15px'}}>Nos adaptamos a las necesidades y normativas de cada rubro y sector.</p>
          </div>
          <div className="sectors-grid">
            {SECTORS.map((s, i) => (
              <div key={i} className="sector-card">
                <div className="sector-icon" style={{fontSize:'1.8rem'}}>{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRODUCTOS DESTACADOS ===== */}
      <section className="section-padding">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Productos Destacados</h2>
            <div className="section-line"></div>
            <p style={{marginTop:'15px'}}>Explorá nuestros productos de seguridad e higiene industrial más buscados.</p>
          </div>
          
          <div className="prod-grid" style={{position:'relative', zIndex:'1'}}>
            {getProductosDestacados().map((prod) => {
              const cat = CATEGORIAS_PLACEHOLDER.find(c => c.id === prod.categoriaId);
              return (
                <Link key={prod.id} href={`/catalogo/producto/${prod.slug}`} className="prod-card">
                  <div className="prod-img-wrap">
                    {prod.imagenes[0] || cat?.imagen ? (
                      <img src={prod.imagenes[0] || cat?.imagen} alt={prod.nombre} />
                    ) : (
                      <div className="prod-img-placeholder">{cat?.icono || "📦"}</div>
                    )}
                    {prod.destacado && <span className="prod-badge">Destacado</span>}
                  </div>
                  <div className="prod-body">
                    <div className="prod-cat">{cat?.nombre}</div>
                    <h3>{prod.nombre}</h3>
                    <p>{prod.descripcionCorta}</p>
                    <span className="prod-cta">Ver detalles →</span>
                  </div>
                </Link>
              );
            })}
          </div>
          
          <div style={{textAlign:'center', marginTop:'40px', position:'relative', zIndex:'1'}}>
            <Link href="/catalogo" className="btn-blue">Ver Todo el Catálogo</Link>
          </div>
        </div>
      </section>

      {/* ===== FULL WIDTH CTA ===== */}
      <section className="full-cta brand-watermark-dark">
        <div className="container full-cta-inner" style={{position:'relative', zIndex:'2'}}>
          <div>
            <div className="full-cta-tag">No deje su seguridad al azar</div>
            <h2>¿Listo para adecuar su empresa a las normas?</h2>
          </div>
          <div style={{display:'flex', gap:'15px', flexWrap:'wrap'}}>
            <Link href="/contacto" className="btn-red">Contactenos Hoy</Link>
            <Link href="/servicios" className="btn-outline-white">Ver Servicios</Link>
          </div>
        </div>
      </section>
    </>
  );
}
