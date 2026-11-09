"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, GraduationCap, ArrowLeft, Lock } from "lucide-react";
import MaterialCapacitacion from "@/components/MaterialCapacitacion";
import type { ArchivoTema, FaseCapacitacion } from "@/lib/capacitaciones";

type Step = "empresa" | "persona" | "dni" | "tema" | "panel" | "examen" | "resultado";

interface EmpresaResultado { id: string; nombre: string; apellido: string; empresa: string; }
interface PersonaItem { id: string; nombre: string; apellido: string; }
interface TemaEstado {
  id: string; nombre: string; descripcion: string; disponible: boolean;
  tipo?: "previo" | "posterior"; numeroIntento?: number; motivo?: string;
  fase: FaseCapacitacion; archivos: ArchivoTema[]; materialLeido: string[];
}

const FASE_LABEL: Record<FaseCapacitacion, string> = {
  previo: "Paso 1: examen previo",
  material: "Paso 2: ver el material",
  final: "Paso 3: examen final",
  aprobado: "✓ Aprobado",
  recapacitar: "Requiere recapacitación",
};

const PASOS = ["Examen previo", "Material", "Examen final"];

function Pasos({ fase }: { fase: FaseCapacitacion }) {
  const actual = fase === "previo" ? 0 : fase === "material" ? 1 : fase === "final" ? 2 : 3;
  return (
    <div style={{ display: "flex", gap: "6px", marginBottom: "22px" }}>
      {PASOS.map((p, i) => {
        const hecho = i < actual;
        const activo = i === actual;
        return (
          <div key={p} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ height: "6px", borderRadius: "3px", background: hecho ? "#16a34a" : activo ? "var(--primary-red)" : "#e2e8f0", marginBottom: "6px" }} />
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: hecho ? "#16a34a" : activo ? "var(--primary-red)" : "#94a3b8" }}>
              {hecho ? "✓ " : `${i + 1}. `}{p}
            </span>
          </div>
        );
      })}
    </div>
  );
}
interface PreguntaExamen { id: string; enunciado: string; opciones: { id: string; texto: string }[]; }
interface DetalleItem {
  preguntaId: string; enunciado: string; opciones: { id: string; texto: string }[];
  tuOpcionId: string | null; correctaOpcionId: string; esCorrecta: boolean;
}
interface ResultadoExamen {
  puntajeObtenido: number; puntajeMaximo: number; porcentaje: number; aprobado: boolean;
  detalle: DetalleItem[]; estadoFinal: "aprobado" | "reprobado_reintentar" | "reprobado_recapacitar" | "informativo";
}

const inputSt: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: "8px",
  border: "1.5px solid #ddd", fontSize: "0.95rem", outline: "none", boxSizing: "border-box",
};
const cardSt: React.CSSProperties = {
  background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0",
  boxShadow: "0 4px 20px rgba(0,0,0,0.05)", padding: "28px",
};

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "0.8rem", fontWeight: 700, marginBottom: "16px", padding: 0 }}>
      <ArrowLeft size={14} /> Volver
    </button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "8px", background: "#fff1f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: "0.85rem", fontWeight: 600 }}>
      {msg}
    </div>
  );
}

