import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  const { certId } = await params;

  try {
    const certSnap = await adminDb.collection("certificados").doc(certId).get();
    if (!certSnap.exists) {
      return NextResponse.json({ error: "Certificado no encontrado" }, { status: 404 });
    }

    const cert = certSnap.data() as any;

    const otIds: string[] = cert.inspeccionesVinculadas || [];
    const ots: any[] = [];
    for (const otId of otIds) {
      try {
        const otSnap = await adminDb.collection("ordenes_trabajo").doc(otId).get();
        if (otSnap.exists) {
          ots.push({ id: otSnap.id, ...otSnap.data() });
        }
      } catch {}
    }

    return NextResponse.json({ cert, ots });
  } catch (err) {
    console.error("Error fetching certificado:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
