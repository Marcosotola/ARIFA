import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { emailConfigurado, emailValido } from "@/lib/email";
import { enviarCertificado } from "@/lib/capacitacionesServer";

function normalizarDni(v: string) {
  return (v || "").replace(/\D/g, "");
}

// La persona deja (o corrige) su email al aprobar: se guarda en su ficha y se le manda el certificado.
export async function POST(req: NextRequest) {
  try {
    const { personalId, dni, codigo, email } = await req.json();
    const mail = String(email || "").trim().toLowerCase();
    if (!personalId || !dni || !codigo || !mail) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    if (!emailValido(mail)) return NextResponse.json({ error: "El email no es válido" }, { status: 400 });

    const personaRef = adminDb.collection("capacitaciones_personal").doc(personalId);
    const personaSnap = await personaRef.get();
    if (!personaSnap.exists || normalizarDni(personaSnap.data()!.dni) !== normalizarDni(dni)) {
      return NextResponse.json({ error: "No se pudo verificar tu identidad" }, { status: 400 });
    }
    const intentoSnap = await adminDb.collection("capacitaciones_intentos").doc(codigo).get();
    if (!intentoSnap.exists || intentoSnap.data()!.personalId !== personalId) {
      return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 });
    }

    await personaRef.update({ email: mail, updatedAt: FieldValue.serverTimestamp() });
    const enviado = await enviarCertificado(codigo, mail);
    return NextResponse.json({ email: mail, enviado, mailActivo: emailConfigurado() });
  } catch (err) {
    console.error("Error en /api/capacitaciones/email:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
