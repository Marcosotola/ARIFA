// Funciones de capacitaciones que solo corren en el servidor (Admin SDK + mail).
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { enviarMail, emailConfigurado } from "@/lib/email";
import type { CertificadoCapacitacion } from "@/lib/capacitaciones";

const SITE_URL = "https://www.arifa.com.ar";

export function urlCertificado(codigo: string) {
  return `${SITE_URL}/capacitaciones/certificado/${codigo}`;
}

/** Datos del certificado de un examen final aprobado, o null si el intento no es un final aprobado. */
export async function datosCertificado(intentoId: string): Promise<CertificadoCapacitacion | null> {
  const intentoSnap = await adminDb.collection("capacitaciones_intentos").doc(intentoId).get();
  if (!intentoSnap.exists) return null;
  const intento = intentoSnap.data()!;
  if (intento.tipo !== "posterior" || intento.estado !== "finalizado" || intento.aprobado !== true) return null;

  const [personaSnap, empresaSnap, temaSnap] = await Promise.all([
    adminDb.collection("capacitaciones_personal").doc(intento.personalId).get(),
    adminDb.collection("usuarios").doc(intento.empresaId).get(),
    adminDb.collection("capacitaciones_temas").doc(intento.temaId).get(),
  ]);
  const persona = personaSnap.data() || {};
  const empresa = empresaSnap.data() || {};
  const fecha = intento.finalizadoEn?.toDate ? intento.finalizadoEn.toDate() : new Date();

  return {
    codigo: intentoId,
    nombre: persona.nombre || "",
    apellido: persona.apellido || "",
    dni: persona.dni || "",
    empresa: empresa.empresa || `${empresa.nombre || ""} ${empresa.apellido || ""}`.trim(),
    sede: persona.sedeNombre || "",
    tema: temaSnap.data()?.nombre || "",
    fecha: fecha.toISOString(),
    porcentaje: intento.porcentaje ?? 0,
  };
}

/** Manda por mail el link del certificado. Devuelve true si salió. Sin Resend configurado no hace nada. */
export async function enviarCertificado(intentoId: string, email: string): Promise<boolean> {
  if (!emailConfigurado()) return false;
  const c = await datosCertificado(intentoId);
  if (!c) return false;

  const link = urlCertificado(intentoId);
  const enviado = await enviarMail({
    to: email,
    subject: `Certificado de aprobación – ${c.tema}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#333">
        <h2 style="color:#002244">¡Felicitaciones, ${c.nombre}!</h2>
        <p>Aprobaste la capacitación <b>${c.tema}</b> con una calificación del <b>${c.porcentaje}%</b>.</p>
        <p>Podés descargar tu certificado de aprobación desde este enlace:</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${link}" style="background:#A31F1D;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Descargar certificado</a>
        </p>
        <p style="font-size:12px;color:#888">Si el botón no funciona, copiá este enlace: ${link}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#888">ARIFA – Seguridad e Higiene Laboral · Lorenzo Barcala 727, Córdoba · www.arifa.com.ar</p>
      </div>`,
  });
  if (enviado) {
    await adminDb.collection("capacitaciones_intentos").doc(intentoId).update({
      certificadoEnviadoA: email,
      certificadoEnviadoEn: FieldValue.serverTimestamp(),
    });
  }
  return enviado;
}
