import { FileImage, FileText, FileVideo, Presentation, File as FileIcon, type LucideIcon } from "lucide-react";

export type TipoArchivo = "imagen" | "pdf" | "video" | "ppt" | "otro";

export interface ArchivoTema {
  url: string;
  nombre: string;
  tipo: TipoArchivo;
  mimeType: string;
}

export interface CapacitacionTema {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  archivos: ArchivoTema[];
  puntajeMinimo?: number;
  cantidadPreguntasExamen?: number;
  createdAt?: any;
  updatedAt?: any;
}

export const DEFAULT_PUNTAJE_MINIMO = 70;
export const DEFAULT_CANTIDAD_PREGUNTAS_EXAMEN = 10;

export interface PersonalCapacitacion {
  id: string;
  empresaId: string;
  empresaNombre: string;
  nombre: string;
  apellido: string;
  dni: string;
  email?: string;
  sedeId?: string;
  sedeNombre?: string;
  activo: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface OpcionPregunta {
  id: string;
  texto: string;
}

export interface PreguntaCapacitacion {
  id: string;
  temaId: string;
  enunciado: string;
  opciones: OpcionPregunta[];
  respuestaCorrectaId: string;
  puntaje: number;
  createdAt?: any;
  updatedAt?: any;
}

export function crearOpcionVacia(): OpcionPregunta {
  return { id: crypto.randomUUID(), texto: "" };
}

export interface IntentoExamen {
  id: string;
  personalId: string;
  empresaId: string;
  temaId: string;
  tipo: "previo" | "posterior";
  numeroIntento: number;
  preguntasIds: string[];
  opcionesOrden: Record<string, string[]>;
  estado: "en_progreso" | "finalizado";
  excluido?: boolean;
  respuestas?: Record<string, string>;
  puntajeObtenido?: number;
  puntajeMaximo?: number;
  porcentaje?: number;
  aprobado?: boolean;
  iniciadoEn?: any;
  finalizadoEn?: any;
}

export type ProximoExamen =
  | { disponible: true; tipo: "previo" | "posterior"; numeroIntento: number }
  | { disponible: false; motivo: string };

export function determinarProximoExamen(intentos: IntentoExamen[]): ProximoExamen {
  const activos = intentos.filter(i => i.estado === "finalizado" && !i.excluido);
  const previo = activos.find(i => i.tipo === "previo");
  if (!previo) return { disponible: true, tipo: "previo", numeroIntento: 1 };

  const posteriores = activos.filter(i => i.tipo === "posterior").sort((a, b) => a.numeroIntento - b.numeroIntento);
  if (posteriores.some(i => i.aprobado)) return { disponible: false, motivo: "Ya aprobaste este tema." };
  if (posteriores.length === 0) return { disponible: true, tipo: "posterior", numeroIntento: 1 };
  if (posteriores.length === 1) return { disponible: true, tipo: "posterior", numeroIntento: 2 };
  return { disponible: false, motivo: "Debés recapacitarte antes de un nuevo intento. Contactá a tu empresa o al administrador." };
}

export function detectarTipoArchivo(file: File): TipoArchivo {
  const mime = file.type || "";
  const name = file.name.toLowerCase();

  if (mime.startsWith("image/")) return "imagen";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("video/")) return "video";
  if (
    mime === "application/vnd.ms-powerpoint" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    name.endsWith(".ppt") || name.endsWith(".pptx")
  ) return "ppt";

  // Fallback por extensión: algunos navegadores/SO entregan File.type vacío
  if (/\.(jpe?g|png|gif|webp|bmp|svg)$/.test(name)) return "imagen";
  if (/\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video";
  return "otro";
}

export const TIPO_META: Record<TipoArchivo, { icon: LucideIcon; color: string; label: string }> = {
  imagen: { icon: FileImage, color: "#16a34a", label: "Imagen" },
  pdf: { icon: FileText, color: "#dc2626", label: "PDF" },
  video: { icon: FileVideo, color: "#7c3aed", label: "Video" },
  ppt: { icon: Presentation, color: "#ea580c", label: "PowerPoint" },
  otro: { icon: FileIcon, color: "#6b7280", label: "Archivo" },
};
