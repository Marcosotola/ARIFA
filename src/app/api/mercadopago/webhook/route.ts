import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import * as admin from 'firebase-admin';
import { limiteDelDiaDeCobro, mpGet, registrarPagoAprobado, subRef as getSubRef } from "@/lib/suscripcionMP";

const getPreapproval = (subId: string) => mpGet(`/preapproval/${subId}`);

// Valida el header x-signature que manda MP (HMAC SHA256 con la clave secreta del panel
// de Webhooks). Sin MP_WEBHOOK_SECRET configurado no se puede validar y se deja pasar.
function firmaValida(request: Request, dataId: string | null): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("MP_WEBHOOK_SECRET no configurado, se omite la validación de firma");
    return true;
  }

  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id");
  const partes = Object.fromEntries(
    xSignature.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string])
  );
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  let manifest = "";
  if (dataId) manifest += `id:${dataId.toLowerCase()};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const esperado = createHmac("sha256", secret).update(manifest).digest("hex");
  return esperado.length === v1.length && timingSafeEqual(Buffer.from(esperado), Buffer.from(v1));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = body.type || body.topic;
    const id = body.data?.id || body.id;

    const dataIdQuery = new URL(request.url).searchParams.get("data.id");
    if (!firmaValida(request, dataIdQuery)) {
      console.warn("Webhook MP: firma inválida");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const subRef = getSubRef();

    if (type === "payment" && id) {
      const paymentData = await mpGet(`/v1/payments/${id}`);

      // card_validation es el cobro mínimo (y luego devuelto) con el que MP valida una tarjeta
      // al cargarla o cambiarla: no es una mensualidad y no debe extender el vencimiento.
      // El vencimiento sigue el ciclo de MP (ver vencimientoDesdeProximoCobro).
      if (paymentData.status === "approved" && paymentData.operation_type !== "card_validation") {
        await registrarPagoAprobado(String(id), paymentData);
      }
    } else if ((type === "subscription_preapproval" || body.entity === "preapproval") && id) {
      // Manejo de Suscripciones (Preapproval). MP también notifica acá cuando se modifica
      // la suscripción (cambio de monto o de medio de pago) o cuando se cancela, así que el
      // vencimiento se toma del próximo cobro real y no de "hoy + 1 mes", para no correr el ciclo.
      const subData = await getPreapproval(id);
      const sub = (await subRef.get()).data();

      // Es la suscripción vigente, o una nueva creada desde el último plan que generamos.
      const esLaVigente = sub?.subId === id;
      const esDeNuestroPlan = !!sub?.planId && subData.preapproval_plan_id === sub.planId;

      if (subData.status === "authorized" && (esLaVigente || esDeNuestroPlan || !sub?.subId)) {
        const update: Record<string, unknown> = {
          estado: "activo",
          subId: id,
          mpStatus: "authorized",
          payerEmail: subData.payer_email || sub?.payerEmail || null,
          updatedAt: admin.firestore.Timestamp.now()
        };
        if (subData.next_payment_date && new Date(subData.next_payment_date).getTime() > Date.now()) {
          update.vencimiento = admin.firestore.Timestamp.fromDate(limiteDelDiaDeCobro(new Date(subData.next_payment_date)));
        }

        await subRef.update(update);
        console.log("Subscription updated via preapproval:", id);
      } else if (esLaVigente && subData.status) {
        // Cancelada o pausada: se registra para que la página deje renovar. El acceso sigue
        // hasta el vencimiento ya pagado (el layout bloquea por fecha).
        await subRef.update({
          mpStatus: subData.status,
          updatedAt: admin.firestore.Timestamp.now()
        });
        console.log(`Subscription ${id} status: ${subData.status}`);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
