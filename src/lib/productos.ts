// ============================================================
// TIPOS DE DATOS — Diseñados para Firebase/Firestore
// Cuando se integre Firebase, estos datos vendrán de:
//   - Colección: /categorias
//   - Colección: /productos
// ============================================================

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string;
  icono: string;        // emoji o URL de imagen
  imagen?: string;      // URL de imagen (Firebase Storage)
  orden: number;
  activa: boolean;
  creadaEn?: string;
  actualizadaEn?: string;
}

export interface Producto {
  id: string;
  nombre: string;
  slug: string;
  categoriaId: string;  // referencia a Categoria.id
  descripcion: string;
  descripcionCorta: string;
  precio?: number;      // opcional, puede no mostrarse
  imagenes: string[];   // URLs de Firebase Storage
  destacado: boolean;
  activo: boolean;
  caracteristicas: { clave: string; valor: string }[];
  tags?: string[];
  orden?: number;
  creadoEn?: string;
  actualizadoEn?: string;
}

// ============================================================
// DATOS PLACEHOLDER — Se reemplazarán con Firebase en el futuro
// ============================================================

export const CATEGORIAS_PLACEHOLDER: Categoria[] = [
  {
    id: "cat-matafuegos",
    nombre: "Matafuegos",
    slug: "matafuegos",
    descripcion: "Extintores portátiles de todos los tipos: polvo ABC, CO2, HCFC, agua y espuma. Para uso doméstico, comercial e industrial.",
    icono: "🧯",
    imagen: "/matafuegos.png",
    orden: 1,
    activa: true,
  },
  {
    id: "cat-deteccion",
    nombre: "Detectores y Alarmas",
    slug: "detectores-alarmas",
    descripcion: "Detectores de humo, calor y gas. Centrales de alarma y señalizadores de emergencia.",
    icono: "🔔",
    imagen: "/deteccion.png",
    orden: 2,
    activa: true,
  },
  {
    id: "cat-senalizacion",
    nombre: "Señalización",
    slug: "senalizacion",
    descripcion: "Carteles fotoluminiscentes y LED de salidas de emergencia, rutas de evacuación y zonas de riesgo.",
    icono: "🚨",
    imagen: "/senalizacion.png",
    orden: 3,
    activa: true,
  },
  {
    id: "cat-rociadores",
    nombre: "Rociadores y Sprinklers",
    slug: "rociadores-sprinklers",
    descripcion: "Rociadores automáticos, sprinklers y carcasas para sistemas de extinción a base de agua.",
    icono: "💧",
    imagen: "/deteccion.png",
    orden: 4,
    activa: true,
  },
  {
    id: "cat-mangueras",
    nombre: "Mangueras y Accesorios",
    slug: "mangueras-accesorios",
    descripcion: "Mangueras contra incendio, lanzas, boquillas, válvulas y gabinetes de incendio.",
    icono: "🔧",
    imagen: "/mangueras.png",
    orden: 5,
    activa: true,
  },
  {
    id: "cat-epp",
    nombre: "Equipos de Protección Personal",
    slug: "equipos-proteccion-personal",
    descripcion: "Cascos, guantes, calzado de seguridad, arneses, gafas y ropa de trabajo para protección del personal.",
    icono: "⛑️",
    imagen: "/epp.png",
    orden: 6,
    activa: true,
  },
  {
    id: "cat-iluminacion",
    nombre: "Iluminación de Emergencia",
    slug: "iluminacion-emergencia",
    descripcion: "Luces de emergencia LED con autonomía de 18 a 24 hs para garantizar la seguridad en cortes de energía.",
    icono: "💡",
    imagen: "/iluminacion.png",
    orden: 7,
    activa: true,
  },
  {
    id: "cat-botiquines",
    nombre: "Botiquines y Primeros Auxilios",
    slug: "botiquines-primeros-auxilios",
    descripcion: "Botiquines de primeros auxilios y reposición de insumos médicos para el ámbito laboral.",
    icono: "🩺",
    imagen: "/botiquines.png",
    orden: 8,
    activa: true,
  },
];

