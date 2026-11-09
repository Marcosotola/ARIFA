// Envío de mails con Resend (https://resend.com) por su API HTTP, sin dependencias.
// Variables de entorno:
//   RESEND_API_KEY  clave de la cuenta de Resend. Sin ella no se envía nada (la app sigue andando).
//   RESEND_FROM     remitente, con un dominio verificado en Resend.
//                   Por defecto "ARIFA Capacitaciones <capacitaciones@arifa.com.ar>".

export function emailConfigurado() {
  return !!process.env.RESEND_API_KEY;
}

export function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function enviarMail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY no configurada: no se envió el mail a", to);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "ARIFA Capacitaciones <capacitaciones@arifa.com.ar>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("Resend respondió", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error enviando mail con Resend:", err);
    return false;
  }
}
