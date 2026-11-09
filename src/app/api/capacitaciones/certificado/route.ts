import { NextRequest, NextResponse } from "next/server";
import { datosCertificado } from "@/lib/capacitacionesServer";

// Datos para armar el PDF del certificado. El código es el id del examen final aprobado.
export async function GET(req: NextRequest) {
  const codigo = new URL(req.url).searchParams.get("codigo") || "";
  if (!codigo) return NextResponse.json({ error: "Falta el código" }, { status: 400 });
  try {
    const certificado = await datosCertificado(codigo);
    if (!certificado) return NextResponse.json({ error: "Certificado no encontrado" }, { status: 404 });
    return NextResponse.json({ certificado });
  } catch (err) {
    console.error("Error en /api/capacitaciones/certificado:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
