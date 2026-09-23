import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  determinarProximoExamen, DEFAULT_CANTIDAD_PREGUNTAS_EXAMEN,
  type IntentoExamen, type PreguntaCapacitacion,
} from "@/lib/capacitaciones";

function normalizarDni(v: string) {
  return (v || "").replace(/\D/g, "");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(req: NextRequest) {
  try {
    const { personalId, dni, temaId } = await req.json();
    if (!personalId || !dni || !temaId) {
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

    const empresaSnap = await adminDb.collection("usuarios").doc(persona.empresaId).get();
    const temasAsignados: string[] = empresaSnap.exists ? (empresaSnap.data()!.temasAsignados || []) : [];
    if (!temasAsignados.includes(temaId)) {
      return NextResponse.json({ error: "Este tema no está asignado a tu empresa" }, { status: 400 });
    }

    const temaSnap = await adminDb.collection("capacitaciones_temas").doc(temaId).get();
    if (!temaSnap.exists || temaSnap.data()!.activo !== true) {
      return NextResponse.json({ error: "Tema no disponible" }, { status: 404 });
    }
    const tema = temaSnap.data()!;

    const intentosSnap = await adminDb.collection("capacitaciones_intentos")
      .where("personalId", "==", personalId).get();
    const intentosDelTema = intentosSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as IntentoExamen))
      .filter(i => i.temaId === temaId);

    const resultado = determinarProximoExamen(intentosDelTema);
    if (!resultado.disponible) {
      return NextResponse.json({ error: resultado.motivo }, { status: 400 });
    }

    const preguntasSnap = await adminDb.collection("capacitaciones_preguntas").where("temaId", "==", temaId).get();
    const bancoPreguntas = preguntasSnap.docs.map(d => ({ id: d.id, ...d.data() } as PreguntaCapacitacion));
    if (bancoPreguntas.length === 0) {
      return NextResponse.json({ error: "Todavía no hay preguntas cargadas para este tema" }, { status: 400 });
    }

    const cantidad = Math.min(tema.cantidadPreguntasExamen || DEFAULT_CANTIDAD_PREGUNTAS_EXAMEN, bancoPreguntas.length);
    const seleccionadas = shuffle(bancoPreguntas).slice(0, cantidad);

    const opcionesOrden: Record<string, string[]> = {};
    const preguntasRespuesta = seleccionadas.map(p => {
      const opcionesMezcladas = shuffle(p.opciones);
      opcionesOrden[p.id] = opcionesMezcladas.map(o => o.id);
      return { id: p.id, enunciado: p.enunciado, opciones: opcionesMezcladas.map(o => ({ id: o.id, texto: o.texto })) };
    });

    const nuevoIntento = {
      personalId,
      empresaId: persona.empresaId,
      temaId,
      tipo: resultado.tipo,
      numeroIntento: resultado.numeroIntento,
      preguntasIds: seleccionadas.map(p => p.id),
      opcionesOrden,
      estado: "en_progreso" as const,
      iniciadoEn: FieldValue.serverTimestamp(),
    };
    const ref = await adminDb.collection("capacitaciones_intentos").add(nuevoIntento);

    return NextResponse.json({
      intentoId: ref.id,
      tipo: resultado.tipo,
      numeroIntento: resultado.numeroIntento,
      preguntas: preguntasRespuesta,
    });
  } catch (err) {
    console.error("Error en /api/capacitaciones/iniciar:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
