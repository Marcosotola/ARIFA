import { NextResponse } from "next/server";
import * as admin from 'firebase-admin';
import { adminDb, adminAuth } from "@/lib/firebase-admin";

// Genera el link de suscripción con un Plan (preapproval_plan) en vez de un Preapproval
// con payer_email fijo: el plan no lleva email, así que quien abre el link autoriza con la
// cuenta de Mercado Pago que quiera. Con el email fijo, MP rechaza la autorización si no
// coincide exactamente con la cuenta con la que se inicia sesión.
// El webhook vincula la suscripción que se cree desde este plan comparando el planId.
export async function POST(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const { uid } = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection("usuarios").doc(uid).get();
    const rol = userSnap.data()?.rol;
    if (rol !== "admin" && rol !== "superadmin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Mercado Pago Access Token not configured" }, { status: 500 });
    }

    // El monto sale de Firestore, no del body: el admin no puede elegir cuánto pagar.
    const subRef = adminDb.collection("configuracion").doc("suscripcion");
    const subSnap = await subRef.get();
    const costo = Number(subSnap.data()?.costo);
    if (!costo || costo <= 0) {
      return NextResponse.json({ error: "No hay un costo de suscripción configurado" }, { status: 400 });
    }

    const response = await fetch("https://api.mercadopago.com/preapproval_plan", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: "Suscripción Mensual ARIFA",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: costo,
          currency_id: "ARS",
        },
        back_url: `${process.env.NEXT_PUBLIC_BASE_URL}/admin/config/suscripcion`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Mercado Pago Error Details:", data);
      return NextResponse.json({
        error: "Mercado Pago API Error",
        details: data.message || data.error || data
      }, { status: response.status });
    }

    await subRef.set({
      planId: data.id,
      updatedAt: admin.firestore.Timestamp.now()
    }, { merge: true });

    // El link de suscripción viene en init_point
    return NextResponse.json({ id: data.id, init_point: data.init_point });
  } catch (error: any) {
    console.error("Error creating MP subscription plan:", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
