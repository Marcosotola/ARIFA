import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = body.type || body.topic;
    const id = body.data?.id || body.id;

    if (type === "payment" && id) {
      const accessToken = process.env.MP_ACCESS_TOKEN;
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });

      const paymentData = await response.json();

      if (paymentData.status === "approved") {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        let vencimiento = nextMonth;

        // Si hay suscripción recurrente, el vencimiento sigue el ciclo de MP (ej. todos los 5)
        // aunque el cobro se acredite con demora. Si MP todavía no avanzó el próximo cobro
        // (menos de 7 días), se usa hoy + 1 mes como antes.
        const subSnap = await adminDb.collection("configuracion").doc("suscripcion").get();
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

        await adminDb.collection("configuracion").doc("suscripcion").update({
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
      // la suscripción (cambio de monto o de medio de pago), así que el vencimiento se toma
      // del próximo cobro real y no de "hoy + 1 mes", para no correr el ciclo.
      const subData = await getPreapproval(id);

      if (subData.status === "authorized") {
        const update: Record<string, unknown> = {
          estado: "activo",
          subId: id,
          updatedAt: admin.firestore.Timestamp.now()
        };
        if (subData.next_payment_date) {
          const proximo = vencimientoDesdeProximoCobro(subData.next_payment_date);
          if (proximo.getTime() > Date.now()) {
            update.vencimiento = admin.firestore.Timestamp.fromDate(proximo);
          }
        }

        await adminDb.collection("configuracion").doc("suscripcion").update(update);
        console.log("Subscription updated via preapproval:", id);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
