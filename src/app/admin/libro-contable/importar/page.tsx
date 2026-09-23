"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { useToast, Toast } from "@/components/Toast";
import { ArrowLeft, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { parseLibroCsv, FilaImportada } from "@/lib/importadorLibro";
import { MEDIOS_PAGO } from "@/lib/libroContable";

const inputSt: React.CSSProperties = { padding: "6px 8px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "0.8rem", width: "100%", boxSizing: "border-box" };

export default function ImportarLibroPage() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [autorizado, setAutorizado] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ uid: string; nombre: string } | null>(null);
  const [filas, setFilas] = useState<FilaImportada[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [importando, setImportando] = useState(false);
  const [importado, setImportado] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "usuarios", u.uid));
      const data = snap.exists() ? snap.data() : {};
      if (data.rol !== "admin" && data.rol !== "superadmin") { router.push("/admin"); return; }
      setCurrentUser({ uid: u.uid, nombre: data.nombre || u.email || "" });
      setAutorizado(true);
    });
    return () => unsub();
  }, [router]);

  const onArchivo = (file: File) => {
    setNombreArchivo(file.name);
    setImportado(null);
    const reader = new FileReader();
    reader.onload = () => {
      const { filas: parsed, columnasFaltantes } = parseLibroCsv(String(reader.result || ""));
      if (columnasFaltantes.length > 0) {
        showToast(columnasFaltantes.join(" "), "error");
        setFilas([]);
        return;
      }
      setFilas(parsed);
    };
    reader.readAsText(file, "utf-8");
  };

  const actualizarFila = (idx: number, cambios: Partial<FilaImportada>) => {
    setFilas(prev => prev.map((f, i) => i === idx ? { ...f, ...cambios } : f));
  };

  const bloqueantes = filas.filter(f => !f.fecha || !f.medioPago || !(f.monto > 0));
  const conAdvertencia = filas.filter(f => f.advertencias.length > 0);

  const importar = async () => {
    if (!currentUser || filas.length === 0 || bloqueantes.length > 0) return;
    setImportando(true);
    try {
      let hechos = 0;
      for (let i = 0; i < filas.length; i += 400) {
        const lote = filas.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const f of lote) {
          const ref = doc(collection(db, "libro_contable"));
          batch.set(ref, {
            fecha: f.fecha, tipo: f.tipo, monto: f.monto, medioPago: f.medioPago,
            cliente: f.cliente, telefono: f.telefono, concepto: f.concepto, categorias: f.categorias,
            creadoPorId: currentUser.uid, creadoPorNombre: currentUser.nombre,
            importado: true, importadoDe: nombreArchivo,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
        hechos += lote.length;
      }
      setImportado(hechos);
      showToast(`Se importaron ${hechos} movimientos.`, "success");
    } catch (e) {
      console.error(e);
      showToast("Error al importar. Revisá la consola e intentá de nuevo.", "error");
    } finally {
      setImportando(false);
    }
  };

  if (!autorizado) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "80px" }}>
      <header style={{ marginBottom: "24px" }}>
        <button onClick={() => router.push("/admin/libro-contable")}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", marginBottom: "10px", padding: 0 }}>
          <ArrowLeft size={18} /> Volver al Libro Contable
        </button>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)", margin: 0 }}>Importar histórico</h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Subí el CSV del Excel (Archivo → Descargar → Valores separados por comas) para cargar el histórico de una sola vez.</p>
      </header>

      {importado !== null ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "14px", padding: "30px", textAlign: "center" }}>
          <CheckCircle2 size={40} color="#16a34a" style={{ marginBottom: "10px" }} />
          <h2 style={{ color: "#15803d", margin: "0 0 8px" }}>Se importaron {importado} movimientos</h2>
          <button onClick={() => router.push("/admin/libro-contable")} className="btn-red" style={{ padding: "12px 24px", borderRadius: "10px", fontWeight: 800, marginTop: "10px" }}>
            Ver el Libro Contable
          </button>
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: "14px", padding: "20px", marginBottom: "20px" }}>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
              onChange={e => e.target.files?.[0] && onArchivo(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} style={{ padding: "12px 20px", borderRadius: "10px", border: "1.5px dashed #94a3b8", background: "#f8fafc", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
              <Upload size={18} /> {nombreArchivo || "Elegir archivo CSV..."}
            </button>
          </div>

          {filas.length > 0 && (
            <>
              <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: "10px", padding: "12px 18px" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#999", textTransform: "uppercase" }}>Filas leídas</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900 }}>{filas.length}</div>
                </div>
                <div style={{ background: bloqueantes.length ? "#fef2f2" : "#f0fdf4", border: "1px solid " + (bloqueantes.length ? "#fecaca" : "#bbf7d0"), borderRadius: "10px", padding: "12px 18px" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: bloqueantes.length ? "#b91c1c" : "#15803d", textTransform: "uppercase" }}>Necesitan corrección</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900, color: bloqueantes.length ? "#b91c1c" : "#15803d" }}>{bloqueantes.length}</div>
                </div>
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "12px 18px" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#b45309", textTransform: "uppercase" }}>Con advertencia (revisar)</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#b45309" }}>{conAdvertencia.length}</div>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: "14px", overflow: "hidden", marginBottom: "20px" }}>
                <div style={{ overflowX: "auto", maxHeight: "560px", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px", fontSize: "0.82rem" }}>
                    <thead style={{ background: "#fafafa", position: "sticky", top: 0 }}>
                      <tr>
                        {["L°", "Fecha", "Tipo", "Cliente / Quién", "Concepto", "Monto", "Medio de pago", "Avisos"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: "0.68rem", color: "#999", textTransform: "uppercase", fontWeight: 800 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f, idx) => {
                        const problema = !f.fecha || !f.medioPago || !(f.monto > 0);
                        return (
                          <tr key={idx} style={{ borderTop: "1px solid #f3f3f3", background: problema ? "#fff5f5" : f.advertencias.length ? "#fffbeb" : "transparent" }}>
                            <td style={{ padding: "6px 10px", color: "#999" }}>{f.fila}</td>
                            <td style={{ padding: "6px 10px" }}>
                              <input type="date" value={f.fecha} onChange={e => actualizarFila(idx, { fecha: e.target.value })} style={{ ...inputSt, width: "130px" }} />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <select value={f.tipo} onChange={e => actualizarFila(idx, { tipo: e.target.value as "ingreso" | "egreso" })} style={{ ...inputSt, width: "90px" }}>
                                <option value="ingreso">Ingreso</option>
                                <option value="egreso">Egreso</option>
                              </select>
                            </td>
                            <td style={{ padding: "6px 10px", maxWidth: "160px" }}>{f.cliente || "—"}</td>
                            <td style={{ padding: "6px 10px", maxWidth: "220px", color: "#666" }}>{f.concepto || "—"}</td>
                            <td style={{ padding: "6px 10px", width: "110px" }}>
                              <input type="number" value={f.monto} onChange={e => actualizarFila(idx, { monto: Number(e.target.value) || 0 })} style={inputSt} />
                            </td>
                            <td style={{ padding: "6px 10px", width: "130px" }}>
                              <select value={f.medioPago} onChange={e => actualizarFila(idx, { medioPago: e.target.value })} style={inputSt}>
                                <option value="">-- Elegir --</option>
                                {MEDIOS_PAGO.map(mp => <option key={mp} value={mp}>{mp}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: "6px 10px", maxWidth: "220px" }}>
                              {f.advertencias.length > 0 && (
                                <div style={{ fontSize: "0.7rem", color: "#b45309", display: "flex", gap: "4px", alignItems: "flex-start" }}>
                                  <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: "2px" }} />
                                  <span>{f.advertencias.join(" ")}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <button onClick={importar} disabled={importando || bloqueantes.length > 0} className="btn-red"
                style={{ padding: "16px 28px", borderRadius: "12px", fontWeight: 800, fontSize: "1rem", opacity: bloqueantes.length > 0 ? 0.5 : 1 }}>
                {importando ? "Importando..." : bloqueantes.length > 0
                  ? `Corregí las ${bloqueantes.length} filas en rojo antes de importar`
                  : `Importar ${filas.length} movimientos`}
              </button>
            </>
          )}
        </>
      )}
      <Toast {...toast} />
    </div>
  );
}
