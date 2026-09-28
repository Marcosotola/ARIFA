// Cuenta corriente de clientes: facturas, pagos y ajustes registrados uno por uno.
// El estado de cuenta NO se guarda: se calcula siempre a partir de estos movimientos, así el saldo nunca queda desactualizado.

export type TipoMovCuenta = "factura" | "pago" | "ajuste";

export interface MovCuenta {
  id: string;
  clienteKey: string; // clienteId si es un usuario registrado, o "n:<nombre>" para clientes migrados sin cuenta
  clienteId: string | null;
  clienteNombre: string;
  clienteEmpresa?: string;
  clienteCuit?: string;
  tipo: TipoMovCuenta;
  fecha: string; // YYYY-MM-DD
  comprobante: string; // N° de factura, de transferencia, E-Cheq, nota de crédito...
  descripcion: string;
  importe: number; // siempre positivo; el tipo define si suma o resta
  medioPago?: string; // solo pagos
  facturaRef?: string; // pago: id de la factura que cancela (opcional)
  libroId?: string | null; // pago: movimiento espejo en libro_contable
  migradoDe?: string; // id del estado de cuenta viejo del que salió
  createdAt?: { seconds: number } | null;
  creadoPorId?: string;
  creadoPorNombre?: string;
}

export const MEDIOS_PAGO_CUENTA = ["Transferencia", "E-Cheq", "Efectivo", "Cheque", "Débito", "Crédito", "QR", "Otro"];

export const TIPO_LABEL: Record<TipoMovCuenta, string> = { factura: "Factura", pago: "Pago", ajuste: "Ajuste" };

export const fmtMonto = (n: number) =>
  "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtFechaCuenta = (f: string) => (f ? f.split("-").reverse().join("/") : "");

export const hoyIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];

export function claveCliente(clienteId: string | null | undefined, nombre: string) {
  if (clienteId) return clienteId;
  return "n:" + nombre.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

// Nombre para mostrar de un usuario/cliente (empresa primero, que es lo que va en el estado de cuenta).
export function nombreCliente(c: { nombre?: string; apellido?: string; empresa?: string; razonSocial?: string; email?: string }) {
  const persona = [c.nombre, c.apellido].filter(Boolean).join(" ").trim();
  return (c.empresa || c.razonSocial || persona || c.email || "").trim();
}

const ORDEN_TIPO: Record<TipoMovCuenta, number> = { factura: 0, pago: 1, ajuste: 2 };

export function ordenarMovs(movs: MovCuenta[]) {
  return [...movs].sort((a, b) =>
    a.fecha.localeCompare(b.fecha) ||
    ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] ||
    (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)
  );
}

const efecto = (m: MovCuenta) => (m.tipo === "factura" ? m.importe : -m.importe);

export interface FilaEstado { mov: MovCuenta; saldo: number; }

export interface EstadoCalculado {
  saldoAnterior: number;
  filas: FilaEstado[];
  totalFacturado: number;
  totalPagos: number;
  totalAjustes: number;
  saldoFinal: number;
  cantFacturas: number;
  cantPagos: number;
  cantAjustes: number;
}

// desde/hasta vacíos = sin límite. Lo anterior a "desde" se resume en el saldo anterior,
// así el saldo pendiente siempre coincide con el último saldo acumulado de la tabla.
export function calcularEstado(movs: MovCuenta[], desde: string, hasta: string): EstadoCalculado {
  const orden = ordenarMovs(movs).filter(m => !hasta || m.fecha <= hasta);
  let saldo = 0;
  const filas: FilaEstado[] = [];
  let totalFacturado = 0, totalPagos = 0, totalAjustes = 0, cantFacturas = 0, cantPagos = 0, cantAjustes = 0;
  let saldoAnterior = 0;
  for (const m of orden) {
    saldo += efecto(m);
    if (desde && m.fecha < desde) { saldoAnterior = saldo; continue; }
    filas.push({ mov: m, saldo });
    if (m.tipo === "factura") { totalFacturado += m.importe; cantFacturas++; }
    else if (m.tipo === "pago") { totalPagos += m.importe; cantPagos++; }
    else { totalAjustes += m.importe; cantAjustes++; }
  }
  return {
    saldoAnterior, filas, totalFacturado, totalPagos, totalAjustes,
    saldoFinal: redondear(saldo), cantFacturas, cantPagos, cantAjustes,
  };
}

export const redondear = (n: number) => Math.round(n * 100) / 100;

export interface ResumenCliente {
  clienteKey: string;
  clienteId: string | null;
  nombre: string;
  cuit: string;
  facturado: number;
  pagado: number;
  ajustes: number;
  saldo: number;
  ultimaFecha: string;
}

export function resumenPorCliente(movs: MovCuenta[]): ResumenCliente[] {
  const mapa = new Map<string, ResumenCliente>();
  for (const m of movs) {
    const r = mapa.get(m.clienteKey) || {
      clienteKey: m.clienteKey, clienteId: m.clienteId, nombre: m.clienteNombre, cuit: m.clienteCuit || "",
      facturado: 0, pagado: 0, ajustes: 0, saldo: 0, ultimaFecha: "",
    };
    if (m.tipo === "factura") r.facturado += m.importe;
    else if (m.tipo === "pago") r.pagado += m.importe;
    else r.ajustes += m.importe;
    r.saldo = redondear(r.saldo + efecto(m));
    if (m.fecha > r.ultimaFecha) r.ultimaFecha = m.fecha;
    if (!r.cuit && m.clienteCuit) r.cuit = m.clienteCuit;
    mapa.set(m.clienteKey, r);
  }
  return Array.from(mapa.values()).sort((a, b) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre));
}

// Movimiento espejo en el Libro Contable para cada pago cobrado a un cliente de cuenta corriente.
export function libroDesdePago(m: Pick<MovCuenta, "fecha" | "importe" | "medioPago" | "clienteNombre" | "comprobante" | "descripcion">, cuentaMovId: string) {
  return {
    fecha: m.fecha,
    tipo: "ingreso" as const,
    monto: m.importe,
    medioPago: m.medioPago || "Otro",
    cliente: m.clienteNombre,
    telefono: "",
    concepto: ["Cobro cuenta corriente", m.comprobante, m.descripcion].filter(Boolean).join(" — "),
    categorias: [],
    origen: "cuenta_corriente",
    cuentaMovId,
  };
}
