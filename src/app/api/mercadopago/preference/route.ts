import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { costo, email } = await request.json();

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Mercado Pago Access Token not configured" }, { status: 500 });
    }

    // Usamos el endpoint de Preapproval para suscripciones recurrentes
    const response = await fetch("https://api.mercadopago.com/preapproval", {
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
        payer_email: email,
        status: "pending",
        external_reference: "arifa-subscription-recurring"
      }),
    });

    const data = await response.json();
    
    // El link de suscripción viene en init_point
    return NextResponse.json({ id: data.id, init_point: data.init_point });
  } catch (error) {
    console.error("Error creating MP subscription:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
