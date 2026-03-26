import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

// ---- SERVICE DATA ----
const SERVICES: Record<string, {
  title: string;
  subtitle: string;
  description: string[];
  points: string[];
  related: { label: string; href: string }[];
}> = {
  "analisis-de-riesgos": {
    title: "Análisis y Evaluación de Riesgos",
    subtitle: "Seguridad e Higiene Laboral",
    description: [
      "El análisis y evaluación de riesgos es el proceso mediante el cual identificamos, clasificamos y priorizamos los peligros presentes en el ambiente de trabajo, determinando las medidas preventivas más adecuadas para eliminarlos o reducirlos.",
      "Realizamos un relevamiento exhaustivo de todas las instalaciones, equipos, materiales y procesos de trabajo, identificando los factores de riesgo físico, químico, eléctrico, mecánico y ergonómico presentes en el establecimiento.",
      "El resultado es un informe técnico detallado que incluye la identificación de todos los riesgos, su nivel de gravedad y las medidas de corrección y prevención recomendadas, con plazos de implementación y responsables asignados.",
    ],
    points: [
      "Relevamiento e inspección de instalaciones y procesos",
      "Identificación y clasificación de factores de riesgo",
      "Evaluación de la probabilidad y severidad de cada riesgo",
      "Elaboración de matriz de riesgos",
      "Propuesta de medidas preventivas y correctivas",
      "Seguimiento de la implementación de mejoras",
      "Informes para ART y organismos de control",
    ],
    related: [
      { label: "Medición de Contaminantes", href: "/servicios/medicion-contaminantes" },
      { label: "Capacitación al Personal", href: "/servicios/capacitacion-personal" },
      { label: "Auditorías e Inspecciones", href: "/servicios/auditorias" },
    ],
  },
  "capacitacion-personal": {
    title: "Capacitación al Personal",
    subtitle: "Capacitaciones",
    description: [
      "La capacitación en seguridad e higiene laboral es una obligación legal del empleador y una inversión fundamental para la prevención de accidentes. Personal capacitado actúa correctamente ante emergencias, reduciendo los riesgos para las personas y la empresa.",
      "Desarrollamos programas de capacitación personalizados para cada empresa y rubro, utilizando metodologías didácticas adecuadas para cada tipo de personal: operarios, técnicos, supervisores y directivos.",
      "Nuestras capacitaciones son realizadas por profesionales con amplía experiencia en el campo, combinando aspectos teóricos y prácticos para garantizar un aprendizaje efectivo y duradero.",
    ],
    points: [
      "Capacitación en prevención y lucha contra incendios",
      "Uso correcto de matafuegos y equipos de protección",
      "Formación de brigadas de emergencia",
      "Evacuación y actuación ante emergencias",
      "Primeros auxilios básicos y RCP",
      "Manejo de materiales peligrosos (MATPEL)",
      "Seguridad vial y manejo defensivo",
      "Certificados de participación para cada asistente",
    ],
    related: [
      { label: "Planes de Evacuación", href: "/servicios/planes-evacuacion" },
      { label: "Análisis de Riesgos", href: "/servicios/analisis-de-riesgos" },
      { label: "Auditorías e Inspecciones", href: "/servicios/auditorias" },
    ],
  },
  "investigacion-siniestros": {
    title: "Investigación de Siniestros",
    subtitle: "Seguridad e Higiene Laboral",
    description: [
      "La investigación de siniestros laborales permite determinar las causas de un accidente o enfermedad profesional, para implementar medidas correctivas que prevengan su recurrencia.",
      "Aplicamos metodologías científicas de análisis causal, como el método del árbol de causas y el análisis de barreras, para identificar todos los factores que contribuyeron al siniestro.",
      "El informe de investigación es un documento técnico requerido por la ART y los organismos de control, que debe estar disponible en el establecimiento.",
    ],
    points: [
      "Relevamiento e inspección del lugar del siniestro",
      "Entrevistas a testigos y personal involucrado",
      "Análisis de causas mediante métodos científicos",
      "Árbol de causas y diagramas de análisis",
      "Identificación de causas inmediatas y básicas",
      "Propuesta de medidas correctivas y preventivas",
      "Elaboración del informe técnico para ART",
    ],
    related: [
      { label: "Análisis de Riesgos", href: "/servicios/analisis-de-riesgos" },
      { label: "Capacitación al Personal", href: "/servicios/capacitacion-personal" },
    ],
  },
  "medicion-contaminantes": {
    title: "Medición de Contaminantes",
    subtitle: "Seguridad e Higiene Laboral",
    description: [
      "La medición y evaluación de agentes contaminantes del ambiente de trabajo (físicos, químicos y biológicos) permite determinar si los niveles presentes superan los valores límites permisibles establecidos por la normativa.",
      "Realizamos mediciones de ruido, vibración, iluminación, temperatura, humedad, agentes químicos (vapores, gases, polvos) y otros parámetros según las características del establecimiento.",
      "Los resultados son comparados con los valores límites establecidos por la Resolución SRT 295/03 y otras normativas aplicables, elaborando el informe técnico correspondiente.",
    ],
    points: [
      "Medición de ruido y determinación de dosis de exposición",
      "Evaluación de iluminación en puestos de trabajo",
      "Medición de temperatura, humedad y ventilación",
      "Detección y cuantificación de agentes químicos",
      "Evaluación ergonómica de puestos de trabajo",
      "Medición de vibraciones de cuerpo entero y mano-brazo",
      "Informe técnico con valores medidos y comparativa normativa",
    ],
    related: [
      { label: "Análisis de Riesgos", href: "/servicios/analisis-de-riesgos" },
      { label: "Auditorías e Inspecciones", href: "/servicios/auditorias" },
    ],
  },
  "matafuegos": {
    title: "Mantenimiento de Matafuegos",
    subtitle: "Protección Contra Incendios",
    description: [
      "El mantenimiento periódico de matafuegos es una obligación legal establecida por la normativa vigente. Debe realizarse una vez al año por una empresa habilitada y controlarse periódicamente cada 90 días como máximo.",
      "Realizamos el mantenimiento completo de todos los tipos de matafuegos: polvo químico seco, CO2, agua, espuma y halones. Nuestro servicio incluye la inspección, recarga, prueba hidráulica y señalización.",
      "Al finalizar el servicio, colocamos la tarjeta de control con la fecha del próximo mantenimiento y entregamos el acta de servicio requerida por la normativa.",
    ],
    points: [
      "Inspección y evaluación del estado de cada unidad",
      "Recarga con agente extintor certificado",
      "Prueba hidráulica del cilindro (cada 5 años)",
      "Verificación y reemplazo de sellos y válvulas",
      "Colocación de tarjeta de control actualizada",
      "Acta de servicio para presentar ante ART",
      "Control periódico trimestral incluido",
      "Asesoramiento sobre cantidad y ubicación óptima",
    ],
    related: [
      { label: "Instalaciones Fijas", href: "/servicios/instalaciones-fijas" },
      { label: "Detección y Alarma", href: "/servicios/deteccion-alarma" },
      { label: "Cálculo de Carga de Fuego", href: "/servicios/carga-de-fuego" },
    ],
  },
  "instalaciones-fijas": {
    title: "Instalaciones Fijas Contra Incendio",
    subtitle: "Protección Contra Incendios",
    description: [
      "Las instalaciones fijas contra incendio son sistemas permanentes que actúan automáticamente ante la detección de un incendio. Incluyen redes de agua, rociadores automáticos, sistemas de espuma, gases inertes y más.",
      "Realizamos el mantenimiento de todos los sistemas fijos contra incendios que posea su empresa, asegurando una respuesta eficaz ante el inicio de un eventual siniestro.",
      "El mantenimiento de las instalaciones fijas contra incendio es una obligación legal para todos los establecimientos, y debe ser realizado por una empresa habilitada por los organismos correspondientes.",
    ],
    points: [
      "Mantenimiento de redes de agua contra incendio",
      "Mantenimiento de sistemas de rociadores automáticos",
      "Mantenimiento de sistemas de detección de humo y calor",
      "Mantenimiento de sistemas de espuma",
      "Mantenimiento de sistemas de gases inertes",
      "Mantenimiento de sistemas de cocinas (clase K)",
      "Mantenimiento de bombas contra incendio",
      "Mantenimiento de mangueras y gabinetes",
    ],
    related: [
      { label: "Mantenimiento de Matafuegos", href: "/servicios/matafuegos" },
      { label: "Detección y Alarma", href: "/servicios/deteccion-alarma" },
      { label: "Cálculo de Carga de Fuego", href: "/servicios/carga-de-fuego" },
    ],
  },
  "deteccion-alarma": {
    title: "Detección y Alarma de Incendio",
    subtitle: "Protección Contra Incendios",
    description: [
      "Los sistemas de detección y alarma de incendio permiten detectar el inicio de un siniestro en sus primeras etapas, alertar a los ocupantes del edificio y activar los mecanismos de respuesta.",
      "Instalamos y realizamos el mantenimiento de sistemas de detección de humo, calor y gases, centrales de alarma, sistemas de evacuación, comunicadores y más.",
      "El mantenimiento preventivo y correctivo de estos sistemas es fundamental para garantizar su funcionamiento ante una emergencia real.",
    ],
    points: [
      "Instalación de detectores de humo iónico y fotoeléctrico",
      "Instalación de detectores de calor y flama",
      "Centrales de alarma convencionales y analógicas",
      "Sistemas de evacuación sonora y visual",
      "Mantenimiento preventivo periódico",
      "Pruebas de funcionamiento y certificación",
      "Integración con sistemas de control de acceso",
    ],
    related: [
      { label: "Instalaciones Fijas", href: "/servicios/instalaciones-fijas" },
      { label: "Mantenimiento de Matafuegos", href: "/servicios/matafuegos" },
    ],
  },
  "sistemas-espuma-gases": {
    title: "Sistemas de Espuma y Gases",
    subtitle: "Protección Contra Incendios",
    description: [
      "Los sistemas de extinción por espuma o gases inertes son utilizados en áreas donde el agua no es adecuada o podría causar daños a equipos eléctricos, maquinaria o materiales sensibles.",
      "Realizamos la instalación y mantenimiento de sistemas de espuma AFFF, espuma de alta expansión, sistemas de CO2, agentes limpios (HFCs) y gases inertes (argón, nitrógeno, inergen).",
      "Estos sistemas son especialmente utilizados en cocinas industriales, salas de servidores, depósitos de líquidos inflamables y protección de maquinaria crítica.",
    ],
    points: [
      "Sistemas de espuma AFFF para líquidos inflamables",
      "Sistemas de espuma de alta expansión",
      "Sistemas de CO2 para protección de máquinas",
      "Sistemas de agentes limpios (HFCs, FK-5-1-12)",
      "Sistemas de gases inertes (Argón, IG-541)",
      "Sistemas de supresión para cocinas clase K",
      "Mantenimiento y recarga de todos los sistemas",
    ],
    related: [
      { label: "Instalaciones Fijas", href: "/servicios/instalaciones-fijas" },
      { label: "Mantenimiento de Matafuegos", href: "/servicios/matafuegos" },
    ],
  },
  "planes-evacuacion": {
    title: "Planes de Evacuación y Emergencia",
    subtitle: "Capacitaciones y Documentación",
    description: [
      "El Plan de Evacuación es un documento técnico que establece el procedimiento a seguir ante una emergencia, organizando la evacuación ordenada y segura de todas las personas presentes en el establecimiento.",
      "Es de aplicación obligatoria en edificios públicos y privados, oficinas, escuelas, hospitales y todo establecimiento con atención al público. Debe estar disponible en el establecimiento y ser conocido por todo el personal.",
      "Elaboramos planes de evacuación completos, incluyendo la señalización de vías de escape, puntos de encuentro, responsabilidades del personal y procedimientos de actuación ante diferentes tipos de emergencias.",
    ],
    points: [
      "Relevamiento e inspección completa de las instalaciones",
      "Elaboración del plan de evacuación",
      "Identificación y señalización de vías de escape",
      "Definición de puntos de encuentro",
      "Asignación de roles y responsabilidades",
      "Organización de brigadas de emergencia",
      "Planimetría de señalización de salidas",
      "Simulacro de evacuación y evaluación",
    ],
    related: [
      { label: "Capacitación al Personal", href: "/servicios/capacitacion-personal" },
      { label: "Análisis de Riesgos", href: "/servicios/analisis-de-riesgos" },
      { label: "Carga de Fuego", href: "/servicios/carga-de-fuego" },
    ],
  },
  "carga-de-fuego": {
    title: "Cálculo de Carga de Fuego",
    subtitle: "Capacitaciones y Documentación",
    description: [
      "El cálculo de carga de fuego es un estudio técnico que determina la cantidad de energía calorífica que puede liberar el contenido de un local en caso de incendio, permitiendo clasificar el riesgo del establecimiento.",
      "Es un requisito exigido por las ART, la Superintendencia de Riesgos del Trabajo, las municipalidades y las aseguradoras para verificar que las medidas de protección contra incendio sean las adecuadas.",
      "El informe debe ser elaborado por un profesional habilitado y actualizado cada vez que se produzcan cambios significativos en el establecimiento (cambio de actividad, ampliación, modificación de materiales, etc.).",
    ],
    points: [
      "Relevamiento de materiales combustibles presentes",
      "Cálculo del potencial calorífico por sector",
      "Clasificación del riesgo de incendio (riesgo bajo, moderado, alto, muy alto)",
      "Verificación de medios de extinción requeridos",
      "Informe técnico habilitante para ART",
      "Memorial de cálculo completo con valores",
      "Actualización ante modificaciones del establecimiento",
    ],
    related: [
      { label: "Planes de Evacuación", href: "/servicios/planes-evacuacion" },
      { label: "Planimetrías", href: "/servicios/planimetrias" },
      { label: "Mantenimiento de Matafuegos", href: "/servicios/matafuegos" },
    ],
  },
  "auditorias": {
    title: "Auditorías Contra Incendios",
    subtitle: "Seguridad e Higiene Laboral",
    description: [
      "Las auditorías de seguridad contra incendios son un proceso de evaluación sistemática del estado de las instalaciones y sistemas de protección, con el objetivo de verificar su conformidad con la normativa vigente.",
      "Realizamos auditorías internas y externas, evaluando el estado de los matafuegos, los sistemas fijos, la señalización, las vías de escape, los planes de emergencia y la capacitación del personal.",
      "Al finalizar, entregamos un informe detallado con las no conformidades detectadas, su grado de criticidad y las recomendaciones de mejora con plazos sugeridos para su implementación.",
    ],
    points: [
      "Inspección visual de todos los sistemas de protección",
      "Evaluación del estado de matafuegos e instalaciones",
      "Verificación de señalización y vías de escape",
      "Revisión de documentación técnica disponible",
      "Evaluación de la capacitación del personal",
      "Informe de auditoría con no conformidades",
      "Recomendaciones de mejora priorizadas",
    ],
    related: [
      { label: "Análisis de Riesgos", href: "/servicios/analisis-de-riesgos" },
      { label: "Mantenimiento de Matafuegos", href: "/servicios/matafuegos" },
      { label: "Planes de Evacuación", href: "/servicios/planes-evacuacion" },
    ],
  },
  "planimetrias": {
    title: "Planimetrías de Seguridad",
    subtitle: "Capacitaciones y Documentación",
    description: [
      "Las planimetrías de seguridad son planos técnicos que grafican la distribución de los medios de protección contra incendio, las vías de evacuación y la señalización de salidas de un establecimiento.",
      "Son un requisito exigido por la normativa vigente y deben estar disponibles en el establecimiento, estratégicamente ubicadas para que todo el personal conozca las vías de escape y la ubicación de los medios de extinción.",
      "Elaboramos planimetrías completas en formato digital e impreso, incluyendo la distribución de matafuegos, gabinetes, detectores, señalización y vías de evacuación, adaptadas a la geometría de cada establecimiento.",
    ],
    points: [
      "Relevamiento in situ del establecimiento",
      "Elaboración de plano de planta a escala",
      "Ubicación de todos los medios de extinción",
      "Señalización de vías de escape y salidas",
      "Indicación de puntos de encuentro",
      "Identificación de zonas de riesgo",
      "Entrega en formato digital e impreso",
      "Actualización ante obras o modificaciones",
    ],
    related: [
      { label: "Planes de Evacuación", href: "/servicios/planes-evacuacion" },
      { label: "Carga de Fuego", href: "/servicios/carga-de-fuego" },
    ],
  },
};

