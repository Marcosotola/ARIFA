import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { emailConfigurado } from "@/lib/email";
import {
  determinarProximoExamen, materialPendiente, previoVigente,
  type ArchivoTema, type FaseCapacitacion, type IntentoExamen,
} from "@/lib/capacitaciones";

function normalizarDni(v: string) {
  return (v || "").replace(/\D/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const { personalId, dni } = await req.json();
    if (!personalId || !dni) {
      return NextResponse.json({ ok: false, error: "Datos incompletos" }, { status: 400 });
    }

    const personalSnap = await adminDb.collection("capacitaciones_personal").doc(personalId).get();
    if (!personalSnap.exists) return NextResponse.json({ ok: false, error: "Persona no encontrada" }, { status: 404 });
    const persona = personalSnap.data()!;

    if (normalizarDni(persona.dni) !== normalizarDni(dni)) {
      return NextResponse.json({ ok: false, error: "El DNI no coincide" }, { status: 400 });
    }
    if (persona.activo !== true) {
      return NextResponse.json({ ok: false, error: "Esta persona ya no está activa" }, { status: 400 });
    }

    const empresaSnap = await adminDb.collection("usuarios").doc(persona.empresaId).get();
    const temasAsignados: string[] = empresaSnap.exists ? (empresaSnap.data()!.temasAsignados || []) : [];

    // Una sola query por personalId (campo único), agrupamos por tema en memoria.
    const intentosSnap = await adminDb.collection("capacitaciones_intentos")
      .where("personalId", "==", personalId).get();
    const intentos = intentosSnap.docs.map(d => ({ id: d.id, ...d.data() } as IntentoExamen));

    const temas: any[] = [];
    for (const temaId of temasAsignados) {
      const temaSnap = await adminDb.collection("capacitaciones_temas").doc(temaId).get();
      if (!temaSnap.exists) continue;
      const tema = temaSnap.data()!;
      if (tema.activo !== true) continue;

      const algunaPregunta = await adminDb.collection("capacitaciones_preguntas")
        .where("temaId", "==", temaId).limit(1).get();
      if (algunaPregunta.empty) continue;

      const intentosDelTema = intentos.filter(i => i.temaId === temaId);
      const resultado = determinarProximoExamen(intentosDelTema);
      const archivos: ArchivoTema[] = (tema.archivos || []).map((a: any) => ({
        url: a.url, nombre: a.nombre || "", tipo: a.tipo || "otro", mimeType: a.mimeType || "",
      }));
      const materialLeido = previoVigente(intentosDelTema)?.materialLeido || [];

      // Circuito: examen previo → leer todo el material → examen final.
      let fase: FaseCapacitacion;
      if (!resultado.disponible) {
        fase = intentosDelTema.some(i => i.tipo === "posterior" && i.aprobado && !i.excluido) ? "aprobado" : "recapacitar";
      } else if (resultado.tipo === "previo") {
        fase = "previo";
      } else {
        fase = materialPendiente(archivos, materialLeido).length > 0 ? "material" : "final";
      }

      temas.push({
        id: temaId,
        nombre: tema.nombre || "",
        descripcion: tema.descripcion || "",
        fase,
        certificadoCodigo: intentosDelTema.find(i => i.tipo === "posterior" && i.aprobado && i.estado === "finalizado" && !i.excluido)?.id || "",
        archivos,
        materialLeido,
        ...(resultado.disponible
          ? { disponible: true, tipo: resultado.tipo, numeroIntento: resultado.numeroIntento }
          : { disponible: false, motivo: resultado.motivo }),
      });
    }

    return NextResponse.json({
      ok: true,
      empresaNombre: empresaSnap.exists ? (empresaSnap.data()!.empresa || "") : "",
      personaNombre: `${persona.nombre} ${persona.apellido}`,
      personaEmail: persona.email || "",
      mailActivo: emailConfigurado(),
      temas,
    });
  } catch (err) {
    console.error("Error en /api/capacitaciones/estado:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
