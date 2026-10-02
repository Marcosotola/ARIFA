import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from 'firebase-admin';

// Convierte la fecha del próximo cobro de MP en el vencimiento de ARIFA: fin de ese día
// en hora argentina, igual que cuando el superadmin carga el vencimiento a mano.
function vencimientoDesdeProximoCobro(nextPaymentDate: string): Date {
  const dia = new Date(nextPaymentDate).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  return new Date(`${dia}T23:59:59-03:00`);
}

async function getPreapproval(subId: string) {
  const response = await fetch(`https://api.mercadopago.com/preapproval/${subId}`, {
    headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });
  return response.json();
}

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

    const subRef = adminDb.collection("configuracion").doc("suscripcion");

    if (type === "payment" && id) {
      const accessToken = process.env.MP_ACCESS_TOKEN;
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });

      const paymentData = await response.json();

      // card_validation es el cobro mínimo (y luego devuelto) con el que MP valida una tarjeta
      // al cargarla o cambiarla: no es una mensualidad y no debe extender el vencimiento.
      if (paymentData.status === "approved" && paymentData.operation_type !== "card_validation") {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        let vencimiento = nextMonth;

        // Si hay suscripción recurrente, el vencimiento sigue el ciclo de MP (ej. todos los 5)
        // aunque el cobro se acredite con demora. Si MP todavía no avanzó el próximo cobro
        // (menos de 7 días), se usa hoy + 1 mes como antes.
        const subSnap = await subRef.get();
        const subId = subSnap.data()?.subId;
        if (subId) {
          try {
            const subData = await getPreapproval(subId);
            if (subData.next_payment_date) {
              const proximo = vencimientoDesdeProximoCobro(subData.next_payment_date);
              if (proximo.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) {
                vencimiento = proximo;
              }
            }
          } catch (e) {
            console.error("Error fetching preapproval for payment:", e);
          }
        }

        await subRef.update({
          estado: "activo",
          vencimiento: admin.firestore.Timestamp.fromDate(vencimiento),
          ultimoPago: admin.firestore.Timestamp.now(),
          lastPaymentId: id,
          tipoPago: paymentData.operation_type
        });

        await adminDb.collection("pagos_suscripcion").add({
          paymentId: id,
          monto: paymentData.transaction_amount,
          fecha: admin.firestore.Timestamp.now(),
          estado: "aprobado",
          email: paymentData.payer?.email || "N/A",
          metodo: paymentData.payment_method_id,
          tipo: paymentData.operation_type
        });
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
        if (subData.next_payment_date) {
          const proximo = vencimientoDesdeProximoCobro(subData.next_payment_date);
          if (proximo.getTime() > Date.now()) {
            update.vencimiento = admin.firestore.Timestamp.fromDate(proximo);
          }
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
