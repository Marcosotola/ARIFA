import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const empresaId = searchParams.get("empresaId") || "";
  if (!empresaId) return NextResponse.json({ error: "empresaId es obligatorio" }, { status: 400 });

  try {
    const snap = await adminDb.collection("capacitaciones_personal").where("empresaId", "==", empresaId).get();
    const personal = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(p => p.activo === true)
      .map(p => ({ id: p.id, nombre: p.nombre || "", apellido: p.apellido || "" }))
      .sort((a, b) => a.apellido.localeCompare(b.apellido));
    return NextResponse.json({ personal });
  } catch (err) {
    console.error("Error listando personal:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
