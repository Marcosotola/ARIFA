import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ empresas: [] });

  try {
    const snap = await adminDb.collection("usuarios").where("rol", "==", "cliente").get();
    const empresas = snap.docs
      .map(d => {
        const data = d.data();
        return { id: d.id, nombre: data.nombre || "", apellido: data.apellido || "", empresa: data.empresa || "" };
      })
      .filter(c => `${c.nombre} ${c.apellido} ${c.empresa}`.toLowerCase().includes(q))
      .slice(0, 20);
    return NextResponse.json({ empresas });
  } catch (err) {
    console.error("Error buscando empresas:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
