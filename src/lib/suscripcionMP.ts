// Uso exclusivo en server. Registra los pagos de la suscripción de ARIFA (desde el webhook)
// y, antes de bloquear por vencimiento, le confirma a MP si el cobro del mes entró aunque
// su notificación todavía no haya llegado o se haya perdido.
import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

// Cada cuánto, como mucho, se le vuelve a preguntar a MP antes de bloquear.
const VERIFICACION_THROTTLE_MS = 5 * 60 * 1000;
// Un cobro cuenta para el mes vencido si se hizo desde un par de días antes del vencimiento:
// así un pago viejo nunca destraba un ciclo impago.
const VENTANA_COBRO_MS = 2 * 24 * 60 * 60 * 1000;

export const subRef = () => adminDb.collection("configuracion").doc("suscripcion");

export async function mpGet(path: string) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`MP GET ${path} respondió ${response.status}`);
  return response.json();
}

function sumarUnMes(fecha: Date): Date {
  const resultado = new Date(fecha);
  resultado.setMonth(resultado.getMonth() + 1);
  return resultado;
}

// El vencimiento es la fecha y hora exacta del próximo cobro de MP: si a esa hora no entró
// el pago, la app se bloquea en el acto. Si MP todavía no avanzó el próximo cobro (queda a
// menos de 7 días), se le suma un mes a ese mismo cobro para no correr el ciclo.
export function vencimientoDesdeProximoCobro(nextPaymentDate?: string | null): Date {
  const proximo = nextPaymentDate ? new Date(nextPaymentDate) : null;
  if (proximo && proximo.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) return proximo;
  return sumarUnMes(proximo || new Date());
}

export async function registrarPagoAprobado(paymentId: string, paymentData: any) {
  const ref = subRef();
  const sub = (await ref.get()).data();
  // MP reintenta la notificación si no respondemos a tiempo: un pago ya registrado no se
  // vuelve a cargar (antes quedaba duplicado en pagos_suscripcion).
  if (String(sub?.lastPaymentId) === String(paymentId)) return;

  // Pago suelto (sin suscripción): cubre un mes desde hoy.
  let vencimiento = sumarUnMes(new Date());
  if (sub?.subId) {
    try {
      const subData = await mpGet(`/preapproval/${sub.subId}`);
      vencimiento = vencimientoDesdeProximoCobro(subData.next_payment_date);
    } catch (e) {
      console.error("Error fetching preapproval for payment:", e);
    }
  }

  await ref.update({
    estado: "activo",
    vencimiento: admin.firestore.Timestamp.fromDate(vencimiento),
    ultimoPago: admin.firestore.Timestamp.now(),
    lastPaymentId: String(paymentId),
    tipoPago: paymentData.operation_type,
  });

  await adminDb.collection("pagos_suscripcion").add({
    paymentId: String(paymentId),
    monto: paymentData.transaction_amount,
    fecha: admin.firestore.Timestamp.now(),
    estado: "aprobado",
    email: paymentData.payer?.email || "N/A",
    metodo: paymentData.payment_method_id,
    tipo: paymentData.operation_type,
  });
}

// Devuelve true si encontró en MP el cobro del mes vencido y lo registró.
export async function verificarCobroAntesDeBloquear(): Promise<boolean> {
  const ref = subRef();
  const sub = (await ref.get()).data();
  const vencimiento: Date | null = sub?.vencimiento?.toDate?.() ?? null;
  if (!sub?.subId || !vencimiento || vencimiento > new Date()) return false;

  const ultima: Date | null = sub.ultimaVerificacionMP?.toDate?.() ?? null;
  if (ultima && Date.now() - ultima.getTime() < VERIFICACION_THROTTLE_MS) return false;
  await ref.update({ ultimaVerificacionMP: admin.firestore.Timestamp.now() });

  // La primera página trae los cobros más recientes (MP no acepta más de 12 por página).
  const { results = [] } = await mpGet(`/authorized_payments/search?preapproval_id=${sub.subId}&limit=12`);
  const desde = vencimiento.getTime() - VENTANA_COBRO_MS;
  const cobro = results.find(
    (c: any) => c.payment?.status === "approved" && new Date(c.debit_date || c.date_created).getTime() >= desde
  );
  if (!cobro) return false;

  const paymentData = await mpGet(`/v1/payments/${cobro.payment.id}`);
  await registrarPagoAprobado(String(cobro.payment.id), paymentData);
  return true;
}
