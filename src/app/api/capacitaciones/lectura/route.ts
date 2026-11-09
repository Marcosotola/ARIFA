import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { materialPendiente, previoVigente, type IntentoExamen } from "@/lib/capacitaciones";

function normalizarDni(v: string) {
  return (v || "").replace(/\D/g, "");
}

/**
 * Marca un archivo del material como leído. Se guarda en el examen previo vigente de la persona
 * (`materialLeido`), así una recapacitación desde el panel lo puede reiniciar.
 */
export async function POST(req: NextRequest) {
  try {
    const { personalId, dni, temaId, url } = await req.json();
    if (!personalId || !dni || !temaId || !url) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const personalSnap = await adminDb.collection("capacitaciones_personal").doc(personalId).get();
    if (!personalSnap.exists) return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });
    const persona = personalSnap.data()!;
    if (normalizarDni(persona.dni) !== normalizarDni(dni)) {
      return NextResponse.json({ error: "El DNI no coincide" }, { status: 400 });
    }
    if (persona.activo !== true) {
      return NextResponse.json({ error: "Esta persona ya no está activa" }, { status: 400 });
    }

    const temaSnap = await adminDb.collection("capacitaciones_temas").doc(temaId).get();
    if (!temaSnap.exists || temaSnap.data()!.activo !== true) {
      return NextResponse.json({ error: "Tema no disponible" }, { status: 404 });
    }
    const archivos: { url: string }[] = temaSnap.data()!.archivos || [];
    if (!archivos.some(a => a.url === url)) {
      return NextResponse.json({ error: "Ese material ya no está en el tema. Recargá la página." }, { status: 400 });
    }

    const intentosSnap = await adminDb.collection("capacitaciones_intentos")
      .where("personalId", "==", personalId).get();
    const intentosDelTema = intentosSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as IntentoExamen))
      .filter(i => i.temaId === temaId);
    const previo = previoVigente(intentosDelTema);
    if (!previo) {
      return NextResponse.json({ error: "Primero tenés que rendir el examen previo." }, { status: 400 });
    }

    const materialLeido = Array.from(new Set([...(previo.materialLeido || []), url]));
    const cambios: Record<string, unknown> = { materialLeido: FieldValue.arrayUnion(url) };
    if (!previo.materialCompletoEn && materialPendiente(archivos, materialLeido).length === 0) {
      cambios.materialCompletoEn = FieldValue.serverTimestamp();
    }
    await adminDb.collection("capacitaciones_intentos").doc(previo.id).update(cambios);

    return NextResponse.json({ materialLeido });
  } catch (err) {
    console.error("Error en /api/capacitaciones/lectura:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
