"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { useToast, Toast } from "@/components/Toast";
import { ajustarStock } from "@/lib/stock";
import Link from "next/link";
import { Plus, Download, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, FileUp } from "lucide-react";
import {
  MEDIOS_PAGO, CATEGORIAS_INGRESO, MESES, Movimiento,
  fmtPeso, fmtFecha, rangoPeriodo, totales, porMedioPago, porCategoria, porMes, movimientosCsv,
} from "@/lib/libroContable";

interface FormMov {
  fecha: string; tipo: "ingreso" | "egreso"; monto: string; medioPago: string;
  cliente: string; telefono: string; concepto: string; categorias: string[];
  productoId: string; cantidadVendida: string;
}

interface ProductoStock { id: string; titulo: string; stock: number; }

const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
const formVacio = (tipo: "ingreso" | "egreso" = "ingreso"): FormMov => ({
  fecha: hoy(), tipo, monto: "", medioPago: "Efectivo", cliente: "", telefono: "", concepto: "", categorias: [],
  productoId: "", cantidadVendida: "1",
});

const inputSt: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid #ddd", fontSize: "0.92rem", outline: "none", boxSizing: "border-box" };
const labelSt: React.CSSProperties = { display: "block", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "5px", color: "#666" };
const thSt: React.CSSProperties = { textAlign: "left", padding: "12px 14px", fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, whiteSpace: "nowrap" };
const cardSt: React.CSSProperties = { background: "#fff", borderRadius: "14px", border: "1px solid #eee", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", padding: "20px" };

export default function LibroContablePage() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [currentUser, setCurrentUser] = useState<{ uid: string; nombre: string } | null>(null);
  const [soloPropio, setSoloPropio] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<ProductoStock[]>([]);

  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [filtroMedio, setFiltroMedio] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormMov>(formVacio());
  const [saving, setSaving] = useState(false);
  const [borrarId, setBorrarId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "usuarios", u.uid));
      const data = snap.exists() ? snap.data() : {};
      const esAdmin = data.rol === "admin" || data.rol === "superadmin";
      const esTecnicoTaller = data.rol === "tecnicoTaller";
      if (!esAdmin && !esTecnicoTaller) { router.push("/admin"); return; }
      setSoloPropio(esTecnicoTaller);
      setCurrentUser({ uid: u.uid, nombre: data.nombre || u.email || "" });
      setAutorizado(true);
    });
    return () => unsub();
  }, [router]);

  const cargar = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { desde, hasta } = rangoPeriodo(anio, mes);
      const filtros = [where("fecha", ">=", desde), where("fecha", "<=", hasta)];
      if (soloPropio) filtros.push(where("creadoPorId", "==", currentUser.uid));
      const snap = await getDocs(query(collection(db, "libro_contable"), ...filtros, orderBy("fecha", "desc")));
      setMovs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movimiento)));
    } catch (e) {
      console.error(e);
      showToast("No se pudo cargar el libro. Intentá de nuevo.", "error");
    } finally {
      setLoading(false);
    }
  }, [anio, mes, showToast, soloPropio, currentUser]);

  useEffect(() => { if (autorizado) cargar(); }, [autorizado, cargar]);

  useEffect(() => {
    if (!autorizado) return;
    getDocs(query(collection(db, "productos"), where("activo", "==", true)))
      .then(snap => setProductos(snap.docs.map(d => ({ id: d.id, titulo: d.data().titulo, stock: Number(d.data().stock) || 0 }))))
      .catch(console.error);
  }, [autorizado]);

  const visibles = movs.filter(m =>
    (filtroTipo === "todos" || m.tipo === filtroTipo) &&
    (filtroMedio === "Todos" || m.medioPago === filtroMedio) &&
    (!busqueda || `${m.cliente} ${m.concepto} ${m.telefono}`.toLowerCase().includes(busqueda.toLowerCase()))
  );
  const tot = totales(visibles);
  const medios = porMedioPago(visibles);
  const rubros = porCategoria(visibles);
  const meses = porMes(visibles);

  const abrirNuevo = (tipo: "ingreso" | "egreso") => { setEditId(null); setForm(formVacio(tipo)); setModal(true); };
  const abrirEditar = (m: Movimiento) => {
    setEditId(m.id);
    setForm({
      fecha: m.fecha, tipo: m.tipo, monto: String(m.monto), medioPago: m.medioPago || "Efectivo",
      cliente: m.cliente || "", telefono: m.telefono || "", concepto: m.concepto || "", categorias: m.categorias || [],
      productoId: m.productoId || "", cantidadVendida: String(m.cantidadVendida || 1),
    });
    setModal(true);
  };
  const setCampo = <K extends keyof FormMov>(k: K, v: FormMov[K]) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleCategoria = (c: string) =>
    setForm(prev => ({ ...prev, categorias: prev.categorias.includes(c) ? prev.categorias.filter(x => x !== c) : [...prev.categorias, c] }));

  const esVenta = form.tipo === "ingreso" && form.categorias.includes("Venta");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = Number(form.monto.replace(",", "."));
    if (!form.fecha) { showToast("Ingresá la fecha.", "error"); return; }
    if (!(monto > 0)) { showToast("El monto tiene que ser mayor a cero.", "error"); return; }
    if (!currentUser) return;
    const cantidad = esVenta && form.productoId ? Math.max(1, Math.floor(Number(form.cantidadVendida) || 0)) : 0;
    if (esVenta && form.productoId && cantidad < 1) { showToast("La cantidad vendida tiene que ser al menos 1.", "error"); return; }
    setSaving(true);
    try {
      const productoNombre = form.productoId ? productos.find(p => p.id === form.productoId)?.titulo : undefined;
      const payload = {
        fecha: form.fecha, tipo: form.tipo, monto, medioPago: form.medioPago,
        cliente: form.cliente.trim(), telefono: form.telefono.trim(), concepto: form.concepto.trim(),
        categorias: form.tipo === "ingreso" ? form.categorias : [],
        productoId: esVenta ? (form.productoId || null) : null,
        productoNombre: esVenta ? (productoNombre || null) : null,
        cantidadVendida: esVenta && form.productoId ? cantidad : null,
        updatedAt: serverTimestamp(),
      };
      const anterior = editId ? movs.find(m => m.id === editId) : null;
      if (editId) {
        await updateDoc(doc(db, "libro_contable", editId), payload);
      } else {
        await addDoc(collection(db, "libro_contable"), {
          ...payload, creadoPorId: currentUser.uid, creadoPorNombre: currentUser.nombre, createdAt: serverTimestamp(),
        });
      }
      // Ajusta el stock: devuelve lo que tenía reservado el movimiento anterior y descuenta lo nuevo.
      if (anterior?.productoId && anterior.cantidadVendida) {
        await ajustarStock(anterior.productoId, anterior.cantidadVendida).catch(console.error);
      }
      if (payload.productoId && payload.cantidadVendida) {
        await ajustarStock(payload.productoId, -payload.cantidadVendida).catch(console.error);
      }
      setModal(false);
      showToast(editId ? "Movimiento actualizado" : "Movimiento registrado", "success");
      await cargar();
    } catch (err) {
      console.error(err);
      showToast("Error al guardar. Intentá de nuevo.", "error");
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async () => {
    if (!borrarId) return;
    try {
      const m = movs.find(x => x.id === borrarId);
      await deleteDoc(doc(db, "libro_contable", borrarId));
      if (m?.productoId && m.cantidadVendida) {
        await ajustarStock(m.productoId, m.cantidadVendida).catch(console.error);
      }
      setMovs(prev => prev.filter(m => m.id !== borrarId));
      showToast("Movimiento eliminado", "success");
    } catch (err) {
      console.error(err);
      showToast("No se pudo eliminar.", "error");
    } finally {
      setBorrarId(null);
    }
  };

  const exportar = () => {
    const blob = new Blob([movimientosCsv(visibles)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Libro_Contable_${anio}${mes ? "-" + mes : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!autorizado) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", paddingBottom: "80px" }}>
      <header style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)", margin: 0 }}>{soloPropio ? "Mis Movimientos" : "Libro Contable"}</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>{soloPropio ? "Tus ingresos y egresos cargados en el local." : "Ingresos y egresos del local de extintores."}</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {!soloPropio && (
            <Link href="/admin/libro-contable/importar" style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #ddd", background: "#fff", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}>
              <FileUp size={16} /> Importar histórico
            </Link>
          )}
          <button onClick={exportar} disabled={visibles.length === 0} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
            <Download size={16} /> Exportar a Excel
          </button>
          <button onClick={() => abrirNuevo("egreso")} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #fecaca", background: "#fff5f5", color: "#b91c1c", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
            <Plus size={16} /> Egreso
          </button>
          <button onClick={() => abrirNuevo("ingreso")} className="btn-red" style={{ padding: "10px 18px", borderRadius: "10px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
            <Plus size={16} /> Ingreso
          </button>
        </div>
      </header>

      {/* FILTROS */}
      <div style={{ ...cardSt, padding: "16px", marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ width: "100px" }}>
          <label style={labelSt}>Año</label>
          <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value) || new Date().getFullYear())} style={inputSt} />
        </div>
        <div style={{ width: "150px" }}>
          <label style={labelSt}>Mes</label>
          <select value={mes} onChange={e => setMes(e.target.value)} style={{ ...inputSt, background: "#fff" }}>
            <option value="">Todo el año</option>
            {MESES.map((n, i) => <option key={n} value={String(i + 1).padStart(2, "0")}>{n}</option>)}
          </select>
        </div>
        <div style={{ width: "140px" }}>
          <label style={labelSt}>Tipo</label>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)} style={{ ...inputSt, background: "#fff" }}>
            <option value="todos">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>
        </div>
        <div style={{ width: "160px" }}>
          <label style={labelSt}>Medio de pago</label>
          <select value={filtroMedio} onChange={e => setFiltroMedio(e.target.value)} style={{ ...inputSt, background: "#fff" }}>
            <option value="Todos">Todos</option>
            {MEDIOS_PAGO.map(mp => <option key={mp} value={mp}>{mp}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: "180px" }}>
          <label style={labelSt}>Buscar</label>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Cliente, concepto o teléfono..." style={inputSt} />
        </div>
      </div>

      {/* TOTALES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        <div style={cardSt}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#15803d", fontWeight: 800, fontSize: "0.75rem", textTransform: "uppercase" }}><TrendingUp size={16} /> Ingresos</div>
          <div style={{ fontSize: "1.7rem", fontWeight: 900, color: "#15803d", marginTop: "6px" }}>{fmtPeso(tot.ingresos)}</div>
        </div>
        <div style={cardSt}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#b91c1c", fontWeight: 800, fontSize: "0.75rem", textTransform: "uppercase" }}><TrendingDown size={16} /> Egresos</div>
          <div style={{ fontSize: "1.7rem", fontWeight: 900, color: "#b91c1c", marginTop: "6px" }}>{fmtPeso(tot.egresos)}</div>
        </div>
        <div style={cardSt}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary-blue)", fontWeight: 800, fontSize: "0.75rem", textTransform: "uppercase" }}><Wallet size={16} /> Saldo</div>
          <div style={{ fontSize: "1.7rem", fontWeight: 900, color: tot.saldo < 0 ? "#b91c1c" : "var(--primary-blue)", marginTop: "6px" }}>{fmtPeso(tot.saldo)}</div>
        </div>
      </div>

      {/* RESÚMENES */}
      {visibles.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "20px" }}>
          <div style={{ ...cardSt, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", fontWeight: 800, color: "var(--primary-blue)", borderBottom: "1px solid #eee" }}>Por medio de pago</div>
            <div className="admin-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead style={{ background: "#fafafa" }}><tr><th style={thSt}>Medio</th><th style={{ ...thSt, textAlign: "right" }}>Ingresos</th><th style={{ ...thSt, textAlign: "right" }}>Egresos</th><th style={{ ...thSt, textAlign: "right" }}>Neto</th></tr></thead>
                <tbody>
                  {medios.map(r => (
                    <tr key={r.medio} style={{ borderTop: "1px solid #f3f3f3" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 700 }}>{r.medio}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#15803d" }}>{fmtPeso(r.ingresos)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#b91c1c" }}>{fmtPeso(r.egresos)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: r.neto < 0 ? "#b91c1c" : "inherit" }}>{fmtPeso(r.neto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...cardSt, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", fontWeight: 800, color: "var(--primary-blue)", borderBottom: "1px solid #eee" }}>Ingresos por rubro</div>
            <div className="admin-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead style={{ background: "#fafafa" }}><tr><th style={thSt}>Rubro</th><th style={{ ...thSt, textAlign: "right" }}>Operaciones</th><th style={{ ...thSt, textAlign: "right" }}>Total</th></tr></thead>
                <tbody>
                  {rubros.map(r => (
                    <tr key={r.categoria} style={{ borderTop: "1px solid #f3f3f3" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 700 }}>{r.categoria}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>{r.cantidad}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800 }}>{fmtPeso(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!mes && (
            <div style={{ ...cardSt, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", fontWeight: 800, color: "var(--primary-blue)", borderBottom: "1px solid #eee" }}>Resumen por mes</div>
              <div className="admin-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead style={{ background: "#fafafa" }}><tr><th style={thSt}>Mes</th><th style={{ ...thSt, textAlign: "right" }}>Ingresos</th><th style={{ ...thSt, textAlign: "right" }}>Egresos</th><th style={{ ...thSt, textAlign: "right" }}>Saldo</th></tr></thead>
                  <tbody>
                    {meses.map(r => (
                      <tr key={r.mes} style={{ borderTop: "1px solid #f3f3f3" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700 }}>{MESES[Number(r.mes.slice(5)) - 1]}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#15803d" }}>{fmtPeso(r.ingresos)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#b91c1c" }}>{fmtPeso(r.egresos)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: r.saldo < 0 ? "#b91c1c" : "inherit" }}>{fmtPeso(r.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MOVIMIENTOS */}
      <div style={{ ...cardSt, padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "50px", textAlign: "center", color: "#999" }}>Cargando movimientos...</div>
        ) : visibles.length === 0 ? (
          <div style={{ padding: "50px", textAlign: "center", color: "#999" }}>No hay movimientos para este período.</div>
        ) : (
          <div className="admin-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
              <thead style={{ background: "#fafafa", borderBottom: "1.5px solid #eee" }}>
                <tr>
                  <th style={thSt}>Fecha</th><th style={thSt}>Cliente / Quién</th><th style={thSt}>Concepto</th><th style={thSt}>Medio</th>
                  <th style={{ ...thSt, textAlign: "right" }}>Ingreso</th><th style={{ ...thSt, textAlign: "right" }}>Egreso</th><th style={thSt}></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(m => (
                  <tr key={m.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ padding: "12px 14px", fontSize: "0.85rem", whiteSpace: "nowrap" }}>{fmtFecha(m.fecha)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.88rem" }}>{m.cliente || "—"}</div>
                      {m.telefono && <div style={{ fontSize: "0.72rem", color: "#888" }}>{m.telefono}</div>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: "0.85rem" }}>
                      {m.concepto || "—"}
                      {m.categorias?.length > 0 && <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", marginTop: "2px" }}>{m.categorias.join(" + ")}</div>}
                      {m.productoNombre && <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#15803d", marginTop: "2px" }}>📦 -{m.cantidadVendida} {m.productoNombre}</div>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: "0.82rem" }}>{m.medioPago}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#15803d", whiteSpace: "nowrap" }}>{m.tipo === "ingreso" ? fmtPeso(m.monto) : ""}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#b91c1c", whiteSpace: "nowrap" }}>{m.tipo === "egreso" ? fmtPeso(m.monto) : ""}</td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <button onClick={() => abrirEditar(m)} title="Editar" style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><Pencil size={16} /></button>
                      <button onClick={() => setBorrarId(m.id)} title="Eliminar" style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", marginLeft: "6px" }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL MOVIMIENTO */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <form onSubmit={guardar} style={{ background: "#fff", borderRadius: "16px", padding: "28px", maxWidth: "520px", width: "100%", maxHeight: "92vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--primary-blue)", margin: "0 0 18px" }}>
              {editId ? "Editar movimiento" : form.tipo === "ingreso" ? "Nuevo ingreso" : "Nuevo egreso"}
            </h2>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              {(["ingreso", "egreso"] as const).map(t => (
                <button key={t} type="button" onClick={() => setCampo("tipo", t)}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1.5px solid " + (form.tipo === t ? (t === "ingreso" ? "#16a34a" : "#dc2626") : "#ddd"), background: form.tipo === t ? (t === "ingreso" ? "#dcfce7" : "#fee2e2") : "#fff", fontWeight: 800, cursor: "pointer", textTransform: "capitalize" }}>
                  {t}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
              <div><label style={labelSt}>Fecha</label><input type="date" value={form.fecha} onChange={e => setCampo("fecha", e.target.value)} style={inputSt} /></div>
              <div><label style={labelSt}>Monto ($)</label><input type="number" min="0" step="0.01" inputMode="decimal" value={form.monto} onChange={e => setCampo("monto", e.target.value)} placeholder="0" style={inputSt} autoFocus /></div>
              <div>
                <label style={labelSt}>Medio de pago</label>
                <select value={form.medioPago} onChange={e => setCampo("medioPago", e.target.value)} style={{ ...inputSt, background: "#fff" }}>
                  {MEDIOS_PAGO.map(mp => <option key={mp} value={mp}>{mp}</option>)}
                </select>
              </div>
              {form.tipo === "ingreso" && (
                <div><label style={labelSt}>Teléfono</label><input value={form.telefono} onChange={e => setCampo("telefono", e.target.value)} style={inputSt} /></div>
              )}
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={labelSt}>{form.tipo === "ingreso" ? "Cliente" : "Quién retira / proveedor"}</label>
              <input value={form.cliente} onChange={e => setCampo("cliente", e.target.value)} style={inputSt} />
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={labelSt}>Concepto</label>
              <input value={form.concepto} onChange={e => setCampo("concepto", e.target.value)} placeholder={form.tipo === "ingreso" ? "Ej: Mant. 1kg" : "Ej: Extracción de caja, insumos"} style={inputSt} />
            </div>

            {form.tipo === "ingreso" && (
              <div style={{ marginBottom: "14px" }}>
                <label style={labelSt}>Rubro</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {CATEGORIAS_INGRESO.map(c => (
                    <button key={c} type="button" onClick={() => toggleCategoria(c)}
                      style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #ddd", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", background: form.categorias.includes(c) ? "var(--primary-blue)" : "#fff", color: form.categorias.includes(c) ? "#fff" : "#555" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {esVenta && (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px", marginBottom: "14px", background: "#f0fdf4", padding: "14px", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
                <div>
                  <label style={labelSt}>Producto (descuenta stock)</label>
                  <select value={form.productoId} onChange={e => setCampo("productoId", e.target.value)} style={{ ...inputSt, background: "#fff" }}>
                    <option value="">-- No descontar stock --</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.titulo} (stock: {p.stock})</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Cantidad</label>
                  <input type="number" min="1" step="1" value={form.cantidadVendida} onChange={e => setCampo("cantidadVendida", e.target.value)} style={inputSt} disabled={!form.productoId} />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button type="button" onClick={() => setModal(false)} style={{ flex: 1, padding: "13px", borderRadius: "10px", border: "1px solid #ddd", background: "#f8f9fa", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button type="submit" disabled={saving} className="btn-red" style={{ flex: 2, padding: "13px", borderRadius: "10px", fontWeight: 800 }}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRMAR ELIMINAR */}
      {borrarId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "10px" }}>¿Eliminar este movimiento?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "22px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setBorrarId(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={eliminar} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
      <Toast {...toast} />
    </div>
  );
}
