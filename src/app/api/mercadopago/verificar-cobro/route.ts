import { NextResponse } from "next/server";
import { verificarCobroAntesDeBloquear } from "@/lib/suscripcionMP";

// La llaman el sitio y el panel cuando ven la suscripción vencida, antes de mostrar el
// bloqueo: si MP ya cobró y su notificación no llegó, se registra el pago y el onSnapshot de
// la suscripción destraba solo. Es pública a propósito (el sitio la usa sin sesión), pero
// solo lee de MP con nuestro token y únicamente registra cobros reales de nuestra
// suscripción, con un tope de una consulta cada 5 minutos.
export async function POST() {
  try {
    const registrado = await verificarCobroAntesDeBloquear();
    return NextResponse.json({ registrado });
  } catch (error) {
    console.error("Error verificando el cobro de la suscripción en MP:", error);
    return NextResponse.json({ registrado: false }, { status: 500 });
  }
}
