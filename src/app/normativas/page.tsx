import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Normativas | ARIFA – Seguridad e Higiene",
  description: "Normativas vigentes en materia de seguridad e higiene laboral, matafuegos y protección contra incendios que aplican en Córdoba y Argentina.",
};

export default function NormativasPage() {
  return (
    <>
      <div className="page-banner" style={{ background: "linear-gradient(rgba(0,10,30,0.8), rgba(0,10,30,0.8)), url('/banner_normativas.png') center/cover no-repeat" }}>
        <div className="container">
          <h1>Normativas</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Normativas</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Normativa Vigente</h2>
            <div className="section-line"></div>
            <p style={{marginTop:'15px'}}>
              Conocé las principales normativas que regulan la seguridad e higiene laboral y la
              protección contra incendios en Argentina y la Provincia de Córdoba.
            </p>
          </div>

          <div className="normativa-grid">
            <div className="normativa-card">
              <h2>Seguridad e Higiene Laboral</h2>
              <p>
                La legislación vigente en materia de seguridad e higiene laboral establece las
                obligaciones de los empleadores para garantizar condiciones de trabajo seguras
                y saludables para todos los trabajadores.
              </p>
              <p>Las principales normas que regulan esta actividad son:</p>
              <ul>
                <li><strong>Ley 19.587</strong> – Higiene y Seguridad en el Trabajo (Nacional)</li>
                <li><strong>Decreto 351/79</strong> – Reglamentación de la Ley 19.587</li>
                <li><strong>Ley 24.557</strong> – Riesgos del Trabajo (ART)</li>
                <li><strong>Decreto 1338/96</strong> – Servicios de Medicina y Seguridad en el Trabajo</li>
                <li><strong>Resolución SRT 37/2010</strong> – Programa de Seguridad para Obras de Construcción</li>
                <li><strong>Resolución SRT 463/2009</strong> – Plan de Mejoras de Seguridad</li>
                <li><strong>Ley Provincial 8015</strong> – Higiene y Seguridad Industrial (Córdoba)</li>
              </ul>
            </div>

            <div className="normativa-card">
              <h2>Matafuegos y Extintores</h2>
              <p>
                La legislación vigente establece que para garantizar su buen funcionamiento, es necesario
                realizar el mantenimiento de los matafuegos una vez al año y controlar periódicamente el
                estado de los equipos, mediante una empresa habilitada.
              </p>
              <p>Deben hacerse como mínimo cuatro controles anuales:</p>
              <ul>
                <li><strong>Ordenanza Municipal vigente</strong> – Ciudad de Córdoba</li>
                <li><strong>Decreto 4992/90</strong> – Provincia de Bs. As. (referencia)</li>
                <li><strong>Norma IRAM 3517 I y II</strong> – Extintores a nivel Nacional</li>
                <li><strong>Ley 2231</strong> – Registro de Fabricantes, Reparadores y Recargadores de Extintores</li>
                <li><strong>IRAM 3517-II</strong> – Mantenimiento y recarga de matafuegos</li>
              </ul>
            </div>

            <div className="normativa-card">
              <h2>Instalaciones Fijas Contra Incendios</h2>
              <p>
                Todos los establecimientos deben realizar el mantenimiento periódico de las instalaciones
                contra incendio que poseen. Solo podrán hacerlo mediante una empresa habilitada, de acuerdo
                al nivel de instalación que posean.
              </p>
              <ul>
                <li><strong>Código de Edificación – Ciudad de Córdoba</strong></li>
                <li><strong>Decreto 351/79 Anexo VII</strong> – Protección Contra Incendios</li>
                <li><strong>Norma IRAM 3501</strong> – Certificación de instalaciones nuevas</li>
                <li><strong>Norma IRAM 3619</strong> – Evaluación Técnica de Instalaciones</li>
                <li><strong>NFPA 13</strong> – Instalación de Sistemas de Rociadores</li>
                <li><strong>NFPA 14</strong> – Tuberías Verticales y Mangueras</li>
                <li><strong>NFPA 25</strong> – Protección contra incendio a base de agua</li>
                <li><strong>NFPA 72</strong> – Código Nacional de Alarmas de Incendio</li>
                <li><strong>NFPA 2001</strong> – Sistemas de gases limpios</li>
              </ul>
            </div>

            <div className="normativa-card">
              <h2>Evacuación de Emergencias</h2>
              <p>
                Se debe crear un Plan de Evacuación y Simulacro en casos de incendio, que planifique y organice
                la manera en que las personas deben actuar ante una situación de riesgo.
              </p>
              <p>
                Será de aplicación obligatoria en edificios públicos y privados, oficinas, escuelas, hospitales
                y en todos los establecimientos con atención al público.
              </p>
              <ul>
                <li><strong>Decreto 351/79 Anexo VII</strong> – Medios de egreso</li>
                <li><strong>Ley 5920 Córdoba</strong> – Sistema de Autoprotección (ex Ley 1346)</li>
                <li><strong>Ordenanza Municipal</strong> – Señalización de Medios de Salida</li>
                <li><strong>Norma IRAM 3517-II</strong> – Aplicable a ambos distritos</li>
                <li><strong>NFPA 101</strong> – Código de Seguridad Humana</li>
              </ul>
            </div>

            <div className="normativa-card">
              <h2>Ingeniería y Obras</h2>
              <p>
                Para la realización de instalaciones fijas contra incendio nuevas, o la modificación de las
                existentes, deben cumplirse una serie de normas técnicas específicas.
              </p>
              <ul>
                <li><strong>Código de Edificación de Córdoba</strong></li>
                <li><strong>Norma IRAM 3501</strong> – Instalaciones nuevas y auditoras</li>
                <li><strong>Norma IRAM 3619</strong> – Instalaciones existentes</li>
                <li><strong>NFPA 13</strong> – Sistema de Rociadores</li>
                <li><strong>NFPA 16</strong> – Rociadores de agua y espuma</li>
                <li><strong>Reglamentaciones de colegios profesionales vigentes</strong></li>
              </ul>
            </div>

            <div className="normativa-card">
              <h2>Carga de Fuego y Planimetrías</h2>
              <p>
                El cálculo de carga de fuego es un requisito exigido por las ART, municipalidades y
                aseguradoras para verificar que el grado de riesgo de un establecimiento esté correctamente
                identificado y que las medidas de protección sean las adecuadas.
              </p>
              <ul>
                <li><strong>Decreto 351/79 Anexo VII</strong> – Cálculo de carga de fuego</li>
                <li><strong>Resolución SRT vigente</strong> – Documentación ART</li>
                <li><strong>Ordenanzas Municipales de Córdoba</strong></li>
                <li><strong>Códigos de edificación provinciales</strong></li>
                <li><strong>Normas IRAM aplicables según rubro</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="full-cta">
        <div className="container full-cta-inner">
          <div>
            <div className="full-cta-tag">¿Necesitás cumplir con la normativa?</div>
            <h2>Te asesoramos sin cargo. Consultanos ahora.</h2>
          </div>
          <Link href="/contacto" className="btn-red">Contactenos</Link>
        </div>
      </section>
    </>
  );
}