export const PRODUCTOS_PLACEHOLDER: Producto[] = [
  // MATAFUEGOS
  {
    id: "prod-mat-polvo-abc-1",
    nombre: "Matafuego Polvo ABC – 1 Kg",
    slug: "matafuego-polvo-abc-1kg",
    categoriaId: "cat-matafuegos",
    descripcion: "Extintor portátil de polvo químico seco ABC de 1 Kg, ideal para uso doméstico y en vehículos. Cumple con Norma IRAM 3517.",
    descripcionCorta: "Extintor portátil de 1 Kg, ideal para hogar y autos.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "Tipo de Agente", valor: "Polvo Químico Seco ABC" },
      { clave: "Capacidad", valor: "1 Kg" },
      { clave: "Clase de Fuego", valor: "A, B, C" },
      { clave: "Norma", valor: "IRAM 3517" },
    ],
  },
  {
    id: "prod-mat-polvo-abc-5",
    nombre: "Matafuego Polvo ABC – 5 Kg",
    slug: "matafuego-polvo-abc-5kg",
    categoriaId: "cat-matafuegos",
    descripcion: "Extintor portátil de polvo químico seco ABC de 5 Kg, apto para oficinas, depósitos y comercios. El más utilizado en establecimientos industriales.",
    descripcionCorta: "Extintor de 5 Kg, el más utilizado en industria y comercio.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "Tipo de Agente", valor: "Polvo Químico Seco ABC" },
      { clave: "Capacidad", valor: "5 Kg" },
      { clave: "Clase de Fuego", valor: "A, B, C" },
      { clave: "Norma", valor: "IRAM 3517" },
      { clave: "Presión", valor: "125 PSI" },
    ],
  },
  {
    id: "prod-mat-co2-5",
    nombre: "Matafuego CO2 – 5 Kg",
    slug: "matafuego-co2-5kg",
    categoriaId: "cat-matafuegos",
    descripcion: "Extintor de CO2 de 5 Kg, sin residuo. Ideal para proteger equipos eléctricos, servidores y tableros. No daña los equipos.",
    descripcionCorta: "Extintor CO2, sin residuo. Ideal para equipos eléctricos.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "Tipo de Agente", valor: "Dióxido de Carbono (CO2)" },
      { clave: "Capacidad", valor: "5 Kg" },
      { clave: "Clase de Fuego", valor: "B, C" },
      { clave: "Residuo", valor: "Sin residuo" },
    ],
  },
  {
    id: "prod-mat-litio",
    nombre: "Matafuego LITIO – Especial Baterías",
    slug: "matafuego-litio-baterias",
    categoriaId: "cat-matafuegos",
    descripcion: "Extintor especial para incendios de baterías de litio. Controla y enfría las celdas evitando el fenómeno de 'thermal runaway'.",
    descripcionCorta: "Extintor especial para incendios de baterías de litio.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "Tipo de Agente", valor: "Agente especial para litio" },
      { clave: "Clase de Fuego", valor: "D (metales)" },
      { clave: "Aplicación", valor: "Baterías de litio, EV, celulares, notebooks" },
    ],
  },
  {
    id: "prod-mat-k-cocinas",
    nombre: "Matafuego Clase K – Cocinas Industriales",
    slug: "matafuego-clase-k-cocinas",
    categoriaId: "cat-matafuegos",
    descripcion: "Extintor de Acetato de Potasio diseñado específicamente para incendios en cocinas comerciales que involucran grasas y aceites vegetales o animales.",
    descripcionCorta: "Especial para cocinas comerciales y aceites.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "Tipo de Agente", valor: "Acetato de Potasio" },
      { clave: "Capacidad", valor: "6 Litros" },
      { clave: "Clase de Fuego", valor: "K" },
      { clave: "Cilindro", valor: "Acero Inoxidable" },
    ],
  },

  // DETECTORES
  {
    id: "prod-det-humo-foto",
    nombre: "Detector de Humo Fotoeléctrico",
    slug: "detector-humo-fotoelectrico",
    categoriaId: "cat-deteccion",
    descripcion: "Detector de humo fotoeléctrico, ideal para detectar humos lentos o de smoldering (combustión lenta sin llama). Alta sensibilidad.",
    descripcionCorta: "Detector fotoeléctrico para humos lentos y combustión lenta.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "Tecnología", valor: "Fotoeléctrica" },
      { clave: "Alimentación", valor: "12V / 24V DC" },
      { clave: "Tipo", valor: "Convencional / Analógico" },
    ],
  },
  {
    id: "prod-central-alarma-4",
    nombre: "Central de Alarma de Incendio – 4 Zonas",
    slug: "central-alarma-incendio-4-zonas",
    categoriaId: "cat-deteccion",
    descripcion: "Panel de control convencional para sistemas de detección de incendio de hasta 4 zonas independientes. Supervisión de líneas y batería.",
    descripcionCorta: "Panel de control para 4 zonas de detección.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "Zonas", valor: "4 Zonas" },
      { clave: "Alimentación", valor: "220V AC / Batería 12V 7Ah" },
      { clave: "Salidas", valor: "Sirena, Relé de Auxiliar" },
    ],
  },
  {
    id: "prod-pulsador-incendio",
    nombre: "Pulsador de Alarma de Incendio",
    slug: "pulsador-alarma-incendio",
    categoriaId: "cat-deteccion",
    descripcion: "Aviso manual de incendio con vidrio rompible o sistema rearmable. Color rojo normalizado, fácil identificación.",
    descripcionCorta: "Aviso manual de emergencia con sistema rompible.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "Tipo", valor: "Manual / Rompible" },
      { clave: "Color", valor: "Rojo (RAL 3000)" },
      { clave: "Montaje", valor: "Superficie / Embutir" },
    ],
  },

  // SEÑALIZACIÓN
  {
    id: "prod-sen-salida-led",
    nombre: "Señalizador LED – Salida de Emergencia",
    slug: "senalizador-led-salida-emergencia",
    categoriaId: "cat-senalizacion",
    descripcion: "Señalizador LED iluminado para salida de emergencia. Alta luminosidad, bajo consumo. Homologado según normativa vigente.",
    descripcionCorta: "Cartel LED iluminado de 'Salida de Emergencia'.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "Tipo", valor: "LED iluminado" },
      { clave: "Alimentación", valor: "220V AC" },
      { clave: "Autonomía batería", valor: "18 hs" },
      { clave: "Norma", valor: "IRAM / Ordenanza vigente" },
    ],
  },
  {
    id: "prod-sen-foto-salida",
    nombre: "Cartel Fotoluminiscente – Salida",
    slug: "cartel-fotoluminiscente-salida",
    categoriaId: "cat-senalizacion",
    descripcion: "Cartel fotoluminiscente de PVC rígido para señalización de salidas, rutas de evacuación y equipos contra incendio.",
    descripcionCorta: "Cartel fotoluminiscente para señalización de emergencia.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "Material", valor: "PVC rígido fotoluminiscente" },
      { clave: "Norma", valor: "IRAM 10005-1" },
      { clave: "Disponible en", valor: "Varios tamaños" },
    ],
  },

  // ROCIADORES
  {
    id: "prod-roc-sprinkler-vidrio",
    nombre: "Rociador Automático – Bulbo de Vidrio 68°C",
    slug: "rociador-automatico-68c",
    categoriaId: "cat-rociadores",
    descripcion: "Rociador automático tipo bulbo de vidrio color rojo, temperatura de activación 68°C. Para instalaciones residenciales e industriales.",
    descripcionCorta: "Sprinkler automático bulbo rojo, activación a 68°C.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "Tipo", valor: "Bulbo de vidrio" },
      { clave: "Temperatura", valor: "68°C" },
      { clave: "Color bulbo", valor: "Rojo" },
      { clave: "Rosca", valor: "1/2\" NPT" },
    ],
  },
  {
    id: "prod-roc-escudo",
    nombre: "Escudo para Rociador",
    slug: "escudo-para-rociador",
    categoriaId: "cat-rociadores",
    descripcion: "Escudo embellecedor para rociadores de incendio. Protege y mejora la estética en cielorrasos.",
    descripcionCorta: "Escudo protector y decorativo para rociadores.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "Material", valor: "Acero Cromado / Blanco" },
      { clave: "Tipo", valor: "Circular" },
    ],
  },

  // MANGUERAS
  {
    id: "prod-mang-44",
    nombre: "Manguera de Incendio 44.5mm – 30 mts",
    slug: "manguera-incendio-44mm-30m",
    categoriaId: "cat-mangueras",
    descripcion: "Manguera de incendio NBR 44.5 mm de diámetro por 30 metros de longitud. Certificada bajo Norma IRAM 3594. Alta resistencia a la abrasión.",
    descripcionCorta: "Manguera NBR 44.5mm x 30m certificada IRAM 3594.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "Diámetro", valor: "44.5 mm (1 3/4\")" },
      { clave: "Longitud", valor: "30 metros" },
      { clave: "Material", valor: "NBR sintético" },
      { clave: "Norma", valor: "IRAM 3594" },
    ],
  },
  {
    id: "prod-gab-incendio",
    nombre: "Gabinete Metálico para Manguera",
    slug: "gabinete-metalico-incendio",
    categoriaId: "cat-mangueras",
    descripcion: "Gabinete de chapa para manguera de 44.5mm. Pintura epoxi roja antioxido. Cierre con manija o cerradura.",
    descripcionCorta: "Gabinete de chapa para protección de mangueras.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "Material", valor: "Chapa de acero" },
      { clave: "Pintura", valor: "Epoxi Roja" },
      { clave: "Medidas", valor: "60 x 60 x 20 cm" },
    ],
  },
  {
    id: "prod-lanza-bronce",
    nombre: "Lanza de Chorro/Niebla – Bronce",
    slug: "lanza-chorro-niebla-bronce",
    categoriaId: "cat-mangueras",
    descripcion: "Boquilla de bronce de 3 posiciones: chorro pleno, niebla y cierre. Ideal para control de incendios industrial.",
    descripcionCorta: "Boquilla de bronce regulable para manguera.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "Material", valor: "Bronce macizo" },
      { clave: "Posiciones", valor: "Cierre / Niebla / Chorro" },
      { clave: "Conexión", valor: "Mandrilada o a rosca" },
    ],
  },

  // EPP
  {
    id: "prod-epp-casco",
    nombre: "Casco de Seguridad Industrial",
    slug: "casco-seguridad-industrial",
    categoriaId: "cat-epp",
    descripcion: "Casco de protección craneana de polietileno de alta densidad. Suspensión ajustable con rachet. Ranuras para protectores auditivos.",
    descripcionCorta: "Casco protector de alta resistencia con rachet.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "Material", valor: "Polietileno de Alta Densidad" },
      { clave: "Ajuste", valor: "Sistema Rachet" },
      { clave: "Norma", valor: "IRAM 3620" },
    ],
  },
  {
    id: "prod-epp-guantes-vaqueta",
    nombre: "Guantes de Vaqueta – Trabajo Pesado",
    slug: "guantes-vaqueta-trabajo",
    categoriaId: "cat-epp",
    descripcion: "Guantes de cuero vaqueta de primera calidad. Excelente flexibilidad y resistencia a la abrasión. Ideal para tareas generales.",
    descripcionCorta: "Guantes de cuero de alta calidad y resistencia.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "Material", valor: "Cuero Vaqueta" },
      { clave: "Talle", valor: "Único (Standar)" },
      { clave: "Uso", valor: "Mantenimiento, Construcción, Carga" },
    ],
  },
  {
    id: "prod-epp-chaleco",
    nombre: "Chaleco de Seguridad Reflectivo",
    slug: "chaleco-seguridad-reflectivo",
    categoriaId: "cat-epp",
    descripcion: "Chaleco de alta visibilidad con bandas reflectivas textiles. Cierre con abrojo. Ideal para personal vial o depósitos.",
    descripcionCorta: "Chaleco de alta visibilidad con bandas reflectivas.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "Material", valor: "Poliéster" },
      { clave: "Color", valor: "Naranja / Amarillo Fluor" },
      { clave: "Reflectivos", valor: "2 Bandas horizontales" },
    ],
  },
  {
    id: "prod-epp-botas",
    nombre: "Botas de Seguridad – Puntera de Acero",
    slug: "botas-seguridad-puntera-acero",
    categoriaId: "cat-epp",
    descripcion: "Calzado de seguridad de cuero flor con puntera de acero certificada. Suela de poliuretano bidensidad, antideslizante y resistente a hidrocarburos.",
    descripcionCorta: "Calzado de seguridad con puntera de acero y suela antideslizante.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "Material", valor: "Cuero Flor" },
      { clave: "Puntera", valor: "Acero" },
      { clave: "Suela", valor: "PU Bidensidad" },
      { clave: "Certificación", valor: "IRAM 3610" },
    ],
  },
  {
    id: "prod-epp-anteojos",
    nombre: "Anteojos de Seguridad – Anti-empañante",
    slug: "anteojos-seguridad-antiempanante",
    categoriaId: "cat-epp",
    descripcion: "Anteojos de protección ocular con lentes de policarbonato. Tratamiento anti-rayadura y anti-empañante. Patillas ajustables.",
    descripcionCorta: "Protección ocular de policarbonato con tratamiento anti-empañante.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "Lente", valor: "Policarbonato Incoloro" },
      { clave: "Tratamiento", valor: "Anti-empañante / Anti-rayadura" },
      { clave: "Norma", valor: "ANSI Z87.1" },
    ],
  },

  // ILUMINACIÓN
  {
    id: "prod-luz-em-30led",
    nombre: "Luz de Emergencia 30 LED – 18/24hs Autonomía",
    slug: "luz-emergencia-30led",
    categoriaId: "cat-iluminacion",
    descripcion: "Luz de emergencia con 30 LEDs de alto brillo y batería recargable de autonomía 18 a 24 hs. Para pasillos, escaleras y salidas.",
    descripcionCorta: "Luz de emergencia LED 30W con 18/24hs de autonomía.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "LEDs", valor: "30 LEDs de alto brillo" },
      { clave: "Autonomía", valor: "18 a 24 horas" },
      { clave: "Alimentación", valor: "220V AC" },
      { clave: "Recarga", valor: "Automática al retornar la energía" },
    ],
  },
  {
    id: "prod-luz-em-60led",
    nombre: "Luz de Emergencia 60 LED – Alto Brillo",
    slug: "luz-emergencia-60led",
    categoriaId: "cat-iluminacion",
    descripcion: "Equipo de iluminación de emergencia de gran potencia, ideal para depósitos y áreas de gran superficie. 60 LEDs de alta intensidad.",
    descripcionCorta: "Equipo de gran potencia para áreas extensas.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "LEDs", valor: "60 LEDs SMD" },
      { clave: "Autonomía", valor: "10-12 horas" },
      { clave: "Modo", valor: "Siempre encendido / Solo fallo" },
    ],
  },

  // BOTIQUINES
  {
    id: "prod-bot-carter",
    nombre: "Botiquín Primeros Auxilios – Tipo Maletín",
    slug: "botiquin-primeros-auxilios-maletin",
    categoriaId: "cat-botiquines",
    descripcion: "Botiquín plástico de alta resistencia tipo maletín. Contiene apósitos, gasas, vendas, alcohol, solución fisiológica y más. Reglamentario para vehículos y oficinas.",
    descripcionCorta: "Botiquín reglamentario tipo maletín para transporte y oficina.",
    imagenes: [],
    destacado: true,
    activo: true,
    caracteristicas: [
      { clave: "Contenido", valor: "24-30 elementos" },
      { clave: "Material", valor: "Plástico Rígido" },
      { clave: "Uso", valor: "Autos, Camionetas, Hogar, Oficinas" },
    ],
  },
  {
    id: "prod-bot-pared",
    nombre: "Gabinete Botiquín – Metálico de Pared",
    slug: "botiquin-pared-metalico",
    categoriaId: "cat-botiquines",
    descripcion: "Botiquín de pared para empresas e industrias. Chapa pintada epoxi blanca con cruz roja. Incluye kit completo de primeros auxilios intensivo.",
    descripcionCorta: "Botiquín de gran capacidad para industrias.",
    imagenes: [],
    destacado: false,
    activo: true,
    caracteristicas: [
      { clave: "Material", valor: "Chapa de acero" },
      { clave: "Medidas", valor: "40 x 30 x 12 cm" },
      { clave: "Contenido", valor: "Kit industrial completo" },
    ],
  },
];

// ============================================================
// HELPERS
// ============================================================

export function getCategoriaBySlug(slug: string): Categoria | undefined {
  return CATEGORIAS_PLACEHOLDER.find((c) => c.slug === slug);
}

export function getProductosByCategoria(categoriaId: string): Producto[] {
  return PRODUCTOS_PLACEHOLDER.filter((p) => p.categoriaId === categoriaId && p.activo);
}

export function getProductoBySlug(slug: string): Producto | undefined {
  return PRODUCTOS_PLACEHOLDER.find((p) => p.slug === slug);
}

export function getProductosDestacados(): Producto[] {
  return PRODUCTOS_PLACEHOLDER.filter((p) => p.destacado && p.activo).slice(0, 6);
}
