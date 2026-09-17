import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { subId, costo } = await request.json();

    if (!subId) {
      return NextResponse.json({ error: "Falta el ID de la suscripción (subId)" }, { status: 400 });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Mercado Pago Access Token not configured" }, { status: 500 });
    }

    // Actualiza el monto de cobro recurrente de un Preapproval ya existente
    const response = await fetch(`https://api.mercadopago.com/preapproval/${subId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auto_recurring: {
          transaction_amount: Number(costo),
        },
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

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error updating MP preapproval:", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
