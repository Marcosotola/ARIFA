import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from 'firebase-admin';

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

        await adminDb.collection("configuracion").doc("suscripcion").update({
          estado: "activo",
          vencimiento: admin.firestore.Timestamp.fromDate(nextMonth),
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
      // Manejo de Suscripciones (Preapproval)
      const accessToken = process.env.MP_ACCESS_TOKEN;
      const response = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });

      const subData = await response.json();

      if (subData.status === "authorized") {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        await adminDb.collection("configuracion").doc("suscripcion").update({
          estado: "activo",
          vencimiento: admin.firestore.Timestamp.fromDate(nextMonth),
          ultimoPago: admin.firestore.Timestamp.now(),
          subId: id,
          updatedAt: admin.firestore.Timestamp.now()
        });
        console.log("Subscription activated via preapproval:", id);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
