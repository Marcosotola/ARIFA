import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export type SearchTipo =
  | "cliente"
  | "presupuesto"
  | "recibo"
  | "remito"
  | "estadoCuenta"
  | "certificado"
  | "hys"
  | "planAccion"
  | "orden"
  | "remitoMatafuegos"
  | "fichaMatafuegos"
  | "matafuegoActivo"
  | "producto"
  | "consulta";

export interface SearchResult {
  tipo: SearchTipo;
  id: string;
  titulo: string;
  subtitulo: string;
  texto: string;
  clienteNombre?: string;
  sedeNombre?: string;
  fecha: Date | null;
  url: string;
}

export const SEARCH_TYPES: Record<SearchTipo, { label: string; color: string }> = {
  cliente: { label: "Clientes", color: "#7c3aed" },
  presupuesto: { label: "Presupuestos", color: "#0061ff" },
  recibo: { label: "Recibos", color: "#16a34a" },
  remito: { label: "Remitos", color: "#0d9488" },
  estadoCuenta: { label: "Estado de Cuenta", color: "#b45309" },
  certificado: { label: "Certificados", color: "#0369a1" },
  hys: { label: "HyS", color: "#15803d" },
  planAccion: { label: "Plan de Acción", color: "#6b46c1" },
  orden: { label: "Inspecciones / Órdenes", color: "#2b6cb0" },
  remitoMatafuegos: { label: "Remitos Matafuegos", color: "#c2410c" },
  fichaMatafuegos: { label: "Fichas Matafuegos", color: "#ea580c" },
  matafuegoActivo: { label: "Matafuegos (Inventario)", color: "#dc2626" },
  producto: { label: "Productos", color: "#b45309" },
  consulta: { label: "Consultas", color: "#A31F1D" },
};

