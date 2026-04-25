"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, orderBy, query
} from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlantillaItem {
  id: string;
  descripcion: string;
  esGrupo?: boolean; // header/separator row
  tipoColumna?: "checklist" | "tiempo" | "texto"; // default = checklist
}

interface Plantilla {
  id: string;
  codigo: string;      // ARIFA-IPM-020
  nombre: string;
  categoria: "deteccion" | "extincion" | "matafuegos" | "certificaciones";
  frecuencia: "mensual" | "trimestral" | "semestral" | "anual";
  tipo: "checklist" | "tabla_piso";
  descripcion?: string;
  modoChecklist?: "ok_nok" | "si_no"; // column labels for checklist type
  // checklist fields
  items?: PlantillaItem[];
  // tabla_piso fields
  columnas?: string[];
  // extra info fields shown on planilla header
  infoFields?: string[];
}

const CATEGORIAS = [
  { value: "deteccion", label: "Detección", icon: "🔍" },
  { value: "extincion", label: "Extinción", icon: "🧯" },
  { value: "matafuegos", label: "Matafuegos", icon: "🔥" },
  { value: "certificaciones", label: "Certificaciones", icon: "📜" },
];
const FRECUENCIAS = ["mensual", "trimestral", "semestral", "anual"];

// Pre-loaded seed data for first time setup
const SEED_PLANTILLAS: Omit<Plantilla, "id">[] = [
  {
    codigo: "ARIFA-IPM-020",
    nombre: "Central de Detección y Paneles de Control",
    categoria: "deteccion",
    frecuencia: "trimestral",
    tipo: "checklist",
    descripcion: "Inspección y prueba trimestral del panel central de detección de incendios.",
    infoFields: ["Sistema de detección de incendios", "Tipo de sistema"],
    items: [
      { id: "g1", descripcion: "INSPECCIÓN", esGrupo: true },
      { id: "g1-1", descripcion: "Fuentes de energía", esGrupo: true },
      { id: "i1", descripcion: "¿Se halla alimentada con tensión Primaria (220v)?" },
      { id: "i2", descripcion: "¿Se halla alimentada con tensión Secundaria (Baterías) 220v?" },
      { id: "g1-2", descripcion: "Instalación", esGrupo: true },
      { id: "i3", descripcion: "¿Posee cargas externas?" },
      { id: "i4", descripcion: "¿Están todos los componentes incrustados?" },
      { id: "i5", descripcion: "¿Están ensamblados en alineación?" },
      { id: "g1-3", descripcion: "Cableado", esGrupo: true },
      { id: "i6", descripcion: "¿Todas las zonas vinculadas al panel están conectadas?" },
      { id: "g2", descripcion: "PRUEBA", esGrupo: true },
      { id: "g2-1", descripcion: "Panel de Control", esGrupo: true },
      { id: "i7", descripcion: "Fusibles" },
      { id: "i8", descripcion: "Equipos de interfase" },
      { id: "i9", descripcion: "Alimentación de energía primaria" },
      { id: "i10", descripcion: "Indicadores luminosos del panel" },
      { id: "i11", descripcion: "Señales de falla propias del panel de simulación" },
      { id: "i12", descripcion: "Conexiones de red" },
      { id: "i13", descripcion: "Medición de tensión de baterías (alimentación secundaria)" },
      { id: "i14", descripcion: "¿El panel se encuentra conectado a la central de detección?" },
      { id: "i15", descripcion: "¿El panel recibe información normal de toda la zona monitoreada?" },
    ],
  },
  {
    codigo: "ARIFA-IPM-021",
    nombre: "Test de Detectores y Barreras de Humo",
    categoria: "deteccion",
    frecuencia: "mensual",
    tipo: "tabla_piso",
    descripcion: "Prueba mensual de detectores de humo, temperatura y gas.",
    infoFields: ["Sistema de detección de incendios", "Tipo de sistema", "Cantidad de detectores CONTROLADOS"],
    columnas: ["N°", "Tipo", "Fecha", "Tipo de Prueba", "Tiempo de Reporte", "Señal Visual", "Señal Acústica", "Estado", "Observaciones"],
  },
  {
    codigo: "ARIFA-IPM-022",
    nombre: "Test de Pulsadores y Sirenas",
    categoria: "deteccion",
    frecuencia: "mensual",
    tipo: "tabla_piso",
    descripcion: "Prueba mensual de pulsadores manuales, sirenas y luces estroboscópicas.",
    infoFields: ["Sistema de detección de incendios", "Tipo de sistema", "Cantidad de pulsadores CONTROLADOS", "Cantidad de sirenas CONTROLADOS"],
    columnas: ["Piso", "Tipo", "Fecha", "Tipo de Prueba", "Tiempo de Reporte", "Luz Estroboscópica", "Sirenas", "Estado", "Observaciones"],
  },
  // ── EXTINCIÓN ─────────────────────────────────────────────────────────────
  {
    codigo: "ARIFA-IPM-001",
    nombre: "Inspección y Prueba de Sistemas de Rociadores Húmedos",
    categoria: "extincion",
    frecuencia: "trimestral",
    tipo: "checklist",
    descripcion: "Inspección y prueba trimestral de sistemas de rociadores húmedos.",
    infoFields: ["Edificio", "Sector cubierto", "Identificación", "Ubicación de la ECA", "Válvula de control tipo poste indicador N°", "Ubicación de las conexiones de prueba"],
    items: [
      { id: "g-insp", descripcion: "INSPECCIÓN", esGrupo: true },
      { id: "g-manometros", descripcion: "Manómetros", esGrupo: true },
      { id: "i1", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "i2", descripcion: "¿Se encuentran sin fugas?" },
      { id: "i3", descripcion: "¿La presión registrada es la adecuada?" },
      { id: "g-trim", descripcion: "Válvulas y accesorios del TRIM", esGrupo: true },
      { id: "i4", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "i5", descripcion: "¿Se encuentran sin fugas?" },
      { id: "i6", descripcion: "¿Se encuentran abiertas o cerradas según correspondan?" },
      { id: "g-conexiones", descripcion: "Conexiones", esGrupo: true },
      { id: "i7", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "i8", descripcion: "¿Se encuentran sin fugas?" },
      { id: "g-drenajes", descripcion: "Drenajes", esGrupo: true },
      { id: "i9", descripcion: "¿Se encuentran sin fugas?" },
      { id: "g-valv-alarma", descripcion: "Válvula de alarma", esGrupo: true },
      { id: "i10", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "i11", descripcion: "¿Se encuentran sin fugas?" },
      { id: "g-valv-control", descripcion: "Válvulas de control", esGrupo: true },
      { id: "i12", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "i13", descripcion: "¿Se encuentran sin fugas?" },
      { id: "i14", descripcion: "¿El dispositivo de supervisión se encuentra libre de daños físicos?" },
      { id: "i15", descripcion: "¿Se encuentra abierta?" },
      { id: "i16", descripcion: "¿Se encuentra bloqueada con candado?" },
      { id: "i17", descripcion: "¿Tiene la identificación apropiada?" },
      { id: "g-camara", descripcion: "Cámara de retardo", esGrupo: true },
      { id: "i18", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "i19", descripcion: "¿Se encuentran sin fugas?" },
      { id: "g-disp-alarma", descripcion: "Dispositivos iniciadores de alarma de flujo de agua", esGrupo: true },
      { id: "i20", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "i21", descripcion: "¿Se encuentran sin fugas?" },
      { id: "g-gong", descripcion: "GONG y motor hidráulico", esGrupo: true },
      { id: "i22", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "i23", descripcion: "¿Se encuentran sin fugas?" },
      { id: "g-prueba", descripcion: "PRUEBA — Dispositivos de alarma por flujo de agua (Tiempo en reportar, segundos)", esGrupo: true },
      { id: "p1", descripcion: "GONG y motor hidráulico", tipoColumna: "tiempo" },
      { id: "p2", descripcion: "Dispositivo de alarma de flujo de agua tipo interruptor de presión", tipoColumna: "tiempo" },
      { id: "p3", descripcion: "Dispositivo de alarma de flujo de agua tipo aleta", tipoColumna: "tiempo" },
      { id: "g-superv", descripcion: "PRUEBA — Interruptores de supervisión de válvulas de control", esGrupo: true },
      { id: "p4", descripcion: "¿Se registró el reporte antes de las 2 vueltas del volante desde la posición normal?" },
      { id: "p5", descripcion: "¿Se normalizó el sistema una vez que el volante regresó a su posición normal?" },
      { id: "p6", descripcion: "¿La válvula quedó bloqueada con candado?" },
    ],
  },
  {
    codigo: "ARIFA-IPM-002",
    nombre: "Control de Hidrantes Internos",
    categoria: "extincion",
    frecuencia: "mensual",
    tipo: "tabla_piso",
    descripcion: "Control visual mensual y prueba de eficiencia trimestral de hidrantes internos.",
    infoFields: ["Sector", "Mes"],
    columnas: ["N° Gabinete", "Edificio", "Ubicación", "Accesible", "Estado del Gabinete", "Llave", "Manguera", "Lanza", "Cartel en Altura", "Demarcación de Piso", "Mes Última Prueba", "Funcionamiento Válvula", "Presión"],
  },
  {
    codigo: "ARIFA-IPM-003",
    nombre: "Control de Hidrantes Externos",
    categoria: "extincion",
    frecuencia: "mensual",
    tipo: "tabla_piso",
    descripcion: "Control visual mensual y prueba de eficiencia trimestral de hidrantes externos.",
    infoFields: ["Sector", "Mes"],
    columnas: ["N°", "Frente a Edificio", "Ubicación", "Accesible", "Buen Estado", "Llaves", "Mangueras", "Lanzas", "Mes Última Prueba", "Válvula Principal", "Boca Salida Izq.", "Boca Salida Der.", "Presión"],
  },
  {
    codigo: "ARIFA-IPM-008",
    nombre: "Control de Bombas Contra Incendio",
    categoria: "extincion",
    frecuencia: "mensual",
    tipo: "checklist",
    modoChecklist: "si_no",
    descripcion: "Inspección y prueba mensual de bombas contra incendio (motobomba diesel y electrobomba jockey).",
    infoFields: ["Control sobre Bomba Contra Incendios", "Motobomba Diesel/Eléctrica operativa (SI/NO)", "Electrobomba Jockey operativa (SI/NO)", "Fecha", "Turno", "Bomberos"],
    items: [
      { id: "g-insp-ini", descripcion: "INSPECCIÓN INICIAL", esGrupo: true },
      { id: "g-tanque", descripcion: "Tanque de agua", esGrupo: true },
      { id: "b1", descripcion: "¿El nivel del tanque de agua es superior a los 3/4?" },
      { id: "g-pulmon", descripcion: "Pulmón amortizador", esGrupo: true },
      { id: "b2", descripcion: "¿La presión del tanque pulmón es correcta?" },
      { id: "g-combust", descripcion: "Nivel de Combustible", esGrupo: true },
      { id: "b3", descripcion: "Valor expresado en centímetros al inicio:", tipoColumna: "texto" },
      { id: "b4", descripcion: "¿El nivel de Combustible es superior a las 3/4 partes del tanque?" },
      { id: "g-jockey", descripcion: "Bomba eléctrica Jockey", esGrupo: true },
      { id: "b5", descripcion: "¿La bomba Jockey está alimentada de energía eléctrica?" },
      { id: "g-electro", descripcion: "Electro Bomba", esGrupo: true },
      { id: "b6", descripcion: "¿Se detectó la correcta presencia de fases?" },
      { id: "g-temp", descripcion: "Control temperatura bobinado — Bomba Jockey / Principal / Achique", esGrupo: true },
      { id: "g-diesel", descripcion: "Motor Diesel", esGrupo: true },
      { id: "b7", descripcion: "Horas Motor al Inicio:", tipoColumna: "texto" },
      { id: "b8", descripcion: "¿La cantidad de aceite en el motor es superior al nivel mínimo?" },
      { id: "b9", descripcion: "¿Las horas de funcionamiento con este aceite son inferiores a 60 horas?" },
      { id: "b10", descripcion: "El nivel de agua del motor, ¿es normal?" },
      { id: "b11", descripcion: "¿Las baterías se encuentran en buen estado y el voltaje del pack supera el requerido?" },
      { id: "b12", descripcion: "El filtro de aire, ¿se encuentra en buenas condiciones?" },
      { id: "b13", descripcion: "¿Se encuentran fugas en las tuberías y mangueras del motor?" },
      { id: "b14", descripcion: "¿El sistema de escape tiene fuga de gases?" },
      { id: "g-sala", descripcion: "Sala de Bombas", esGrupo: true },
      { id: "b15", descripcion: "¿Las rejillas de ventilación se encuentran libres de obstrucciones y funcionando?" },
      { id: "b16", descripcion: "¿El piso se encuentra sin restos de agua en exceso?" },
      { id: "b17", descripcion: "¿La temperatura de la sala de Bombas es superior a 4°C?" },
      { id: "b18", descripcion: "¿Las cañerías se encuentran sin pérdidas?" },
      { id: "g-prueba", descripcion: "PRUEBA", esGrupo: true },
      { id: "g-valv-p", descripcion: "Válvulas", esGrupo: true },
      { id: "b19", descripcion: "Al inicio de la prueba, ¿se cerró por completo la válvula de control de impulsión de agua a planta?" },
      { id: "b20", descripcion: "¿Las válvulas de las pruebas de flujo y conexión de mangueras de agua están cerradas?" },
      { id: "b21", descripcion: "¿Válvulas de succión y descarga totalmente abiertas?" },
      { id: "g-jock-p", descripcion: "Bomba Jockey", esGrupo: true },
      { id: "b22", descripcion: "¿Se activa a los 116 PSI y corta a los 130 PSI? (8 a 8.9 Bar)" },
      { id: "b23", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "b24", descripcion: "¿Se encuentran sin fugas?" },
      { id: "g-moto", descripcion: "Motobomba Diesel", esGrupo: true },
      { id: "b25", descripcion: "¿El arranque de la motobomba fue normal en automático?" },
      { id: "b26", descripcion: "¿La motobomba se activa a los 95 PSI? (6.5 Bar)" },
      { id: "b27", descripcion: "¿La presión de aspiración está entre 7 y 12 PSI? (0.5 y 0.8 Bar)" },
      { id: "b28", descripcion: "¿La presión de descarga es SUPERIOR a 72 PSI? (5 Bar)" },
      { id: "b29", descripcion: "¿El giro del motor es de 2060 RPM?" },
      { id: "b30", descripcion: "¿La circulación de agua del sistema de enfriamiento es normal?" },
      { id: "b31", descripcion: "¿Los cojinetes están lubricados con agua?" },
      { id: "g-central", descripcion: "Central de detección y alarmas", esGrupo: true },
      { id: "b32", descripcion: "El tablero de supervisión de alarmas, ¿recibió la señal de baja presión y la motobomba en funcionamiento?" },
      { id: "g-insp-fin", descripcion: "INSPECCIÓN FINAL", esGrupo: true },
      { id: "g-valv-f", descripcion: "Válvulas", esGrupo: true },
      { id: "b33", descripcion: "La válvula de aspiración de la bomba, ¿está completamente abierta?" },
      { id: "b34", descripcion: "La válvula de control envío a planta, ¿se dejó abierta?" },
      { id: "b35", descripcion: "La válvula de recirculación a tanque, ¿está cerrada?" },
      { id: "b36", descripcion: "¿Las válvulas quedaron bloqueadas con candados?" },
      { id: "g-bombas-f", descripcion: "Bombas Contra Incendio", esGrupo: true },
      { id: "b37", descripcion: "Horas Motor al finalizar la prueba:", tipoColumna: "texto" },
      { id: "b38", descripcion: "¿Cuál es el tiempo de funcionamiento de la Motobomba?", tipoColumna: "texto" },
      { id: "b39", descripcion: "¿La Motobomba quedó en modo automático?" },
      { id: "b40", descripcion: "¿La Bomba Jockey quedó en modo automático?" },
      { id: "g-comb-f", descripcion: "Nivel de Combustible", esGrupo: true },
      { id: "b41", descripcion: "Valor expresado en centímetros al finalizar:", tipoColumna: "texto" },
    ],
  },
  // ── IPM-009 ─────────────────────────────────────────────────────────────────
  {
    codigo: "ARIFA-IPM-009",
    nombre: "Control Visual de Válvulas de Red Anti-Incendio y Sprinkler",
    categoria: "extincion",
    frecuencia: "mensual",
    tipo: "tabla_piso",
    descripcion: "Control visual mensual de válvulas de red anti-incendio enterrada y sistema de sprinkler.",
    infoFields: ["Sector", "Fecha"],
    columnas: [
      "Válvula N°", "Ubicación Física", "Area Controlada",
      "Válvula Accesible (SI/NO)", "Válvula Abierta (SI/NO)",
      "Cartelería Identificación (SI/NO)", "Libre de Fugas (SI/NO)", "Con Candado (SI/NO)",
    ],
  },
  // ── IPM-024 ─────────────────────────────────────────────────────────────────
  {
    codigo: "ARIFA-IPM-024",
    nombre: "Maniobrabilidad de Válvulas de Red Anti-Incendio y Sprinkler",
    categoria: "extincion",
    frecuencia: "anual",
    tipo: "tabla_piso",
    descripcion: "Prueba anual de maniobrabilidad de válvulas de red anti-incendio enterrada y sistema de sprinkler.",
    infoFields: ["Sector", "Fecha"],
    columnas: [
      "Válvula N°", "Ubicación Física", "Area Controlada",
      "Cierra (N° vueltas)", "Abre (N° vueltas)",
      "Buena (SI/NO)", "Requiere Mantenimiento (SI/NO)",
    ],
  },
  // ── IPM-013 ─────────────────────────────────────────────────────────────────
  {
    codigo: "ARIFA-IPM-013",
    nombre: "Inspección y Prueba de Rociadores Húmedos — Anual",
    categoria: "extincion",
    frecuencia: "anual",
    tipo: "checklist",
    modoChecklist: "ok_nok",
    descripcion: "Inspección y prueba anual de sistemas de rociadores húmedos.",
    infoFields: [
      "Edificio", "Sector cubierto", "Identificación",
      "Ubicación de la ECA", "Válvula de control tipo poste indicador N°",
      "Ubicación de las conexiones de prueba",
    ],
    items: [
      { id: "g-insp", descripcion: "INSPECCIÓN", esGrupo: true },
      { id: "g-v2-i", descripcion: "Válvula de 2\" Drenaje Principal", esGrupo: true },
      { id: "v1", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "v2", descripcion: "¿Se encuentran sin fugas?" },
      { id: "v3", descripcion: "¿Se encuentra cerrada?" },
      { id: "g-cart", descripcion: "Cartelería de identificación", esGrupo: true },
      { id: "c1", descripcion: "¿Posee cartelería de identificación de la ECA?" },
      { id: "c2", descripcion: "¿Posee planimetría del sector cubierto por la ECA?" },
      { id: "g-tub", descripcion: "Tuberías y accesorios", esGrupo: true },
      { id: "t1", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "t2", descripcion: "¿Se encuentran sin fugas?" },
      { id: "t3", descripcion: "Los soportes y arriostramientos, ¿se encuentran en buen estado, firmes y sin daños físicos?" },
      { id: "g-roc", descripcion: "Rociadores", esGrupo: true },
      { id: "r1", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "r2", descripcion: "¿Se encuentran sin fugas?" },
      { id: "r3", descripcion: "¿Se encuentran alineados/orientados a la zona de cobertura?" },
      { id: "g-mano", descripcion: "Manómetros", esGrupo: true },
      { id: "m1", descripcion: "¿Se encuentran sin daños físicos?" },
      { id: "m2", descripcion: "¿La presión indicada está dentro de los parámetros estándar?" },
      { id: "g-prueba", descripcion: "PRUEBA", esGrupo: true },
      { id: "g-dren", descripcion: "Prueba de Drenaje 2\"", esGrupo: true },
      { id: "d1", descripcion: "Presión Estática — Manómetro A (valor):", tipoColumna: "texto" },
      { id: "d2", descripcion: "Presión Estática — Manómetro B (valor):", tipoColumna: "texto" },
      { id: "d3", descripcion: "Presión Dinámica (descarga) — Manómetro A (valor):", tipoColumna: "texto" },
      { id: "d4", descripcion: "Presión Dinámica (descarga) — Manómetro B (valor):", tipoColumna: "texto" },
      { id: "g-bci", descripcion: "Bomba contra incendios", esGrupo: true },
      { id: "b1", descripcion: "¿Se encendió la Bomba Principal?" },
      { id: "b2", descripcion: "¿Cuál es el tiempo de activación de la bomba principal?", tipoColumna: "texto" },
      { id: "g-v2-p", descripcion: "Válvula de 2\" Drenaje Principal — Operación", esGrupo: true },
      { id: "p1", descripcion: "¿Se pudo operar con normalidad?" },
      { id: "p2", descripcion: "¿Se detectaron obstrucciones durante la descarga?" },
      { id: "p3", descripcion: "¿Se pudo cerrar con normalidad?" },
      { id: "g-mant", descripcion: "MANTENIMIENTO", esGrupo: true },
      { id: "g-v2-m", descripcion: "Válvula de 2\"", esGrupo: true },
      { id: "mv1", descripcion: "¿Se efectuó lubricación de componentes?" },
      { id: "mv2", descripcion: "¿Requiere limpieza interior por obstrucciones y/o pérdidas?" },
      { id: "g-vc-m", descripcion: "Válvula de control", esGrupo: true },
      { id: "mvc1", descripcion: "¿Se efectuó lubricación de componentes?" },
      { id: "mvc2", descripcion: "¿Requiere limpieza interior por obstrucciones y/o pérdidas?" },
      { id: "g-va-m", descripcion: "Válvula de alarma", esGrupo: true },
      { id: "mva1", descripcion: "¿Se efectuó lubricación de componentes?" },
      { id: "mva2", descripcion: "¿Requiere limpieza interior por obstrucciones y/o pérdidas?" },
      { id: "g-vr-m", descripcion: "Válvula de retención", esGrupo: true },
      { id: "mvr1", descripcion: "¿Se efectuó lubricación de componentes?" },
      { id: "mvr2", descripcion: "¿Requiere limpieza interior por obstrucciones y/o pérdidas?" },
    ],
  },
  // ── IPM-014 ─────────────────────────────────────────────────────────────────
  {
    codigo: "ARIFA-IPM-014",
    nombre: "Control de Montantes y Mangueras",
    categoria: "extincion",
    frecuencia: "anual",
    tipo: "tabla_piso",
    descripcion: "Inspección, prueba y mantenimiento anual de montantes y mangueras (BIE e Hidrantes de Jardín).",
    infoFields: ["Hidrantes Internos (BIE)", "Hidrantes Externos (Jardín)", "Año", "Mes"],
    columnas: [
      "Gabinete N°",
      "Edificio",
      "Ubicación",
      "Conexión Manguera (OK/NOK)",
      "Boquilla Manguera (OK/NOK)",
      "Tubería Montante (OK/NOK)",
      "Válvula Control Aérea (OK/NOK)",
      "Drenaje Principal (OK/NOK)",
      "Prueba Flujo 1 Min. (dd/mm)",
      "Presión (OK/NOK)",
      "Prueba Hidráulica Manguera (dd/mm)",
      "Lubric. Válv. Teatro (dd/mm)",
      "Lubric. Válv. Control (dd/mm)",
      "Estado O'Ring (OK/NOK)",
      "Estado Vástago (OK/NOK)",
    ],
  },
  // ── IPM-019 ─────────────────────────────────────────────────────────────────
  {
    codigo: "ARIFA-IPM-019",
    nombre: "Inspección, Prueba y Mantenimiento de Bombas Contra Incendio — Anual",
    categoria: "extincion",
    frecuencia: "anual",
    tipo: "checklist",
    modoChecklist: "si_no",
    descripcion: "Inspección, prueba y mantenimiento anual de bombas contra incendio.",
    infoFields: [
      "Control sobre Bomba Contra Incendios",
      "Motobomba Diesel/Eléctrica operativa (SI/NO)",
      "Electrobomba Jockey operativa (SI/NO)",
      "Fecha",
      "Turno",
      "Inspector",
    ],
    items: [
      { id: "g-ini", descripcion: "INSPECCIÓN INICIAL", esGrupo: true },
      { id: "g-gen", descripcion: "General", esGrupo: true },
      { id: "a1", descripcion: "¿La bomba centrífuga se encuentra alineada correctamente con el motor diesel?" },
      { id: "a2", descripcion: "El aislamiento de cables y conductores, ¿es correcto?" },
      { id: "a3", descripcion: "¿El respiradero del cárter motor se encuentra libre de obstrucciones?" },
      { id: "a4", descripcion: "El sistema de escape y trampa de condensado de drenaje, ¿se encuentra en buen estado y sin fugas?" },
      { id: "a5", descripcion: "Las conexiones y mangueras flexibles, ¿se encuentran en buen estado?" },
      { id: "a6", descripcion: "Las rejillas de ventilación del depósito de combustible, ¿se encuentran libres de obstrucciones?" },
      { id: "a7", descripcion: "Las piezas de fontanería, ¿se encuentran sin fugas?" },
      { id: "a8", descripcion: "Placas de circuitos impresos, ¿se encuentran en buen estado y libres de corrosión?" },
      { id: "a9", descripcion: "Las rejillas de succión, ¿se encuentran libres de obstrucciones?" },
      { id: "a10", descripcion: "Las válvulas de retención, ¿se encuentran en buen estado y libres de corrosión?" },
      { id: "g-prueba", descripcion: "PRUEBA", esGrupo: true },
      { id: "pr1", descripcion: "La prueba de combustible diesel para verificar su degradación, ¿fue satisfactoria?" },
      { id: "pr2", descripcion: "¿Se detectó en la central de alarma la caída de presión de red?" },
      { id: "pr3", descripcion: "¿Reportó la activación de la bomba contra incendios?" },
      { id: "pr4", descripcion: "¿Se registró la solicitud de calibración de manómetros de sala de bombas?" },
      { id: "pr4b", descripcion: "Número de solicitud de calibración de manómetros:", tipoColumna: "texto" },
      { id: "pr5", descripcion: "¿La válvula de alivio de presión se encuentra correctamente ajustada para liberar presión a partir de los 175 PSI?" },
      { id: "pr6", descripcion: "¿Se detectó en la central de alarma la caída de presión de red? (2da verificación)" },
      { id: "pr7", descripcion: "¿Reportó la activación de la bomba contra incendios? (2da verificación)" },
      { id: "g-curva", descripcion: "PRUEBA DE CURVA DE LA BOMBA — Flujo (m³/h) / P.Desc (Bar) / P.Succ (Bar) / P.Neta (Bar) / RPM / Hs.Motor (separar con /)", esGrupo: true },
      { id: "cu0", descripcion: "Punto 0%:", tipoColumna: "texto" },
      { id: "cu50", descripcion: "Punto 50%:", tipoColumna: "texto" },
      { id: "cu75", descripcion: "Punto 75%:", tipoColumna: "texto" },
      { id: "cu100", descripcion: "Punto 100%:", tipoColumna: "texto" },
      { id: "cu130", descripcion: "Punto 130%:", tipoColumna: "texto" },
      { id: "cu150", descripcion: "Punto 150%:", tipoColumna: "texto" },
      { id: "g-mant", descripcion: "MANTENIMIENTO", esGrupo: true },
      { id: "mt1", descripcion: "Baterías: ¿Se eliminó cualquier corrosión de los terminales?" },
      { id: "mt2", descripcion: "Baterías: ¿Se midió el estado de carga y el voltaje de arranque supera los 18V (sistema 24V)?" },
      { id: "mt3", descripcion: "¿Se reemplazó el filtro de agua circulante?" },
      { id: "mt3b", descripcion: "Fecha de cambio de filtro de agua:", tipoColumna: "texto" },
      { id: "mt4", descripcion: "¿Se cambió el aceite lubricante del motor? (cada 50hs reloj o anualmente)" },
      { id: "mt4b", descripcion: "Fecha de cambio de aceite:", tipoColumna: "texto" },
      { id: "mt5", descripcion: "¿Se reemplazó el filtro de aceite del motor? (cada 50hs reloj o anualmente)" },
      { id: "mt5b", descripcion: "Fecha de cambio de filtro de aceite:", tipoColumna: "texto" },
      { id: "mt6", descripcion: "¿Se reemplazó el filtro de combustible? (cada 50hs reloj o anualmente)" },
      { id: "mt6b", descripcion: "Fecha de cambio de filtro de combustible:", tipoColumna: "texto" },
      { id: "mt7", descripcion: "¿Se inspeccionó el tanque de combustible para detectar presencia de agua y materiales extraños?" },
      { id: "mt8", descripcion: "¿Se engrasaron acoplamientos y cojinetes de bombas/motor?" },
    ],
  },
  // ── MATAFUEGOS ──────────────────────────────────────────────────────────────
  {
    codigo: "ARIFA-MAT-001",
    nombre: "Inspección Visual de Matafuegos — Mensual",
    categoria: "matafuegos",
    frecuencia: "mensual",
    tipo: "checklist",
    modoChecklist: "ok_nok",
    descripcion: "Control visual mensual del estado general de los extintores portátiles instalados.",
    infoFields: ["Establecimiento", "Responsable de Seguridad", "Cantidad de unidades inspeccionadas"],
    items: [
      { id: "g-ubic", descripcion: "UBICACIÓN Y ACCESIBILIDAD", esGrupo: true },
      { id: "u1", descripcion: "¿El matafuego se encuentra en el lugar designado?" },
      { id: "u2", descripcion: "¿El acceso al matafuego está libre de obstáculos?" },
      { id: "u3", descripcion: "¿La señalización (cartel indicador) está visible y en buen estado?" },
      { id: "u4", descripcion: "¿Está colgado / montado correctamente en el soporte?" },
      { id: "u5", descripcion: "¿La altura de montaje no supera 1,50 m desde el suelo?" },
      { id: "g-estado", descripcion: "ESTADO FÍSICO DEL EQUIPO", esGrupo: true },
      { id: "e1", descripcion: "¿El cilindro está libre de corrosión, golpes o deformaciones?" },
      { id: "e2", descripcion: "¿La manguera / boquilla se encuentra en buen estado y libre de obstrucciones?" },
      { id: "e3", descripcion: "¿La manija de activación y el seguro (pasador) están en buen estado?" },
      { id: "e4", descripcion: "¿El precinto de seguridad / sello está intacto?" },
      { id: "e5", descripcion: "¿La etiqueta de identificación / vencimiento está legible?" },
      { id: "g-presion", descripcion: "PRESIÓN Y CARGA", esGrupo: true },
      { id: "p1", descripcion: "¿El manómetro indica presión en zona VERDE (operativo)?" },
      { id: "p2", descripcion: "¿El peso del equipo coincide con el peso nominal de la tarjeta?" },
      { id: "p3", descripcion: "¿El equipo está dentro de la fecha de vencimiento de su última recarga?" },
    ],
  },
  {
    codigo: "ARIFA-MAT-002",
    nombre: "Inspección y Mantenimiento de Matafuegos — Trimestral",
    categoria: "matafuegos",
    frecuencia: "trimestral",
    tipo: "checklist",
    modoChecklist: "ok_nok",
    descripcion: "Inspección técnica trimestral con verificación mecánica y prueba de agente extintor.",
    infoFields: ["Establecimiento", "Técnico Actuante", "Fecha de Servicio"],
    items: [
      { id: "g-vis", descripcion: "INSPECCIÓN VISUAL (incluye todos los puntos mensuales)", esGrupo: true },
      { id: "v1", descripcion: "¿Ubicación, acceso y señalización correctos?" },
      { id: "v2", descripcion: "¿Cilindro sin corrosión, golpes ni deformaciones?" },
      { id: "v3", descripcion: "¿Manguera y boquilla sin obstrucciones ni daños?" },
      { id: "v4", descripcion: "¿Manija, seguro y precinto intactos?" },
      { id: "v5", descripcion: "¿Etiqueta/tarjeta al día y legible?" },
      { id: "g-mec", descripcion: "VERIFICACIÓN MECÁNICA", esGrupo: true },
      { id: "m1", descripcion: "¿Se realizó prueba de presión del manómetro?" },
      { id: "m2", descripcion: "¿La válvula de descarga opera correctamente (sin trabar)?" },
      { id: "m3", descripcion: "¿Los empaques y o-rings están en buen estado?" },
      { id: "m4", descripcion: "¿Se lubricaron componentes móviles (válvula, manija)?" },
      { id: "g-agente", descripcion: "AGENTE EXTINTOR", esGrupo: true },
      { id: "a1", descripcion: "¿Se verificó el estado / peso del agente extintor?" },
      { id: "a2", descripcion: "¿El agente extintor es el adecuado para la clase de fuego del sector?" },
      { id: "a3", descripcion: "¿Requiere recarga o sustitución?" },
      { id: "g-cert", descripcion: "DOCUMENTACIÓN", esGrupo: true },
      { id: "c1", descripcion: "¿Se actualizó la tarjeta de inspección del equipo?" },
      { id: "c2", descripcion: "¿Se registró el servicio en el libro/planilla del establecimiento?" },
    ],
  },
  {
    codigo: "ARIFA-MAT-003",
    nombre: "Inventario de Matafuegos por Sector / Piso",
    categoria: "matafuegos",
    frecuencia: "anual",
    tipo: "tabla_piso",
    descripcion: "Relevamiento y estado de todos los matafuegos instalados, organizados por sector o piso.",
    infoFields: ["Establecimiento", "Dirección", "Técnico Actuante", "Fecha"],
    columnas: [
      "N°",
      "Sector / Piso",
      "Tipo de Agente",
      "Capacidad",
      "Marca / N° Serie",
      "Fecha Última Recarga",
      "Vencimiento",
      "Presión (OK/NOK)",
      "Estado Físico (OK/NOK)",
      "Señalización (OK/NOK)",
      "Acción Requerida",
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TemplatesPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Plantilla | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const emptyForm = (): Omit<Plantilla, "id"> => ({
    codigo: "",
    nombre: "",
    categoria: "deteccion",
    frecuencia: "mensual",
    tipo: "checklist",
    modoChecklist: "ok_nok",
    descripcion: "",
    infoFields: [],
    items: [{ id: crypto.randomUUID(), descripcion: "" }],
    columnas: [""],
  });
  const [form, setForm] = useState(emptyForm());
  const [newInfoField, setNewInfoField] = useState("");
  const [newCol, setNewCol] = useState("");

  useEffect(() => { fetchPlantillas(); }, []);

  const fetchPlantillas = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "plantillas_inspeccion"), orderBy("categoria"), orderBy("codigo")));
      setPlantillas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Plantilla)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSeed = async () => {
    const existingCodigos = new Set(plantillas.map(p => p.codigo));
    const faltantes = SEED_PLANTILLAS.filter(p => !existingCodigos.has(p.codigo));
    if (faltantes.length === 0) { alert("✅ Todas las plantillas base ya están cargadas."); return; }
    if (!confirm(`¿Sincronizar ${faltantes.length} plantilla(s) faltante(s)?\n\n${faltantes.map(p => `• ${p.codigo} — ${p.nombre}`).join("\n")}`)) return;
    setSeeding(true);
    try {
      for (const p of faltantes) {
        await addDoc(collection(db, "plantillas_inspeccion"), { ...p, createdAt: serverTimestamp() });
      }
      await fetchPlantillas();
      alert(`✅ ${faltantes.length} plantilla(s) cargada(s) correctamente.`);
    } catch (e) { alert("Error al cargar plantillas: " + e); }
    finally { setSeeding(false); }
  };

  const openCreate = () => { setForm(emptyForm()); setEditing(null); setModal("create"); };
  const openEdit = (p: Plantilla) => {
    setForm({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      frecuencia: p.frecuencia,
      tipo: p.tipo,
      modoChecklist: p.modoChecklist || "ok_nok",
      descripcion: p.descripcion || "",
      infoFields: p.infoFields || [],
      items: p.items?.length ? p.items : [{ id: crypto.randomUUID(), descripcion: "" }],
      columnas: p.columnas?.length ? p.columnas : [""],
    });
    setEditing(p);
    setModal("edit");
  };

  const handleSave = async () => {
    if (!form.codigo || !form.nombre) { alert("Código y nombre son obligatorios."); return; }
    setSaving(true);
    try {
      const payload: any = {
        codigo: form.codigo.toUpperCase().trim(),
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        frecuencia: form.frecuencia,
        tipo: form.tipo,
        descripcion: form.descripcion,
        infoFields: form.infoFields || [],
        modoChecklist: form.modoChecklist || "ok_nok",
        updatedAt: serverTimestamp(),
      };
      if (form.tipo === "checklist") {
        payload.items = (form.items || []).filter(i => i.descripcion.trim());
        payload.columnas = [];
      } else {
        payload.columnas = (form.columnas || []).filter(c => c.trim());
        payload.items = [];
      }

      if (modal === "edit" && editing) {
        await updateDoc(doc(db, "plantillas_inspeccion", editing.id), payload);
      } else {
        await addDoc(collection(db, "plantillas_inspeccion"), { ...payload, createdAt: serverTimestamp() });
      }
      setModal(null);
      await fetchPlantillas();
    } catch (e) { alert("Error al guardar: " + e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "plantillas_inspeccion", id));
      setDeleteConfirm(null);
      await fetchPlantillas();
    } catch (e) { alert("Error al eliminar: " + e); }
  };

  // Item helpers
  const addItem = () => setForm(f => ({ ...f, items: [...(f.items || []), { id: crypto.randomUUID(), descripcion: "" }] }));
  const updateItem = (idx: number, field: keyof PlantillaItem, val: any) =>
    setForm(f => ({ ...f, items: f.items!.map((it, i) => i === idx ? { ...it, [field]: val } : it) }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items!.filter((_, i) => i !== idx) }));

  const addColumn = () => { if (!newCol.trim()) return; setForm(f => ({ ...f, columnas: [...(f.columnas || []), newCol.trim()] })); setNewCol(""); };
  const removeCol = (idx: number) => setForm(f => ({ ...f, columnas: f.columnas!.filter((_, i) => i !== idx) }));

  const addInfoField = () => { if (!newInfoField.trim()) return; setForm(f => ({ ...f, infoFields: [...(f.infoFields || []), newInfoField.trim()] })); setNewInfoField(""); };
  const removeInfoField = (idx: number) => setForm(f => ({ ...f, infoFields: f.infoFields!.filter((_, i) => i !== idx) }));

  const byCategoria = (cat: string) => plantillas.filter(p => p.categoria === cat);

  return (
    <div style={{ maxWidth: "1100px" }}>
      {/* HEADER */}
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Gestión de Plantillas</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>Creá, editá y eliminá las plantillas de inspección base.</p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button onClick={openCreate} className="btn-red" style={{ padding: "10px 20px", fontSize: "0.85rem" }}>
            ➕ Nueva Plantilla
          </button>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando plantillas...</div>
      ) : (
        CATEGORIAS.map(cat => (
          <section key={cat.value} style={{ marginBottom: "35px" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
              {cat.icon} {cat.label}
            </h2>
            {byCategoria(cat.value).length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontStyle: "italic", padding: "15px 20px", background: "#f9f9f9", borderRadius: "8px" }}>
                No hay plantillas de {cat.label} aún.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
                {byCategoria(cat.value).map(p => (
                  <div key={p.id} style={{ background: "#fff", borderRadius: "10px", padding: "20px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)", border: "1px solid #eef0f3" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px" }}>
                      <div>
                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-red)", background: "#fff1f0", padding: "2px 8px", borderRadius: "4px", letterSpacing: "0.5px" }}>
                          {p.codigo}
                        </span>
                        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--primary-blue)", marginTop: "8px", lineHeight: "1.3" }}>{p.nombre}</h3>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "15px" }}>
                      <span style={{ fontSize: "0.72rem", background: p.tipo === "checklist" ? "#e3f2fd" : "#e8f5e9", color: p.tipo === "checklist" ? "#1565c0" : "#2e7d32", padding: "3px 9px", borderRadius: "20px", fontWeight: 700, textTransform: "capitalize" }}>
                        {p.tipo === "checklist" ? "✅ Checklist" : "📊 Tabla por piso"}
                      </span>
                      <span style={{ fontSize: "0.72rem", background: "#f5f5f5", color: "#666", padding: "3px 9px", borderRadius: "20px", fontWeight: 600, textTransform: "capitalize" }}>
                        {p.frecuencia}
                      </span>
                    </div>
                    {p.tipo === "checklist" && p.items && (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                        {p.items.filter(i => !i.esGrupo).length} ítems
                      </p>
                    )}
                    {p.tipo === "tabla_piso" && p.columnas && (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                        {p.columnas.length} columnas
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => openEdit(p)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600, fontSize: "0.82rem" }}>
                        ✏️ Editar
                      </button>
                      <button onClick={() => setDeleteConfirm(p.id)} style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #ffddd9", background: "#fff5f4", cursor: "pointer", color: "var(--primary-red)", fontWeight: 700, fontSize: "0.82rem" }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar plantilla?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer. Las órdenes de trabajo existentes no se verán afectadas.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREATE / EDIT */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, overflowY: "auto", padding: "40px 20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", maxWidth: "700px", margin: "0 auto", padding: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--primary-blue)" }}>
                {modal === "create" ? "Nueva Plantilla" : "Editar Plantilla"}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#999" }}>✕</button>
            </div>

            {/* Base fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
              <div>
                <label style={labelStyle}>Código *</label>
                <input style={inputStyle} value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="ARIFA-IPM-020" />
              </div>
              <div>
                <label style={labelStyle}>Frecuencia</label>
                <select style={inputStyle} value={form.frecuencia} onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value as any }))}>
                  {FRECUENCIAS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelStyle}>Nombre de la Plantilla *</label>
                <input style={inputStyle} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Test de Pulsadores y Sirenas" />
              </div>
              <div>
                <label style={labelStyle}>Categoría</label>
                <select style={inputStyle} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as any }))}>
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tipo de tabla</label>
                <select style={inputStyle} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}>
                  <option value="checklist">Checklist</option>
                  <option value="tabla_piso">Tabla por piso/dispositivo</option>
                </select>
              </div>
              {form.tipo === "checklist" && (
                <div>
                  <label style={labelStyle}>Modo de columnas</label>
                  <select style={inputStyle} value={form.modoChecklist || "ok_nok"} onChange={e => setForm(f => ({ ...f, modoChecklist: e.target.value as any }))}>
                    <option value="ok_nok">✅ OK / NOK / N/A</option>
                    <option value="si_no">✔ SI / NO / N/A</option>
                  </select>
                </div>
              )}
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelStyle}>Descripción (opcional)</label>
                <input style={inputStyle} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Breve descripción de la planilla..." />
              </div>
            </div>

            {/* Info fields (datos adicionales del encabezado) */}
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Campos de información del encabezado</label>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "10px" }}>Ej: "Sistema de detección de incendios", "Tipo de sistema"</p>
              {(form.infoFields || []).map((f, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                  <input
                    style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                    value={f}
                    onChange={e => setForm(prev => ({ ...prev, infoFields: prev.infoFields!.map((x, j) => j === i ? e.target.value : x) }))}
                  />
                  <button onClick={() => removeInfoField(i)} style={removeBtnStyle}>✕</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px" }}>
                <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} value={newInfoField} onChange={e => setNewInfoField(e.target.value)} placeholder="Nuevo campo..." onKeyDown={e => e.key === "Enter" && addInfoField()} />
                <button onClick={addInfoField} style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid var(--primary-blue)", background: "transparent", cursor: "pointer", color: "var(--primary-blue)", fontWeight: 700 }}>+</button>
              </div>
            </div>

            {/* CHECKLIST items */}
            {form.tipo === "checklist" && (
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Ítems / Grupos (en orden)</label>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "10px" }}>
                  ☑️ Grupo/Sección = cabecera. Tipo de columna: <strong>Checklist</strong> = OK/NOK/N/A · <strong>Tiempo</strong> = campo numérico en segundos · <strong>Texto</strong> = texto libre
                </p>
                {(form.items || []).map((item, idx) => (
                  <div key={item.id} style={{ display: "flex", gap: "6px", marginBottom: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="checkbox"
                      checked={item.esGrupo || false}
                      onChange={e => updateItem(idx, "esGrupo", e.target.checked)}
                      title="Es grupo/sección"
                      style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                    />
                    <input
                      style={{
                        ...inputStyle,
                        flex: 1,
                        marginBottom: 0,
                        minWidth: "160px",
                        fontWeight: item.esGrupo ? 700 : 400,
                        background: item.esGrupo ? "#f0f4ff" : "#fff",
                        borderColor: item.esGrupo ? "#c5d5f0" : "#ddd"
                      }}
                      value={item.descripcion}
                      onChange={e => updateItem(idx, "descripcion", e.target.value)}
                      placeholder={item.esGrupo ? "Nombre del grupo..." : "Descripción del ítem..."}
                    />
                    {!item.esGrupo && (
                      <select
                        style={{ ...inputStyle, width: "auto", marginBottom: 0, fontSize: "0.78rem", flexShrink: 0 }}
                        value={item.tipoColumna || "checklist"}
                        onChange={e => updateItem(idx, "tipoColumna", e.target.value)}
                      >
                        <option value="checklist">✅ Checklist</option>
                        <option value="tiempo">⏱ Tiempo (seg)</option>
                        <option value="texto">📝 Texto</option>
                      </select>
                    )}
                    <button onClick={() => removeItem(idx)} style={removeBtnStyle}>✕</button>
                  </div>
                ))}
                <button onClick={addItem} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px dashed #ccc", background: "#f8f9fa", cursor: "pointer", fontSize: "0.85rem", color: "#666", marginTop: "4px" }}>
                  + Agregar ítem
                </button>
              </div>
            )}

            {/* TABLE columns */}
            {form.tipo === "tabla_piso" && (
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Columnas de la tabla</label>
                {(form.columnas || []).map((col, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                    <input
                      style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                      value={col}
                      onChange={e => setForm(f => ({ ...f, columnas: f.columnas!.map((c, i) => i === idx ? e.target.value : c) }))}
                      placeholder={`Columna ${idx + 1}`}
                    />
                    <button onClick={() => removeCol(idx)} style={removeBtnStyle}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: "8px" }}>
                  <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} value={newCol} onChange={e => setNewCol(e.target.value)} placeholder="Nueva columna..." onKeyDown={e => e.key === "Enter" && addColumn()} />
                  <button onClick={addColumn} style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid var(--primary-blue)", background: "transparent", cursor: "pointer", color: "var(--primary-blue)", fontWeight: 700 }}>+</button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid #eee", paddingTop: "20px" }}>
              <button onClick={() => setModal(null)} style={{ padding: "12px 24px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-red" style={{ padding: "12px 30px" }}>
                {saving ? "Guardando..." : "💾 Guardar Plantilla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 700,
  color: "var(--text-dark)",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "6px",
  border: "1px solid #ddd",
  fontSize: "0.9rem",
  marginBottom: "4px",
};
const removeBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #ffddd9",
  background: "#fff5f4",
  cursor: "pointer",
  color: "var(--primary-red)",
  fontWeight: 700,
  flexShrink: 0,
};