export default function ExamenCapacitacionPage() {
  const [step, setStep] = useState<Step>("empresa");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [empresaQuery, setEmpresaQuery] = useState("");
  const [empresaResultados, setEmpresaResultados] = useState<EmpresaResultado[]>([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<EmpresaResultado | null>(null);

  const [personal, setPersonal] = useState<PersonaItem[]>([]);
  const [personalFiltro, setPersonalFiltro] = useState("");
  const [personaSeleccionada, setPersonaSeleccionada] = useState<PersonaItem | null>(null);

  const [dni, setDni] = useState("");

  const [empresaNombre, setEmpresaNombre] = useState("");
  const [personaNombre, setPersonaNombre] = useState("");
  const [temasEstado, setTemasEstado] = useState<TemaEstado[]>([]);

  const [intentoId, setIntentoId] = useState("");
  const [tipoExamen, setTipoExamen] = useState<"previo" | "posterior">("previo");
  const [numeroIntento, setNumeroIntento] = useState(1);
  const [preguntas, setPreguntas] = useState<PreguntaExamen[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [temaNombreActual, setTemaNombreActual] = useState("");

  const [resultado, setResultado] = useState<ResultadoExamen | null>(null);

  // Tema elegido desde la biblioteca (/capacitaciones/examen?tema=ID) y tema abierto en el circuito.
  const [temaPresetId, setTemaPresetId] = useState("");
  const [temaPresetNombre, setTemaPresetNombre] = useState("");
  const [temaActivoId, setTemaActivoId] = useState("");
  const [verMaterial, setVerMaterial] = useState(false);
  const [marcando, setMarcando] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTemaPresetId(params.get("tema") || "");
    setTemaPresetNombre(params.get("nombre") || "");
  }, []);

  const temaActivo = temasEstado.find(t => t.id === temaActivoId) || null;

  const abrirTema = (t: TemaEstado) => {
    setTemaActivoId(t.id);
    setVerMaterial(false);
    setError("");
    setStep("panel");
    window.scrollTo({ top: 0 });
  };

  const cargarEstado = async (): Promise<TemaEstado[] | null> => {
    if (!personaSeleccionada) return null;
    const res = await fetch("/api/capacitaciones/estado", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personalId: personaSeleccionada.id, dni }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.error || "No se pudo verificar el DNI."); return null; }
    setEmpresaNombre(data.empresaNombre || "");
    setPersonaNombre(data.personaNombre || "");
    setTemasEstado(data.temas || []);
    return data.temas || [];
  };

  const marcarLeido = async (url: string) => {
    if (!personaSeleccionada || !temaActivo) return;
    setError("");
    setMarcando(url);
    try {
      const res = await fetch("/api/capacitaciones/lectura", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalId: personaSeleccionada.id, dni, temaId: temaActivo.id, url }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No se pudo marcar el material."); return; }
      const leidos: string[] = data.materialLeido || [];
      setTemasEstado(prev => prev.map(t => {
        if (t.id !== temaActivo.id) return t;
        const completo = t.archivos.every(a => leidos.includes(a.url));
        return { ...t, materialLeido: leidos, fase: t.fase === "material" && completo ? "final" : t.fase };
      }));
    } catch { setError("Error de conexión. Intentá de nuevo."); }
    finally { setMarcando(""); }
  };

  useEffect(() => {
    if (empresaQuery.trim().length < 2) { setEmpresaResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/capacitaciones/empresas?q=${encodeURIComponent(empresaQuery.trim())}`);
        const data = await res.json();
        setEmpresaResultados(data.empresas || []);
      } catch { setEmpresaResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [empresaQuery]);

  const seleccionarEmpresa = async (e: EmpresaResultado) => {
    setEmpresaSeleccionada(e);
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/capacitaciones/personal?empresaId=${e.id}`);
      const data = await res.json();
      setPersonal(data.personal || []);
      setStep("persona");
    } catch { setError("Error al cargar el personal. Intentá de nuevo."); }
    finally { setLoading(false); }
  };

  const seleccionarPersona = (p: PersonaItem) => {
    setPersonaSeleccionada(p);
    setDni("");
    setError("");
    setStep("dni");
  };

  const confirmarDni = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!personaSeleccionada) return;
    setError("");
    setLoading(true);
    try {
      const temas = await cargarEstado();
      if (!temas) return;
      const preset = temaPresetId ? temas.find(t => t.id === temaPresetId) : undefined;
      if (preset) { abrirTema(preset); return; }
      if (temaPresetId) setError("Ese tema no está asignado a tu empresa. Estos son los temas que tenés asignados.");
      setStep("tema");
    } catch { setError("Error de conexión. Intentá de nuevo."); }
    finally { setLoading(false); }
  };

  const iniciarExamen = async (tema: TemaEstado) => {
    if (!personaSeleccionada || !tema.disponible) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/capacitaciones/iniciar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalId: personaSeleccionada.id, dni, temaId: tema.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No se pudo iniciar el examen."); return; }
      setIntentoId(data.intentoId);
      setTipoExamen(data.tipo);
      setNumeroIntento(data.numeroIntento);
      setPreguntas(data.preguntas || []);
      setRespuestas({});
      setTemaNombreActual(tema.nombre);
      setStep("examen");
    } catch { setError("Error de conexión. Intentá de nuevo."); }
    finally { setLoading(false); }
  };

  const elegirOpcion = (preguntaId: string, opcionId: string) =>
    setRespuestas(prev => ({ ...prev, [preguntaId]: opcionId }));

  const entregarExamen = async () => {
    const sinResponder = preguntas.filter(p => !respuestas[p.id]).length;
    if (sinResponder > 0 && !confirm(`Dejaste ${sinResponder} pregunta${sinResponder !== 1 ? "s" : ""} sin responder. ¿Entregar igual?`)) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/capacitaciones/corregir", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentoId, respuestas }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No se pudo corregir el examen."); return; }
      setResultado(data);
      setStep("resultado");
    } catch { setError("Error de conexión. Intentá de nuevo."); }
    finally { setLoading(false); }
  };

  const continuarCircuito = async () => {
    setError("");
    setLoading(true);
    try {
      await cargarEstado();
      setResultado(null);
      setVerMaterial(false);
      setStep(temaActivoId ? "panel" : "tema");
      window.scrollTo({ top: 0 });
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  };

  const personalFiltrado = personalFiltro.trim().length === 0
    ? personal
    : personal.filter(p => `${p.nombre} ${p.apellido}`.toLowerCase().includes(personalFiltro.toLowerCase()));

  return (
    <>
      <div className="page-banner">
        <div className="container">
          <h1>Capacitación</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href="/capacitaciones">Capacitaciones</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Hacer la capacitación</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container" style={{ maxWidth: "720px" }}>

          {step === "empresa" && (
            <div style={cardSt}>
              {temaPresetNombre && (
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--primary-red)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                  Capacitación: {temaPresetNombre}
                </div>
              )}
              <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "8px" }}>Buscá tu empresa</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
                Escribí el nombre de la empresa o del contacto para encontrarla.
              </p>
              <input style={inputSt} value={empresaQuery} onChange={e => setEmpresaQuery(e.target.value)}
                placeholder="Nombre de la empresa..." autoFocus />
              {empresaResultados.length > 0 && (
                <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {empresaResultados.map(e => (
                    <button key={e.id} onClick={() => seleccionarEmpresa(e)} disabled={loading}
                      style={{ textAlign: "left", padding: "14px 16px", borderRadius: "10px", border: "1.5px solid #e2e8f0", background: "#fafafa", cursor: "pointer" }}>
                      <div style={{ fontWeight: 700, color: "var(--primary-blue)" }}>{e.empresa || `${e.nombre} ${e.apellido}`}</div>
                      {e.empresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{e.nombre} {e.apellido}</div>}
                    </button>
                  ))}
                </div>
              )}
              {empresaQuery.trim().length >= 2 && empresaResultados.length === 0 && (
                <p style={{ marginTop: "14px", color: "#999", fontSize: "0.85rem" }}>No se encontraron empresas con ese nombre.</p>
              )}
            </div>
          )}

          {step === "persona" && (
            <div style={cardSt}>
              <BackLink onClick={() => setStep("empresa")} />
              <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "8px" }}>Elegí tu nombre</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
                {empresaSeleccionada?.empresa || `${empresaSeleccionada?.nombre} ${empresaSeleccionada?.apellido}`}
              </p>
              {personal.length > 5 && (
                <input style={{ ...inputSt, marginBottom: "14px" }} value={personalFiltro} onChange={e => setPersonalFiltro(e.target.value)} placeholder="Filtrar por nombre..." />
              )}
              {personal.length === 0 ? (
                <p style={{ color: "#999", fontSize: "0.9rem" }}>Todavía no hay personal cargado para esta empresa. Contactá a tu administrador.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "360px", overflowY: "auto" }}>
                  {personalFiltrado.map(p => (
                    <button key={p.id} onClick={() => seleccionarPersona(p)}
                      style={{ textAlign: "left", padding: "14px 16px", borderRadius: "10px", border: "1.5px solid #e2e8f0", background: "#fafafa", cursor: "pointer", fontWeight: 700, color: "var(--primary-blue)" }}>
                      {p.nombre} {p.apellido}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "dni" && (
            <div style={cardSt}>
              <BackLink onClick={() => setStep("persona")} />
              <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "8px" }}>Confirmá tu identidad</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
                Hola, {personaSeleccionada?.nombre}. Ingresá tu DNI para continuar.
              </p>
              <form onSubmit={confirmarDni}>
                <input style={inputSt} value={dni} onChange={e => setDni(e.target.value)} placeholder="DNI (sin puntos)" inputMode="numeric" autoFocus required />
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={loading} className="btn-red" style={{ marginTop: "16px", padding: "12px 24px", width: "100%" }}>
                  {loading ? "Verificando..." : "Continuar"}
                </button>
              </form>
            </div>
          )}

          {step === "tema" && (
            <div style={cardSt}>
              <BackLink onClick={() => setStep("dni")} />
              <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "4px" }}>Hola, {personaNombre}</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px" }}>{empresaNombre}. Elegí la capacitación.</p>
              {error && <ErrorBox msg={error} />}
              {temasEstado.length === 0 ? (
                <p style={{ color: "#999", fontSize: "0.9rem" }}>No tenés temas de capacitación asignados todavía.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {temasEstado.map(t => (
                    <div key={t.id} style={{ padding: "16px", borderRadius: "12px", border: "1.5px solid #e2e8f0", background: "#fafafa" }}>
                      <div style={{ fontWeight: 800, color: "var(--primary-blue)" }}>{t.nombre}</div>
                      {t.descripcion && <div style={{ fontSize: "0.82rem", color: "#888", marginTop: "4px" }}>{t.descripcion}</div>}
                      <div style={{ marginTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: t.fase === "aprobado" ? "#16a34a" : t.fase === "recapacitar" ? "#dc2626" : "#2563eb" }}>
                          {FASE_LABEL[t.fase]}
                        </span>
                        <button onClick={() => abrirTema(t)} className="btn-red" style={{ padding: "8px 18px", fontSize: "0.85rem" }}>
                          {t.fase === "aprobado" || t.fase === "recapacitar" ? "Ver" : "Continuar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "panel" && temaActivo && (() => {
            const t = temaActivo;
            const leidos = t.materialLeido || [];
            const pendientes = t.archivos.filter(a => !leidos.includes(a.url)).length;
            const mostrarMaterial = t.fase === "material" || ((t.fase === "final" || t.fase === "aprobado") && verMaterial);
            return (
              <div style={cardSt}>
                {temasEstado.length > 1 && <BackLink onClick={() => { setError(""); setStep("tema"); }} />}
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>{personaNombre} · {empresaNombre}</div>
                <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", marginBottom: "16px" }}>{t.nombre}</h2>
                <Pasos fase={t.fase} />
                {error && <ErrorBox msg={error} />}

                {t.fase === "previo" && (
                  <div>
                    <p style={{ color: "#555", fontSize: "0.92rem", lineHeight: 1.6, marginBottom: "18px" }}>
                      Antes de ver el material vas a responder un <b>examen previo</b>. Es solo para saber qué conocimientos tenés: no se aprueba ni se desaprueba.
                      Después vas a ver el material y al final rendís el examen final.
                    </p>
                    <button onClick={() => iniciarExamen(t)} disabled={loading} className="btn-red" style={{ padding: "12px 24px", width: "100%" }}>
                      {loading ? "Cargando..." : "Comenzar examen previo"}
                    </button>
                  </div>
                )}

                {t.fase === "material" && (
                  <p style={{ color: "#555", fontSize: "0.92rem", lineHeight: 1.6, marginBottom: "18px" }}>
                    Mirá cada material y marcalo como leído. Cuando termines se habilita el <b>examen final</b>
                    {pendientes > 0 && <> (te falta{pendientes !== 1 ? "n" : ""} {pendientes})</>}.
                  </p>
                )}

                {(t.fase === "final" || t.fase === "aprobado") && t.archivos.length > 0 && (
                  <button onClick={() => setVerMaterial(v => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--primary-blue)", fontWeight: 700, fontSize: "0.85rem", marginBottom: "16px" }}>
                    {verMaterial ? "Ocultar el material" : "Volver a ver el material"}
                  </button>
                )}

                {mostrarMaterial && (
                  <div style={{ marginTop: "4px" }}>
                    {t.archivos.map(a => {
                      const leido = leidos.includes(a.url);
                      return (
                        <MaterialCapacitacion key={a.url} archivo={a} pie={
                          leido ? (
                            <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#16a34a", fontWeight: 700, fontSize: "0.85rem" }}>
                              <CheckCircle2 size={16} /> Leído
                            </span>
                          ) : (
                            <button onClick={() => marcarLeido(a.url)} disabled={!!marcando} className="btn-blue" style={{ padding: "8px 16px", fontSize: "0.85rem", width: "100%" }}>
                              {marcando === a.url ? "Guardando..." : "✓ Leí este material"}
                            </button>
                          )
                        } />
                      );
                    })}
                  </div>
                )}

                {(t.fase === "material" || t.fase === "final") && (
                  <button onClick={() => iniciarExamen(t)} disabled={loading || t.fase !== "final"} className="btn-red"
                    style={{ padding: "12px 24px", width: "100%", marginTop: "8px", opacity: t.fase !== "final" ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    {t.fase !== "final" && <Lock size={16} />}
                    {loading ? "Cargando..." : `Rendir examen final${t.numeroIntento === 2 ? " (2º intento)" : ""}`}
                  </button>
                )}

                {t.fase === "aprobado" && (
                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <CheckCircle2 size={44} color="#16a34a" style={{ marginBottom: "8px" }} />
                    <p style={{ fontWeight: 700, color: "#15803d" }}>Ya aprobaste esta capacitación.</p>
                  </div>
                )}

                {t.fase === "recapacitar" && (
                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <XCircle size={44} color="#dc2626" style={{ marginBottom: "8px" }} />
                    <p style={{ color: "#555", fontSize: "0.9rem" }}>{t.motivo}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {step === "examen" && (
            <div style={cardSt}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                <h2 style={{ fontWeight: 800, color: "var(--primary-blue)" }}>{temaNombreActual}</h2>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2563eb", background: "#eff6ff", padding: "4px 12px", borderRadius: "20px" }}>
                  {tipoExamen === "previo" ? "Examen previo" : `Examen final — intento ${numeroIntento}`}
                </span>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
                Respondé todas las preguntas y presioná &quot;Entregar examen&quot; al finalizar.
              </p>
              {error && <ErrorBox msg={error} />}
              <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                {preguntas.map((p, idx) => (
                  <div key={p.id}>
                    <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: "10px" }}>{idx + 1}. {p.enunciado}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {p.opciones.map(o => (
                        <label key={o.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid", borderColor: respuestas[p.id] === o.id ? "#2563eb" : "#e2e8f0", background: respuestas[p.id] === o.id ? "#eff6ff" : "#fafafa", cursor: "pointer" }}>
                          <input type="radio" name={`pregunta-${p.id}`} checked={respuestas[p.id] === o.id}
                            onChange={() => elegirOpcion(p.id, o.id)} style={{ width: "16px", height: "16px" }} />
                          <span style={{ fontSize: "0.9rem" }}>{o.texto}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={entregarExamen} disabled={loading} className="btn-red" style={{ marginTop: "28px", padding: "14px 24px", width: "100%" }}>
                {loading ? "Enviando..." : "Entregar examen"}
              </button>
            </div>
          )}

          {step === "resultado" && resultado && (
            <div style={cardSt}>
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                {resultado.estadoFinal === "informativo" ? (
                  <GraduationCap size={48} color="#2563eb" style={{ marginBottom: "10px" }} />
                ) : resultado.aprobado ? (
                  <CheckCircle2 size={48} color="#16a34a" style={{ marginBottom: "10px" }} />
                ) : (
                  <XCircle size={48} color="#dc2626" style={{ marginBottom: "10px" }} />
                )}
                <h2 style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "1.4rem" }}>
                  {resultado.puntajeObtenido} / {resultado.puntajeMaximo} puntos ({resultado.porcentaje}%)
                </h2>
                <p style={{ marginTop: "10px", color: "#555", fontSize: "0.9rem", maxWidth: "440px", marginLeft: "auto", marginRight: "auto" }}>
                  {resultado.estadoFinal === "informativo" && "Listo el examen previo. Es solo informativo. Ahora seguí con el material de la capacitación."}
                  {resultado.estadoFinal === "aprobado" && "¡Felicitaciones, aprobaste este tema!"}
                  {resultado.estadoFinal === "reprobado_reintentar" && "No alcanzaste el puntaje mínimo. Podés repasar el material y te queda un intento más."}
                  {resultado.estadoFinal === "reprobado_recapacitar" && "No alcanzaste el puntaje mínimo en los 2 intentos. Necesitás recapacitación antes de un nuevo intento. Contactá a tu empresa o al administrador."}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {resultado.detalle.map((d, idx) => (
                  <div key={d.preguntaId} style={{ padding: "14px 16px", borderRadius: "10px", border: "1.5px solid", borderColor: d.esCorrecta ? "#bbf7d0" : "#fecaca", background: d.esCorrecta ? "#f0fdf4" : "#fff1f2" }}>
                    <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>{idx + 1}. {d.enunciado}</div>
                    {d.opciones.map(o => {
                      const esLaCorrecta = o.id === d.correctaOpcionId;
                      const esLaElegida = o.id === d.tuOpcionId;
                      return (
                        <div key={o.id} style={{ fontSize: "0.85rem", padding: "4px 0", color: esLaCorrecta ? "#15803d" : esLaElegida ? "#dc2626" : "#555", fontWeight: esLaCorrecta || esLaElegida ? 700 : 400 }}>
                          {esLaCorrecta ? "✓ " : esLaElegida ? "✕ " : "  "}{o.texto}{esLaElegida && !esLaCorrecta ? " (tu respuesta)" : ""}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
                <button onClick={continuarCircuito} disabled={loading} className="btn-blue" style={{ flex: 1, padding: "12px" }}>
                  {resultado.estadoFinal === "informativo" ? "Continuar con el material" : "Continuar"}
                </button>
                <Link href="/capacitaciones" className="btn-white" style={{ flex: 1, padding: "12px", border: "1px solid #ddd", textAlign: "center" }}>Salir</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