function parseFecha(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "string") {
    const d = new Date(v.length === 10 ? v + "T12:00:00" : v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  if (v instanceof Date) return v;
  return null;
}

const pad = (n: any, len: number) => String(n || "?").padStart(len, "0");

type Scope = "public" | "clienteId" | "staffOnly";

interface CollectionConfig {
  name: string;
  tipo: SearchTipo;
  scope: Scope;
  hiddenFromRoles?: string[];
  map: (id: string, d: any) => Omit<SearchResult, "tipo" | "id">;
}

const COLLECTIONS: CollectionConfig[] = [
  {
    name: "usuarios",
    tipo: "cliente",
    scope: "staffOnly",
    map: (id, u) => {
      const nombre = [u.nombre, u.apellido].filter(Boolean).join(" ") || u.email;
      const sedesTexto = (u.sedes || []).map((s: any) => `${s.nombre || ""} ${s.direccion || ""}`).join(" ");
      return {
        titulo: nombre,
        subtitulo: u.empresa || u.email || "",
        clienteNombre: nombre,
        sedeNombre: undefined,
        fecha: parseFecha(u.fechaCreacion),
        url: "/admin/usuarios",
        texto: [nombre, u.empresa, u.email, u.dniCuit, u.telefono, u.rol, sedesTexto].filter(Boolean).join(" ").toLowerCase(),
      };
    },
  },
  {
    name: "presupuestos",
    tipo: "presupuesto",
    scope: "clienteId",
    hiddenFromRoles: ["tecnico"],
    map: (id, p) => {
      const titulo = `P-${pad(p.numero, 5)}`;
      const cliente = [p.clienteNombre, p.clienteApellido].filter(Boolean).join(" ");
      return {
        titulo,
        subtitulo: [cliente, p.sedeNombre].filter(Boolean).join(" · "),
        clienteNombre: cliente,
        sedeNombre: p.sedeNombre,
        fecha: parseFecha(p.fecha),
        url: `/admin/documentos/presupuestos/${id}`,
        texto: [titulo, cliente, p.clienteEmpresa, p.sedeNombre, p.estado].filter(Boolean).join(" ").toLowerCase(),
      };
    },
  },
  {
    name: "recibos",
    tipo: "recibo",
    scope: "clienteId",
    map: (id, r) => {
      const titulo = `RC-${pad(r.numero, 5)}`;
      const cliente = [r.clienteNombre, r.clienteApellido].filter(Boolean).join(" ");
      return {
        titulo,
        subtitulo: [cliente, r.sedeNombre].filter(Boolean).join(" · "),
        clienteNombre: cliente,
        sedeNombre: r.sedeNombre,
        fecha: parseFecha(r.fecha),
        url: `/admin/documentos/recibos/${id}`,
        texto: [titulo, cliente, r.clienteEmpresa, r.sedeNombre, r.concepto, r.formaPago].filter(Boolean).join(" ").toLowerCase(),
      };
    },
  },
  {
    name: "remitos_doc",
    tipo: "remito",
    scope: "clienteId",
    map: (id, r) => {
      const titulo = `RM-${pad(r.numero, 5)}`;
      const cliente = [r.clienteNombre, r.clienteApellido].filter(Boolean).join(" ");
      return {
        titulo,
        subtitulo: [cliente, r.sedeNombre].filter(Boolean).join(" · "),
        clienteNombre: cliente,
        sedeNombre: r.sedeNombre,
        fecha: parseFecha(r.fecha),
        url: `/admin/documentos/remitos/${id}`,
        texto: [titulo, cliente, r.clienteEmpresa, r.sedeNombre, r.descripcionGeneral].filter(Boolean).join(" ").toLowerCase(),
      };
    },
  },
  {
    name: "estados-cuenta",
    tipo: "estadoCuenta",
    scope: "clienteId",
    hiddenFromRoles: ["tecnico"],
    map: (id, e) => {
      const titulo = `EC-${pad(e.numero, 5)}`;
      const cliente = [e.clienteNombre, e.clienteApellido].filter(Boolean).join(" ");
      return {
        titulo,
        subtitulo: [cliente, e.sedeNombre].filter(Boolean).join(" · "),
        clienteNombre: cliente,
        sedeNombre: e.sedeNombre,
        fecha: parseFecha(e.fecha),
        url: `/admin/documentos/estado-cuenta/${id}`,
        texto: [titulo, cliente, e.clienteEmpresa, e.sedeNombre].filter(Boolean).join(" ").toLowerCase(),
      };
    },
  },
  {
    name: "certificados",
    tipo: "certificado",
    scope: "clienteId",
    map: (id, c) => {
      const titulo = `N°${pad(c.numero, 4)}`;
      return {
        titulo,
        subtitulo: [c.clienteNombre, c.sedeNombre].filter(Boolean).join(" · "),
        clienteNombre: c.clienteNombre,
        sedeNombre: c.sedeNombre,
        fecha: parseFecha(c.fechaInspeccion),
        url: `/admin/certificados/${id}?view=true`,
        texto: [titulo, c.clienteNombre, c.clienteEmpresa, c.sedeNombre, c.sistemaCertificado, c.rubro, c.estado].filter(Boolean).join(" ").toLowerCase(),
      };
    },
  },
  {
    name: "hys_documentos",
    tipo: "hys",
    scope: "clienteId",
    map: (id, d) => ({
      titulo: d.cliente || "Documento HyS",
      subtitulo: [Array.isArray(d.tipo) ? d.tipo.join(", ") : d.tipo, d.sedeNombre].filter(Boolean).join(" · "),
      clienteNombre: d.cliente,
      sedeNombre: d.sedeNombre,
      fecha: parseFecha(d.fecha),
      url: "/admin/hys",
      texto: [d.cliente, d.sedeNombre, Array.isArray(d.tipo) ? d.tipo.join(" ") : d.tipo, d.descripcion].filter(Boolean).join(" ").toLowerCase(),
    }),
  },
  {
    name: "plan_accion",
    tipo: "planAccion",
    scope: "clienteId",
    map: (id, item) => ({
      titulo: item.cliente || "Plan de Acción",
      subtitulo: [item.sedeNombre || item.consorcio, item.prioridad].filter(Boolean).join(" · "),
      clienteNombre: item.cliente,
      sedeNombre: item.sedeNombre,
      fecha: parseFecha(item.fecha),
      url: "/admin/plan-accion",
      texto: [item.cliente, item.sedeNombre, item.consorcio, item.detalle, item.prioridad].filter(Boolean).join(" ").toLowerCase(),
    }),
  },
  {
    name: "ordenes_trabajo",
    tipo: "orden",
    scope: "clienteId",
    map: (id, d) => {
      const esIT = !!d.clienteNombre;
      const cliente = d.clienteNombre || d.cliente || "";
      const titulo = esIT ? `IT-${pad(d.numero, 4)}` : `OT-${pad(d.numero, 4)}`;
      return {
        titulo,
        subtitulo: [cliente, d.sedeNombre].filter(Boolean).join(" · "),
        clienteNombre: cliente,
        sedeNombre: d.sedeNombre,
        fecha: parseFecha(d.fecha || d.fechaCreacion),
        url: esIT ? `/admin/planillas/deteccion/${id}?view=true` : "/admin/ordenes",
        texto: [titulo, cliente, d.clienteEmpresa, d.sedeNombre, d.direccion, d.tipo, d.estado, d.tecnico].filter(Boolean).join(" ").toLowerCase(),
      };
    },
  },
  {
    name: "remitos_matafuegos",
    tipo: "remitoMatafuegos",
    scope: "clienteId",
    map: (id, r) => {
      const titulo = `R-${pad(r.numero, 5)}`;
      return {
        titulo,
        subtitulo: [r.clienteNombre, r.sedeNombre].filter(Boolean).join(" · "),
        clienteNombre: r.clienteNombre,
        sedeNombre: r.sedeNombre,
        fecha: parseFecha(r.fecha),
        url: `/admin/planillas/matafuegos/${id}?view=true`,
        texto: [titulo, r.clienteNombre, r.clienteEmpresa, r.sedeNombre, r.tipo].filter(Boolean).join(" ").toLowerCase(),
      };
    },
  },
  {
    name: "mantenimiento_matafuegos",
    tipo: "fichaMatafuegos",
    scope: "clienteId",
    map: (id, f) => {
      const titulo = `FT-${pad(f.numeroFicha, 5)}`;
      return {
        titulo,
        subtitulo: [f.clienteNombre, f.sedeNombre].filter(Boolean).join(" · "),
        clienteNombre: f.clienteNombre,
        sedeNombre: f.sedeNombre,
        fecha: parseFecha(f.fechaServicio),
        url: `/admin/planillas/matafuegos/mantenimiento/${id}?view=true`,
        texto: [titulo, f.clienteNombre, f.clienteEmpresa, f.sedeNombre, f.tecnicoNombre].filter(Boolean).join(" ").toLowerCase(),
      };
    },
  },
  {
    name: "matafuegos_activos",
    tipo: "matafuegoActivo",
    scope: "clienteId",
    map: (id, m) => ({
      titulo: m.nroTarjeta || "Extintor",
      subtitulo: [m.clienteNombre, m.sedeNombre].filter(Boolean).join(" · "),
      clienteNombre: m.clienteNombre,
      sedeNombre: m.sedeNombre,
      fecha: null,
      url: "/admin/planillas/matafuegos",
      texto: [m.nroTarjeta, m.clienteNombre, m.clienteEmpresa, m.sedeNombre, m.datosTecnicos?.marca, m.datosTecnicos?.agente].filter(Boolean).join(" ").toLowerCase(),
    }),
  },
  {
    name: "productos",
    tipo: "producto",
    scope: "public",
    map: (id, p) => ({
      titulo: p.titulo || "Producto",
      subtitulo: [p.categoria, p.proveedor].filter(Boolean).join(" · "),
      clienteNombre: undefined,
      sedeNombre: undefined,
      fecha: parseFecha(p.createdAt),
      url: "/admin/productos",
      texto: [p.titulo, p.categoria, p.proveedor].filter(Boolean).join(" ").toLowerCase(),
    }),
  },
  {
    name: "consultas",
    tipo: "consulta",
    scope: "staffOnly",
    map: (id, c) => ({
      titulo: c.nombre || c.email || "Consulta",
      subtitulo: [c.servicio, c.email].filter(Boolean).join(" · "),
      clienteNombre: c.nombre,
      sedeNombre: undefined,
      fecha: parseFecha(c.fecha),
      url: "/admin/consultas",
      texto: [c.nombre, c.email, c.servicio, c.mensaje, c.telefono].filter(Boolean).join(" ").toLowerCase(),
    }),
  },
];

export async function buildSearchIndex(role: string | null, uid: string | null): Promise<SearchResult[]> {
  const isCliente = role === "cliente";
  const results: SearchResult[] = [];

  await Promise.all(
    COLLECTIONS.map(async (cfg) => {
      if (isCliente && cfg.scope === "staffOnly") return;
      if (role && cfg.hiddenFromRoles?.includes(role)) return;
      try {
        const q =
          isCliente && cfg.scope === "clienteId" && uid
            ? query(collection(db, cfg.name), where("clienteId", "==", uid))
            : collection(db, cfg.name);
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          const mapped = cfg.map(docSnap.id, docSnap.data());
          results.push({ tipo: cfg.tipo, id: docSnap.id, ...mapped });
        }
      } catch {
        // Sin permiso en esta colección para el rol actual — se omite silenciosamente.
      }
    })
  );

  return results;
}

export interface SearchFilters {
  query: string;
  tipos?: SearchTipo[];
  dateFrom?: string;
  dateTo?: string;
}

export function filterResults(index: SearchResult[], filters: SearchFilters): SearchResult[] {
  const q = filters.query.trim().toLowerCase();
  const from = filters.dateFrom ? new Date(filters.dateFrom + "T00:00:00") : null;
  const to = filters.dateTo ? new Date(filters.dateTo + "T23:59:59") : null;

  return index
    .filter((r) => {
      if (q && !r.texto.includes(q)) return false;
      if (filters.tipos && filters.tipos.length > 0 && !filters.tipos.includes(r.tipo)) return false;
      if (from && (!r.fecha || r.fecha < from)) return false;
      if (to && (!r.fecha || r.fecha > to)) return false;
      return true;
    })
    .sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));
}
