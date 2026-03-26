import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Código de Ética | ARIFA",
  description: "Conocé los valores éticos y el código de conducta que guían el trabajo de ARIFA en materia de seguridad e higiene laboral.",
};

export default function EticaPage() {
  return (
    <>
      <div className="page-banner">
        <div className="container">
          <h1>Código de Ética</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href="/la-empresa">La Empresa</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Código de Ética</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container">
          <div className="ethics-content">
            <h2>Nuestro Compromiso Ético</h2>
            <div className="section-bar"></div>
            <p>
              En ARIFA, el ejercicio de nuestra profesión está guiado por un conjunto de principios
              éticos que nos comprometemos a respetar en cada una de nuestras actuaciones. Estos
              valores son la base de las relaciones que construimos con nuestros clientes, colaboradores
              y con la sociedad en general.
            </p>

            <h3>1. Integridad y Honestidad</h3>
            <p>
              Actuamos con total transparencia en nuestras relaciones comerciales y profesionales.
              Brindamos información veraz y precisa sobre el estado de las instalaciones y los
              servicios que ofrecemos, sin omitir datos relevantes que puedan afectar la seguridad
              de las personas o las propiedades.
            </p>

            <h3>2. Independencia y Objetividad</h3>
            <p>
              Nuestras evaluaciones, auditorías e informes técnicos son elaborados con total
              objetividad e independencia de criterio. No nos vemos influenciados por intereses
              comerciales que puedan comprometer la veracidad de nuestras recomendaciones.
            </p>

            <h3>3. Confidencialidad</h3>
            <p>
              Nos comprometemos a mantener la confidencialidad de toda la información que nos sea
              confiada por nuestros clientes en el marco de la prestación de nuestros servicios,
              utilizando dicha información únicamente para los fines para los cuales nos fue proporcionada.
            </p>

            <h3>4. Responsabilidad Profesional</h3>
            <p>
              Asumimos plena responsabilidad por la calidad de nuestros servicios y el cumplimiento
              de las normativas vigentes. Nuestro equipo profesional actúa con la debida diligencia
              y competencia técnica requerida para cada servicio.
            </p>
            <ul>
              <li>Cumplimiento estricto de las normativas legales vigentes</li>
              <li>Actualización permanente en materia de seguridad e higiene</li>
              <li>Elaboración de informes técnicos precisos y completos</li>
              <li>Comunicación oportuna de riesgos detectados</li>
            </ul>

            <h3>5. Respeto por las Personas y el Medio Ambiente</h3>
            <p>
              Toda nuestra actuación está orientada a proteger la vida y la salud de las personas,
              así como el cuidado del medio ambiente. Promovemos prácticas sostenibles y responsables
              en todas las organizaciones con las que trabajamos.
            </p>

            <h3>6. Mejora Continua</h3>
            <p>
              Nos comprometemos con la mejora continua de nuestros procesos, servicios y conocimientos.
              Buscamos permanentemente la excelencia en la prestación de nuestros servicios, invirtiendo
              en la formación de nuestro equipo y en la adopción de las mejores prácticas del sector.
            </p>

            <h3>7. Equidad y No Discriminación</h3>
            <p>
              Tratamos a todos nuestros clientes, colaboradores y stakeholders con igualdad y respeto,
              sin distinción de género, origen, religión, ideología u otras características personales.
              Fomentamos un ambiente de trabajo inclusivo y respetuoso.
            </p>

            <div style={{marginTop:'40px', padding:'30px', background:'var(--bg-light)', borderRadius:'4px', borderLeft:'4px solid var(--primary-red)'}}>
              <p style={{fontStyle:'italic', color:'var(--primary-blue)', fontWeight:600, fontSize:'1.05rem', marginBottom:0}}>
                "El compromiso de ARIFA con la ética profesional no es solo una declaración: es la
                forma en que trabajamos todos los días, en cada servicio que brindamos."
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="full-cta">
        <div className="container full-cta-inner">
          <div>
            <div className="full-cta-tag">¿Querés trabajar con un equipo comprometido?</div>
            <h2>Contactanos y conocé cómo podemos ayudarte</h2>
          </div>
          <Link href="/contacto" className="btn-red">Contactenos</Link>
        </div>
      </section>
    </>
  );
}
