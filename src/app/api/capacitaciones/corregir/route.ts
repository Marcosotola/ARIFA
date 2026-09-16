import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { PreguntaCapacitacion } from "@/lib/capacitaciones";

function buildDetalle(preguntas: PreguntaCapacitacion[], opcionesOrden: Record<string, string[]>, respuestas: Record<string, string>) {
  return preguntas.map(p => {
    const ordenIds = opcionesOrden[p.id] || p.opciones.map(o => o.id);
    const opciones = ordenIds
      .map(id => p.opciones.find(o => o.id === id))
      .filter(Boolean) as { id: string; texto: string }[];
    const tuOpcionId = respuestas[p.id] || null;
    return {
      preguntaId: p.id,
      enunciado: p.enunciado,
      opciones,
      tuOpcionId,
      correctaOpcionId: p.respuestaCorrectaId,
      esCorrecta: tuOpcionId === p.respuestaCorrectaId,
    };
  });
}

function calcularEstadoFinal(tipo: "previo" | "posterior", aprobado: boolean, numeroIntento: number) {
  if (tipo === "previo") return "informativo" as const;
  if (aprobado) return "aprobado" as const;
  return numeroIntento === 2 ? ("reprobado_recapacitar" as const) : ("reprobado_reintentar" as const);
}

export async function POST(req: NextRequest) {
  try {
    const { intentoId, respuestas } = await req.json();
    if (!intentoId) return NextResponse.json({ error: "intentoId es obligatorio" }, { status: 400 });

    const intentoRef = adminDb.collection("capacitaciones_intentos").doc(intentoId);
    const intentoSnap = await intentoRef.get();
    if (!intentoSnap.exists) return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });
    const intento = intentoSnap.data()!;

    const preguntasIds: string[] = intento.preguntasIds || [];
    const preguntasSnaps = await Promise.all(
      preguntasIds.map(id => adminDb.collection("capacitaciones_preguntas").doc(id).get())
    );
    const preguntas = preguntasSnaps
      .filter(s => s.exists)
      .map(s => ({ id: s.id, ...s.data() } as PreguntaCapacitacion));

    if (intento.estado === "finalizado") {
      // Idempotente: reintento de red tras haber corregido ya, no volvemos a puntuar.
      return NextResponse.json({
        puntajeObtenido: intento.puntajeObtenido,
        puntajeMaximo: intento.puntajeMaximo,
        porcentaje: intento.porcentaje,
        aprobado: intento.aprobado,
        detalle: buildDetalle(preguntas, intento.opcionesOrden || {}, intento.respuestas || {}),
        estadoFinal: calcularEstadoFinal(intento.tipo, !!intento.aprobado, intento.numeroIntento),
      });
    }

    const temaSnap = await adminDb.collection("capacitaciones_temas").doc(intento.temaId).get();
    const puntajeMinimo = temaSnap.exists ? (temaSnap.data()!.puntajeMinimo ?? 70) : 70;

    const respuestasFinal: Record<string, string> = respuestas || {};
    let puntajeObtenido = 0;
    let puntajeMaximo = 0;
    for (const p of preguntas) {
      puntajeMaximo += p.puntaje || 0;
      if (respuestasFinal[p.id] === p.respuestaCorrectaId) puntajeObtenido += p.puntaje || 0;
    }
    const porcentaje = puntajeMaximo > 0 ? Math.round((puntajeObtenido / puntajeMaximo) * 100) : 0;
    const aprobado = porcentaje >= puntajeMinimo;

    await intentoRef.update({
      estado: "finalizado",
      respuestas: respuestasFinal,
      puntajeObtenido,
      puntajeMaximo,
      porcentaje,
      aprobado,
      finalizadoEn: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      puntajeObtenido,
      puntajeMaximo,
      porcentaje,
      aprobado,
      detalle: buildDetalle(preguntas, intento.opcionesOrden || {}, respuestasFinal),
      estadoFinal: calcularEstadoFinal(intento.tipo, aprobado, intento.numeroIntento),
    });
  } catch (err) {
    console.error("Error en /api/capacitaciones/corregir:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