const ALL_SERVICES = [
  { label: "Análisis de Riesgos", href: "/servicios/analisis-de-riesgos" },
  { label: "Capacitación Personal", href: "/servicios/capacitacion-personal" },
  { label: "Investigación de Siniestros", href: "/servicios/investigacion-siniestros" },
  { label: "Medición de Contaminantes", href: "/servicios/medicion-contaminantes" },
  { label: "Mantenimiento de Matafuegos", href: "/servicios/matafuegos" },
  { label: "Instalaciones Fijas", href: "/servicios/instalaciones-fijas" },
  { label: "Detección y Alarma", href: "/servicios/deteccion-alarma" },
  { label: "Sistemas Espuma y Gases", href: "/servicios/sistemas-espuma-gases" },
  { label: "Planes de Evacuación", href: "/servicios/planes-evacuacion" },
  { label: "Carga de Fuego", href: "/servicios/carga-de-fuego" },
  { label: "Auditorías", href: "/servicios/auditorias" },
  { label: "Planimetrías", href: "/servicios/planimetrias" },
];

type Props = { params: { slug: string } };

export async function generateStaticParams() {
  return Object.keys(SERVICES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const svc = SERVICES[(await params).slug];
  if (!svc) return { title: "Servicio | ARIFA" };
  return {
    title: `${svc.title} | ARIFA`,
    description: svc.description[0].slice(0, 160),
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const slug = (await params).slug;
  const svc = SERVICES[slug];
  if (!svc) notFound();

  return (
    <>
      <div className="page-banner">
        <div className="container">
          <h1>{svc.title}</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href="/servicios">Servicios</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{svc.title}</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container">
          <div className="service-detail-grid">
            {/* Main content */}
            <div className="service-detail-content">
              <div style={{color:'var(--primary-red)', fontSize:'0.82rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px'}}>
                {svc.subtitle}
              </div>
              <h2>{svc.title}</h2>
              <div className="section-bar" style={{margin:'18px 0 22px'}}></div>

              {svc.description.map((p, i) => <p key={i}>{p}</p>)}

              <h3>¿Qué incluye este servicio?</h3>
              <ul>
                {svc.points.map((pt, i) => <li key={i}>{pt}</li>)}
              </ul>

              <div style={{marginTop:'35px', background:'var(--bg-light)', padding:'28px', borderRadius:'4px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'20px', flexWrap:'wrap'}}>
                <div>
                  <p style={{fontWeight:700, color:'var(--primary-blue)', marginBottom:'4px'}}>¿Necesitás este servicio?</p>
                  <p style={{color:'var(--text-muted)', fontSize:'0.9rem', margin:0}}>Contactanos y un asesor te responderá a la brevedad.</p>
                </div>
                <Link href="/contacto" className="btn-red">Solicitar Cotización</Link>
              </div>
            </div>

            {/* Sidebar */}
            <div className="service-sidebar">
              <h3>Todos los Servicios</h3>
              <ul className="sidebar-link-list">
                {ALL_SERVICES.map((s) => (
                  <li key={s.href}>
                    <Link href={s.href} style={slug === s.href.split('/')[2] ? {color:'var(--primary-red)'} : undefined}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div style={{marginTop:'28px', background:'var(--primary-red)', padding:'24px', borderRadius:'4px', color:'#fff', textAlign:'center'}}>
                <p style={{fontWeight:700, marginBottom:'8px', fontSize:'1rem'}}>¿Tenés alguna consulta?</p>
                <p style={{fontSize:'0.88rem', opacity:0.9, marginBottom:'18px'}}>Contactanos ahora y te asesoramos sin cargo.</p>
                <a href="tel:+5493512449504" style={{color:'#fff', fontWeight:800, fontSize:'1.1rem', display:'block', marginBottom:'8px'}}>
                  351 244-9504
                </a>
                <a href="https://wa.me/5493512449504" target="_blank" rel="noopener noreferrer" style={{display:'inline-block', background:'#25D366', color:'#fff', padding:'8px 20px', borderRadius:'4px', fontSize:'0.85rem', fontWeight:700}}>
                  WhatsApp
                </a>
              </div>

              {svc.related.length > 0 && (
                <div style={{marginTop:'24px'}}>
                  <h3>Servicios Relacionados</h3>
                  <ul className="sidebar-link-list">
                    {svc.related.map((r) => (
                      <li key={r.href}>
                        <Link href={r.href}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
                          {r.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
