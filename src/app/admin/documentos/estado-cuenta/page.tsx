"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, query, where, doc, getDoc, addDoc, updateDoc, deleteDoc,
  writeBatch, serverTimestamp,
} from "firebase/firestore";
import { useToast, Toast } from "@/components/Toast";
import {
  ArrowLeft, Search, Plus, Pencil, Copy, Trash2, Download, ImageDown, Printer, Share2,
  FileText, CircleDollarSign, Scale, ChartColumn, Landmark, CreditCard, Banknote, Wallet, AlertTriangle, Eye,
} from "lucide-react";
import {
  MovCuenta, TipoMovCuenta, MEDIOS_PAGO_CUENTA, TIPO_LABEL, calcularEstado, resumenPorCliente,
  claveCliente, nombreCliente, fmtMonto, fmtFechaCuenta, hoyIso, libroDesdePago, ordenarMovs,
} from "@/lib/cuentaCorriente";
import { generateEstadoCuentaPDF, EstadoCuentaPdfData } from "@/lib/pdfGenerator";

interface Cliente { id: string; nombre?: string; apellido?: string; empresa?: string; razonSocial?: string; email?: string; dniCuit?: string; telefono?: string; }

interface FormMov {
  tipo: TipoMovCuenta; fecha: string; comprobante: string; descripcion: string; importe: string;
  medioPago: string; facturaRef: string; enLibro: boolean;
}

const formVacio = (tipo: TipoMovCuenta): FormMov => ({
  tipo, fecha: hoyIso(), comprobante: "", descripcion: "", importe: "", medioPago: "Transferencia", facturaRef: "", enLibro: true,
});

const NAVY = "var(--primary-blue)";
const RED = "var(--primary-red)";
const GREEN = "#15803d";
const BLUE = "#2563eb";

const inputSt: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid #ddd", fontSize: "0.9rem", outline: "none", boxSizing: "border-box", background: "#fff" };
const labelSt: React.CSSProperties = { display: "block", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "5px", color: "#666" };
const cardSt: React.CSSProperties = { background: "#fff", borderRadius: "14px", border: "1px solid #eee", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" };
const thSt: React.CSSProperties = { padding: "12px 12px", fontSize: "0.72rem", fontWeight: 800, color: "#fff", textAlign: "left", whiteSpace: "nowrap" };
const tdSt: React.CSSProperties = { padding: "11px 12px", fontSize: "0.84rem", borderBottom: "1px solid #eef2f7", verticalAlign: "middle" };
const btnSt: React.CSSProperties = { padding: "10px 14px", borderRadius: "10px", border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", fontSize: "0.84rem" };

const TIPO_STYLE: Record<TipoMovCuenta, { color: string; bg: string; icon: React.ReactNode }> = {
  factura: { color: BLUE, bg: "#dbeafe", icon: <FileText size={14} /> },
  pago: { color: GREEN, bg: "#dcfce7", icon: <CircleDollarSign size={14} /> },
  ajuste: { color: "#475569", bg: "#f1f5f9", icon: <Scale size={14} /> },
};

const iconoMedio = (m?: string) =>
  m === "Transferencia" ? <Landmark size={13} /> : m === "E-Cheq" || m === "Cheque" ? <CreditCard size={13} /> : m === "Efectivo" ? <Banknote size={13} /> : <Wallet size={13} />;

function EstadoCuentaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, showToast } = useToast();

  const [role, setRole] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<{ uid: string; nombre: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [movs, setMovs] = useState<MovCuenta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pendientesMigrar, setPendientesMigrar] = useState(0);
  const [migrando, setMigrando] = useState(false);

  // Resumen de clientes
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "deuda" | "saldada">("todos");

  // Estado de cuenta de un cliente
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtroMedio, setFiltroMedio] = useState("");
  const [exportando, setExportando] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  // Alta / edición de movimientos
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormMov>(formVacio("factura"));
  const [saving, setSaving] = useState(false);
  const [borrar, setBorrar] = useState<MovCuenta | null>(null);

  const isCliente = role === "cliente";
  const isAdmin = role === "admin" || role === "superadmin";
  const puedeEditar = !!role && !isCliente;
  const clienteKey = isCliente ? usuario?.uid || null : searchParams.get("c");

  const cargarMovs = useCallback(async (r: string, uid: string) => {
    const snap = await getDocs(r === "cliente"
      ? query(collection(db, "cuenta_corriente"), where("clienteId", "==", uid))
      : collection(db, "cuenta_corriente"));
    setMovs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MovCuenta)));
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      try {
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        const data = snap.exists() ? snap.data() : {};
        const r = data.rol || "cliente";
        if (r === "tecnico" || r === "tecnicoTaller") { router.push("/admin"); return; }
        setRole(r);
        setUsuario({ uid: u.uid, nombre: data.nombre || u.email || "" });
        if (r === "cliente") {
          setClientes([{ id: u.uid, ...data } as Cliente]);
        } else {
          const cs = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente")));
          setClientes(cs.docs.map(d => ({ id: d.id, ...d.data() } as Cliente)));
          if (r === "admin" || r === "superadmin") {
            const viejos = await getDocs(collection(db, "estados-cuenta"));
            setPendientesMigrar(viejos.docs.filter(d => !d.data().migrado).length);
          }
        }
        await cargarMovs(r, u.uid);
      } catch (e) {
        console.error(e);
        showToast("No se pudieron cargar los movimientos.", "error");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router, cargarMovs, showToast]);

  const recargar = () => role && usuario && cargarMovs(role, usuario.uid);

  // ── Datos del cliente seleccionado ──
  const movsCliente = useMemo(() => movs.filter(m => m.clienteKey === clienteKey), [movs, clienteKey]);
  const clienteInfo = useMemo(() => {
    if (!clienteKey) return null;
    const c = clientes.find(x => x.id === clienteKey);
    const ultimo = ordenarMovs(movsCliente).slice(-1)[0];
    return {
      key: clienteKey,
      id: c ? c.id : ultimo?.clienteId || null,
      nombre: c ? nombreCliente(c) : ultimo?.clienteNombre || "",
      empresa: c?.empresa || c?.razonSocial || ultimo?.clienteEmpresa || "",
      cuit: c?.dniCuit || movsCliente.find(m => m.clienteCuit)?.clienteCuit || "",
    };
  }, [clienteKey, clientes, movsCliente]);

  const estado = useMemo(() => calcularEstado(movsCliente, desde, hasta), [movsCliente, desde, hasta]);
  const filasVisibles = filtroMedio
    ? estado.filas.filter(f => f.mov.tipo === "pago" && f.mov.medioPago === filtroMedio)
    : estado.filas;
  const facturasCliente = ordenarMovs(movsCliente.filter(m => m.tipo === "factura")).reverse();

  // ── Resumen de todos los clientes ──
  const resumen = useMemo(() => resumenPorCliente(movs), [movs]);
  const resumenVisible = resumen.filter(r =>
    (filtroEstado === "todos" || (filtroEstado === "deuda" ? r.saldo > 0.009 : r.saldo <= 0.009)) &&
    (!busqueda || `${r.nombre} ${r.cuit}`.toLowerCase().includes(busqueda.toLowerCase()))
  );
  const deudaTotal = resumen.reduce((a, r) => a + Math.max(0, r.saldo), 0);
  const clientesConDeuda = resumen.filter(r => r.saldo > 0.009).length;

  const sugerencias = busqueda.length < 2 ? [] : clientes
    .filter(c => !resumen.some(r => r.clienteKey === c.id))
    .filter(c => `${nombreCliente(c)} ${c.nombre || ""} ${c.apellido || ""} ${c.email || ""} ${c.dniCuit || ""}`.toLowerCase().includes(busqueda.toLowerCase()))
    .slice(0, 8);

  const abrirCliente = (key: string) => router.push(`/admin/documentos/estado-cuenta?c=${encodeURIComponent(key)}`);

  // ── Alta / edición ──
  const setCampo = <K extends keyof FormMov>(k: K, v: FormMov[K]) => setForm(prev => ({ ...prev, [k]: v }));

  const abrirNuevo = (tipo: TipoMovCuenta) => { setEditId(null); setForm(formVacio(tipo)); setModal(true); };
  const abrirEditar = (m: MovCuenta, duplicar = false) => {
    setEditId(duplicar ? null : m.id);
    setForm({
      tipo: m.tipo,
      fecha: duplicar ? hoyIso() : m.fecha,
      comprobante: duplicar ? "" : m.comprobante || "",
      descripcion: m.descripcion || "",
      importe: String(m.importe),
      medioPago: m.medioPago || "Transferencia",
      facturaRef: duplicar ? "" : m.facturaRef || "",
      enLibro: duplicar ? true : !!m.libroId,
    });
    setModal(true);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteInfo || !usuario) return;
    const importe = Number(form.importe.replace(",", "."));
    if (!form.fecha) { showToast("Ingresá la fecha.", "error"); return; }
    if (!(importe > 0)) { showToast("El importe tiene que ser mayor a cero.", "error"); return; }
    if (form.tipo === "factura" && !form.comprobante.trim()) { showToast("Ingresá el número de factura.", "error"); return; }
    setSaving(true);
    try {
      const esPago = form.tipo === "pago";
      const facturaRef = esPago && form.facturaRef ? form.facturaRef : null;
      const fRef = facturaRef ? facturasCliente.find(f => f.id === facturaRef) : null;
      const descripcion = form.descripcion.trim() || (fRef ? `Pago de factura ${fRef.comprobante}` : "");
      const payload = {
        clienteKey: clienteInfo.key,
        clienteId: clienteInfo.id,
        clienteNombre: clienteInfo.nombre,
        clienteEmpresa: clienteInfo.empresa,
        clienteCuit: clienteInfo.cuit,
        tipo: form.tipo,
        fecha: form.fecha,
        comprobante: form.comprobante.trim(),
        descripcion,
        importe,
        medioPago: esPago ? form.medioPago : null,
        facturaRef,
        updatedAt: serverTimestamp(),
      };
      const anterior = editId ? movs.find(m => m.id === editId) : null;
      let movId = editId;
      if (editId) {
        await updateDoc(doc(db, "cuenta_corriente", editId), payload);
      } else {
        const ref = await addDoc(collection(db, "cuenta_corriente"), {
          ...payload, libroId: null, createdAt: serverTimestamp(),
          creadoPorId: usuario.uid, creadoPorNombre: usuario.nombre,
        });
        movId = ref.id;
      }

      // Espejo en el Libro Contable: cada cobro entra como ingreso del local.
      const libroId = anterior?.libroId || null;
      if (esPago && form.enLibro) {
        const datosLibro = { ...libroDesdePago({ ...payload, medioPago: form.medioPago }, movId!), updatedAt: serverTimestamp() };
        if (libroId) {
          await updateDoc(doc(db, "libro_contable", libroId), datosLibro);
        } else {
          const lref = await addDoc(collection(db, "libro_contable"), {
            ...datosLibro, creadoPorId: usuario.uid, creadoPorNombre: usuario.nombre, createdAt: serverTimestamp(),
          });
          await updateDoc(doc(db, "cuenta_corriente", movId!), { libroId: lref.id });
        }
      } else if (libroId) {
        await deleteDoc(doc(db, "libro_contable", libroId)).catch(console.error);
        await updateDoc(doc(db, "cuenta_corriente", movId!), { libroId: null });
      }

      setModal(false);
      showToast(editId ? "Movimiento actualizado" : `${TIPO_LABEL[form.tipo]} registrado`, "success");
      await recargar();
    } catch (err) {
      console.error(err);
      showToast("Error al guardar. Intentá de nuevo.", "error");
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async () => {
    if (!borrar) return;
    try {
      if (borrar.libroId) await deleteDoc(doc(db, "libro_contable", borrar.libroId)).catch(console.error);
      await deleteDoc(doc(db, "cuenta_corriente", borrar.id));
      setMovs(prev => prev.filter(m => m.id !== borrar.id));
      showToast("Movimiento eliminado", "success");
    } catch (err) {
      console.error(err);
      showToast("No se pudo eliminar.", "error");
    } finally {
      setBorrar(null);
    }
  };

  // ── Migración de los estados de cuenta cargados a mano ──
  const migrar = async () => {
    if (!usuario) return;
    setMigrando(true);
    try {
      const snap = await getDocs(collection(db, "estados-cuenta"));
      let creados = 0;
      for (const d of snap.docs) {
        const e = d.data();
        if (e.migrado) continue;
        const nombre = nombreCliente({ nombre: e.clienteNombre, apellido: e.clienteApellido, empresa: e.clienteEmpresa }) || "Sin nombre";
        const key = claveCliente(e.clienteId, nombre);
        const comprobante = `EC-${String(e.numero || "").padStart(5, "0")}`;
        const batch = writeBatch(db);
        for (const it of (e.items || []) as { descripcion?: string; monto?: number; tipo?: string }[]) {
          const importe = Number(it.monto) || 0;
          if (!(importe > 0)) continue;
          batch.set(doc(collection(db, "cuenta_corriente")), {
            clienteKey: key, clienteId: e.clienteId || null, clienteNombre: nombre,
            clienteEmpresa: e.clienteEmpresa || "", clienteCuit: e.clienteDniCuit || "",
            tipo: it.tipo === "ingreso" ? "pago" : "factura",
            fecha: e.fecha || hoyIso(),
            comprobante,
            descripcion: [it.descripcion, e.obraNombre].filter(Boolean).join(" — "),
            importe,
            medioPago: it.tipo === "ingreso" ? "Otro" : null,
            facturaRef: null, libroId: null, migradoDe: d.id,
            creadoPorId: usuario.uid, creadoPorNombre: usuario.nombre,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
          creados++;
        }
        batch.update(doc(db, "estados-cuenta", d.id), { migrado: true, migradoEn: serverTimestamp() });
        await batch.commit();
      }
      setPendientesMigrar(0);
      showToast(`Listo: se pasaron ${creados} movimientos al nuevo sistema.`, "success");
      await recargar();
    } catch (err) {
      console.error(err);
      showToast("Error al migrar. Lo que ya se pasó quedó marcado; podés reintentar.", "error");
    } finally {
      setMigrando(false);
    }
  };

  // ── Exportar ──
  const datosPdf = (): EstadoCuentaPdfData | null => {
    if (!clienteInfo) return null;
    const emision = hoyIso();
    return {
      clienteNombre: clienteInfo.nombre, clienteCuit: clienteInfo.cuit, desde, hasta, emision,
      saldoAnterior: estado.saldoAnterior,
      filas: [
        ...(desde ? [{ fecha: desde, tipo: "anterior" as const, comprobante: "", descripcion: "", importe: 0, saldo: estado.saldoAnterior }] : []),
        ...estado.filas.map(f => ({
          fecha: f.mov.fecha, tipo: f.mov.tipo, comprobante: f.mov.comprobante, descripcion: f.mov.descripcion,
          importe: f.mov.importe, medioPago: f.mov.medioPago, saldo: f.saldo,
        })),
      ],
      totalFacturado: estado.totalFacturado, totalPagos: estado.totalPagos, totalAjustes: estado.totalAjustes,
      saldoFinal: estado.saldoFinal, cantFacturas: estado.cantFacturas, cantPagos: estado.cantPagos,
    };
  };

  const exportarPdf = async (modo: "descargar" | "imprimir") => {
    const d = datosPdf(); if (!d) return;
    setExportando(modo);
    try { await generateEstadoCuentaPDF(d, modo); }
    catch (e) { console.error(e); showToast("No se pudo generar el PDF.", "error"); }
    finally { setExportando(null); }
  };

  const exportarImagen = async () => {
    const nodo = docRef.current; if (!nodo || !clienteInfo) return;
    setExportando("imagen");
    // Se fija un ancho de escritorio para que la tabla no salga cortada si se exporta desde el celular.
    const anchoPrevio = nodo.style.width;
    const scrolls = Array.from(nodo.querySelectorAll<HTMLElement>(".ec-scroll"));
    nodo.style.width = "1100px";
    scrolls.forEach(s => (s.style.overflow = "visible"));
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(nodo, {
        pixelRatio: 2, backgroundColor: "#ffffff",
        filter: n => !(n instanceof HTMLElement && n.dataset.noexport === "1"),
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `EstadoCuenta-${clienteInfo.nombre.replace(/[^\w]+/g, "_")}-${hoyIso()}.png`;
      a.click();
    } catch (e) {
      console.error(e);
      showToast("No se pudo generar la imagen.", "error");
    } finally {
      nodo.style.width = anchoPrevio;
      scrolls.forEach(s => (s.style.overflow = ""));
      setExportando(null);
    }
  };

  const compartir = async () => {
    const d = datosPdf(); if (!d || !clienteInfo) return;
    setExportando("compartir");
    const texto = `Estado de cuenta ARIFA — ${clienteInfo.nombre}\nSaldo pendiente al ${fmtFechaCuenta(hasta || d.emision)}: ${fmtMonto(estado.saldoFinal)}`;
    try {
      const blob = await generateEstadoCuentaPDF(d, "blob") as Blob;
      const archivo = new File([blob], `EstadoCuenta-${clienteInfo.nombre.replace(/[^\w]+/g, "_")}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo], title: "Estado de cuenta ARIFA", text: texto });
      } else {
        // En la PC no se pueden compartir archivos: se descarga el PDF y se abre WhatsApp con el resumen para adjuntarlo.
        await generateEstadoCuentaPDF(d, "descargar");
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") { console.error(e); showToast("No se pudo compartir.", "error"); }
    } finally {
      setExportando(null);
    }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center", color: "var(--text-muted)" }}>Cargando estados de cuenta...</div>;

  // ════════════════ RESUMEN DE CLIENTES ════════════════
  if (!clienteKey) {
    return (
      <div style={{ maxWidth: "1100px", margin: "0 auto", paddingBottom: "80px" }}>
        <header style={{ marginBottom: "22px" }}>
          <button onClick={() => router.push("/admin/documentos")}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#888", fontWeight: 600, cursor: "pointer", marginBottom: "8px", padding: 0, fontSize: "0.85rem" }}>
            <ArrowLeft size={16} /> Documentos
          </button>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: NAVY, margin: 0 }}>Estados de Cuenta</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>
            Se calculan solos con las facturas y los pagos cargados de cada cliente.
          </p>
        </header>

        {isAdmin && pendientesMigrar > 0 && (
          <div style={{ ...cardSt, padding: "16px 18px", marginBottom: "18px", background: "#fffbeb", borderColor: "#fde68a", display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
            <AlertTriangle size={22} color="#b45309" />
            <div style={{ flex: 1, minWidth: "240px", fontSize: "0.88rem", color: "#78350f" }}>
              Hay <b>{pendientesMigrar}</b> estado{pendientesMigrar === 1 ? "" : "s"} de cuenta cargado{pendientesMigrar === 1 ? "" : "s"} con el sistema anterior.
              Al pasarlos, cada renglón de deuda queda como factura y cada pago como pago (con la fecha del documento).
              Esos pagos <b>no</b> se copian al Libro Contable para no duplicar cobros que ya estén ahí.
            </div>
            <button onClick={migrar} disabled={migrando} className="btn-blue" style={{ padding: "10px 16px", borderRadius: "10px", fontWeight: 800 }}>
              {migrando ? "Pasando..." : "Pasar al nuevo sistema"}
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "18px" }}>
          <div style={{ ...cardSt, padding: "18px", background: "#fef2f2", borderColor: "#fecaca" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: RED, textTransform: "uppercase" }}>Deuda total de clientes</div>
            <div style={{ fontSize: "1.7rem", fontWeight: 900, color: RED, marginTop: "4px" }}>{fmtMonto(deudaTotal)}</div>
          </div>
          <div style={{ ...cardSt, padding: "18px" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Clientes con deuda</div>
            <div style={{ fontSize: "1.7rem", fontWeight: 900, color: NAVY, marginTop: "4px" }}>{clientesConDeuda} <span style={{ fontSize: "0.9rem", color: "#94a3b8", fontWeight: 700 }}>de {resumen.length}</span></div>
          </div>
        </div>

        <div style={{ ...cardSt, padding: "16px", marginBottom: "18px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: "240px", position: "relative" }}>
            <label style={labelSt}>Cliente</label>
            <div style={{ position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, empresa o CUIT..." style={{ ...inputSt, paddingLeft: "34px" }} />
            </div>
            {sugerencias.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "10px", zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", marginTop: "4px", overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", fontSize: "0.68rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", background: "#f8fafc" }}>Clientes sin movimientos todavía</div>
                {sugerencias.map(c => (
                  <div key={c.id} onClick={() => abrirCliente(c.id)} style={{ padding: "10px 14px", cursor: "pointer", borderTop: "1px solid #f1f5f9" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8f9ff")} onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: "0.88rem" }}>{nombreCliente(c)}</div>
                    <div style={{ fontSize: "0.75rem", color: "#888" }}>{[c.dniCuit, c.email].filter(Boolean).join(" · ")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ width: "190px" }}>
            <label style={labelSt}>Estado</label>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)} style={inputSt}>
              <option value="todos">Todos</option>
              <option value="deuda">Deuda pendiente</option>
              <option value="saldada">Cuenta saldada</option>
            </select>
          </div>
        </div>

        <div style={{ ...cardSt, overflow: "hidden" }}>
          {resumenVisible.length === 0 ? (
            <div style={{ padding: "50px", textAlign: "center", color: "#999" }}>
              {resumen.length === 0 ? "Todavía no hay facturas ni pagos cargados. Buscá un cliente para empezar." : "No hay clientes con ese filtro."}
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                <thead style={{ background: NAVY }}>
                  <tr>
                    <th style={thSt}>Cliente</th>
                    <th style={{ ...thSt, textAlign: "right" }}>Facturado</th>
                    <th style={{ ...thSt, textAlign: "right" }}>Pagado</th>
                    <th style={{ ...thSt, textAlign: "right" }}>Retenciones</th>
                    <th style={{ ...thSt, textAlign: "right" }}>Saldo</th>
                    <th style={thSt}>Último mov.</th>
                    <th style={thSt}></th>
                  </tr>
                </thead>
                <tbody>
                  {resumenVisible.map(r => (
                    <tr key={r.clienteKey} onClick={() => abrirCliente(r.clienteKey)} style={{ cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      <td style={tdSt}>
                        <div style={{ fontWeight: 800, color: NAVY }}>{r.nombre}</div>
                        {r.cuit && <div style={{ fontSize: "0.74rem", color: "#888" }}>CUIT {r.cuit}</div>}
                      </td>
                      <td style={{ ...tdSt, textAlign: "right", color: BLUE, fontWeight: 700 }}>{fmtMonto(r.facturado)}</td>
                      <td style={{ ...tdSt, textAlign: "right", color: GREEN, fontWeight: 700 }}>{fmtMonto(r.pagado)}</td>
                      <td style={{ ...tdSt, textAlign: "right", color: "#64748b" }}>{r.ajustes ? fmtMonto(r.ajustes) : "-"}</td>
                      <td style={{ ...tdSt, textAlign: "right", fontWeight: 900, color: r.saldo > 0.009 ? RED : GREEN }}>
                        {r.saldo > 0.009 ? fmtMonto(r.saldo) : r.saldo < -0.009 ? `A favor ${fmtMonto(-r.saldo)}` : "Saldada"}
                      </td>
                      <td style={{ ...tdSt, fontSize: "0.8rem", color: "#666" }}>{fmtFechaCuenta(r.ultimaFecha)}</td>
                      <td style={{ ...tdSt, textAlign: "right" }}><Eye size={17} color="#94a3b8" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Toast {...toast} />
      </div>
    );
  }

  // ════════════════ ESTADO DE CUENTA DE UN CLIENTE ════════════════
  const saldoRojo = estado.saldoFinal > 0.009;

  return (
    <div style={{ maxWidth: "1150px", margin: "0 auto", paddingBottom: "80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        {!isCliente ? (
          <button onClick={() => router.push("/admin/documentos/estado-cuenta")}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: "0.9rem" }}>
            <ArrowLeft size={18} /> Todos los clientes
          </button>
        ) : <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: NAVY, margin: 0 }}>Mi estado de cuenta</h1>}
        {puedeEditar && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={() => abrirNuevo("factura")} style={{ ...btnSt, background: "#dbeafe", borderColor: "#bfdbfe", color: BLUE }}><Plus size={16} /> Factura</button>
            <button onClick={() => abrirNuevo("pago")} style={{ ...btnSt, background: "#dcfce7", borderColor: "#bbf7d0", color: GREEN }}><Plus size={16} /> Pago</button>
            <button onClick={() => abrirNuevo("ajuste")} style={{ ...btnSt, background: "#f1f5f9", color: "#475569" }}><Plus size={16} /> Retención / ajuste</button>
          </div>
        )}
      </div>

      {/* FILTROS Y ACCIONES */}
      <div style={{ ...cardSt, padding: "14px 16px", marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ width: "150px" }}><label style={labelSt}>Desde</label><input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={inputSt} /></div>
        <div style={{ width: "150px" }}><label style={labelSt}>Hasta</label><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={inputSt} /></div>
        <div style={{ width: "170px" }}>
          <label style={labelSt}>Medio de pago</label>
          <select value={filtroMedio} onChange={e => setFiltroMedio(e.target.value)} style={inputSt}>
            <option value="">Todos</option>
            {MEDIOS_PAGO_CUENTA.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {(desde || hasta || filtroMedio) && (
          <button onClick={() => { setDesde(""); setHasta(""); setFiltroMedio(""); }} style={{ ...btnSt, color: "#666" }}>Limpiar</button>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => exportarPdf("descargar")} disabled={!!exportando} style={btnSt}><Download size={16} /> {exportando === "descargar" ? "Generando..." : "PDF"}</button>
          <button onClick={exportarImagen} disabled={!!exportando} style={btnSt}><ImageDown size={16} /> {exportando === "imagen" ? "Generando..." : "Imagen"}</button>
          <button onClick={() => exportarPdf("imprimir")} disabled={!!exportando} style={btnSt}><Printer size={16} /> Imprimir</button>
          <button onClick={compartir} disabled={!!exportando} className="btn-red" style={{ ...btnSt, border: "none" }}><Share2 size={16} /> {exportando === "compartir" ? "Preparando..." : "Compartir"}</button>
        </div>
      </div>
      {filtroMedio && (
        <div style={{ fontSize: "0.8rem", color: "#b45309", marginBottom: "12px" }}>
          Mostrando solo los pagos por {filtroMedio}. El saldo acumulado y las tarjetas consideran todos los movimientos; el PDF sale completo.
        </div>
      )}

      {/* DOCUMENTO */}
      <div ref={docRef} style={{ ...cardSt, padding: "26px", background: "#fff" }}>
        <div className="ec-header" style={{ display: "flex", gap: "24px", alignItems: "stretch", flexWrap: "wrap", marginBottom: "22px" }}>
          <div style={{ flex: "1 1 360px", display: "flex", gap: "16px", alignItems: "center" }}>
            <img src="/logos/logoFondoTransparente.svg" alt="ARIFA" style={{ height: "88px", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, color: NAVY, lineHeight: 1 }}>ARIFA</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 800, color: NAVY, letterSpacing: "1px", marginTop: "4px" }}>SEGURIDAD CONTRA INCENDIOS</div>
              <div style={{ fontSize: "0.72rem", color: "#555", marginTop: "6px", lineHeight: 1.5 }}>
                Higiene y Seguridad Laboral | Protección Contra Incendios<br />
                Venta, Recarga y Mantenimiento de Extintores | Ingeniería y Proyectos
              </div>
              <div style={{ display: "flex", height: "5px", borderRadius: "3px", overflow: "hidden", marginTop: "10px" }}>
                {["#0061aa", "#A31F1D", "#228b22", "#daa520"].map(c => <div key={c} style={{ flex: 1, background: c }} />)}
              </div>
            </div>
          </div>
          <div style={{ flex: "1 1 300px", borderLeft: "2px solid #002244", paddingLeft: "22px" }}>
            <div style={{ fontSize: "1.9rem", fontWeight: 900, color: NAVY, lineHeight: 1.1 }}>ESTADO DE CUENTA</div>
            <div style={{ background: "#f1f5f9", borderRadius: "10px", padding: "12px 14px", marginTop: "10px", fontSize: "0.88rem", lineHeight: 1.7 }}>
              <div><b style={{ color: NAVY }}>Cliente:</b> <b style={{ fontSize: "1rem" }}>{clienteInfo?.nombre.toUpperCase() || "-"}</b></div>
              <div><b style={{ color: NAVY }}>CUIT:</b> {clienteInfo?.cuit || "-"}</div>
              <div><b style={{ color: NAVY }}>Período:</b> {desde || hasta ? `${desde ? fmtFechaCuenta(desde) : "Inicio"} al ${fmtFechaCuenta(hasta || hoyIso())}` : "Todos los movimientos"}</div>
              <div><b style={{ color: NAVY }}>Fecha de emisión:</b> {fmtFechaCuenta(hoyIso())}</div>
            </div>
          </div>
        </div>

        <div className="ec-scroll" style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "920px" }}>
            <thead style={{ background: "#002244" }}>
              <tr>
                <th style={thSt}>Fecha</th>
                <th style={thSt}>Tipo</th>
                <th style={thSt}>Comprobante / N°</th>
                <th style={thSt}>Descripción</th>
                <th style={{ ...thSt, textAlign: "right" }}>Importe Facturado</th>
                <th style={{ ...thSt, textAlign: "center" }}>Importe Pago</th>
                <th style={{ ...thSt, textAlign: "center" }}>Medio de Pago</th>
                <th style={{ ...thSt, textAlign: "right" }}>Saldo Acumulado</th>
                {puedeEditar && <th style={thSt} data-noexport="1"></th>}
              </tr>
            </thead>
            <tbody>
              {desde && !filtroMedio && (
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ ...tdSt, color: "#64748b" }}>{fmtFechaCuenta(desde)}</td>
                  <td style={tdSt} colSpan={6}><i style={{ color: "#64748b" }}>Saldo anterior al período</i></td>
                  <td style={{ ...tdSt, textAlign: "right", fontWeight: 800 }}>{fmtMonto(estado.saldoAnterior)}</td>
                  {puedeEditar && <td style={tdSt} data-noexport="1"></td>}
                </tr>
              )}
              {filasVisibles.length === 0 && (
                <tr><td colSpan={puedeEditar ? 9 : 8} style={{ ...tdSt, textAlign: "center", padding: "40px", color: "#999" }}>
                  {movsCliente.length === 0 ? "Este cliente todavía no tiene facturas ni pagos cargados." : "No hay movimientos con estos filtros."}
                </td></tr>
              )}
              {filasVisibles.map(({ mov: m, saldo }, i) => {
                const st = TIPO_STYLE[m.tipo];
                return (
                  <tr key={m.id} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
                    <td style={{ ...tdSt, whiteSpace: "nowrap" }}>{fmtFechaCuenta(m.fecha)}</td>
                    <td style={tdSt}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 9px", borderRadius: "7px", background: st.bg, color: st.color, fontWeight: 800, fontSize: "0.76rem" }}>
                        {st.icon} {TIPO_LABEL[m.tipo]}
                      </span>
                    </td>
                    <td style={{ ...tdSt, whiteSpace: "nowrap" }}>{m.comprobante || "-"}</td>
                    <td style={tdSt}>{m.descripcion || "-"}</td>
                    <td style={{ ...tdSt, textAlign: "right", fontWeight: 800, color: NAVY, whiteSpace: "nowrap" }}>{m.tipo === "factura" ? fmtMonto(m.importe) : "-"}</td>
                    <td style={{ ...tdSt, textAlign: "center", whiteSpace: "nowrap" }}>
                      {m.tipo === "factura" ? "-" : (
                        <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "7px", fontWeight: 800, background: st.bg, color: st.color }}>{fmtMonto(m.importe)}</span>
                      )}
                    </td>
                    <td style={{ ...tdSt, textAlign: "center", whiteSpace: "nowrap" }}>
                      {m.tipo === "pago" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 9px", borderRadius: "7px", background: "#f0fdf4", color: GREEN, fontWeight: 700, fontSize: "0.78rem" }}>
                          {iconoMedio(m.medioPago)} {m.medioPago || "-"}
                        </span>
                      ) : m.tipo === "ajuste" ? <span style={{ color: "#64748b", fontSize: "0.78rem" }}>Ajuste</span> : "-"}
                    </td>
                    <td style={{ ...tdSt, textAlign: "right", fontWeight: 900, whiteSpace: "nowrap" }}>{fmtMonto(saldo)}</td>
                    {puedeEditar && (
                      <td style={{ ...tdSt, whiteSpace: "nowrap" }} data-noexport="1">
                        <button onClick={() => abrirEditar(m)} title="Editar" style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><Pencil size={15} /></button>
                        <button onClick={() => abrirEditar(m, true)} title="Duplicar" style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", marginLeft: "4px" }}><Copy size={15} /></button>
                        {isAdmin && <button onClick={() => setBorrar(m)} title="Eliminar" style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", marginLeft: "4px" }}><Trash2 size={15} /></button>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* TARJETAS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginTop: "20px" }}>
          <TarjetaTotal icon={<FileText size={26} />} titulo="Total facturado" valor={fmtMonto(estado.totalFacturado)}
            sub={`${estado.cantFacturas} factura${estado.cantFacturas === 1 ? "" : "s"} emitida${estado.cantFacturas === 1 ? "" : "s"}`} color={BLUE} bg="#eff6ff" />
          <TarjetaTotal icon={<CircleDollarSign size={26} />} titulo="Total pagos recibidos" valor={fmtMonto(estado.totalPagos)}
            sub={`${estado.cantPagos} pago${estado.cantPagos === 1 ? "" : "s"} recibido${estado.cantPagos === 1 ? "" : "s"}`} color={GREEN} bg="#f0fdf4" />
          <TarjetaTotal icon={<ChartColumn size={26} />} titulo="Diferencia / retenciones" valor={fmtMonto(estado.totalAjustes)}
            sub={estado.cantAjustes ? `${estado.cantAjustes} ajuste${estado.cantAjustes === 1 ? "" : "s"} registrado${estado.cantAjustes === 1 ? "" : "s"}` : "Sin retenciones registradas"} color="#475569" bg="#f1f5f9" />
          <TarjetaTotal icon={<Scale size={26} />} titulo="Saldo pendiente" valor={fmtMonto(estado.saldoFinal)}
            sub={`A la fecha ${fmtFechaCuenta(hasta || hoyIso())}${estado.saldoAnterior ? ` · incluye saldo anterior ${fmtMonto(estado.saldoAnterior)}` : ""}`}
            color={saldoRojo ? "#A31F1D" : GREEN} bg={saldoRojo ? "#fef2f2" : "#f0fdf4"} />
        </div>
      </div>

      {/* MODAL MOVIMIENTO */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <form onSubmit={guardar} style={{ background: "#fff", borderRadius: "16px", padding: "26px", maxWidth: "540px", width: "100%", maxHeight: "92vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>
              {editId ? "Editar movimiento" : "Nuevo movimiento"}
            </h2>
            <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "16px" }}>{clienteInfo?.nombre}</div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              {(["factura", "pago", "ajuste"] as const).map(t => (
                <button key={t} type="button" onClick={() => setCampo("tipo", t)}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1.5px solid " + (form.tipo === t ? TIPO_STYLE[t].color : "#ddd"), background: form.tipo === t ? TIPO_STYLE[t].bg : "#fff", color: form.tipo === t ? TIPO_STYLE[t].color : "#555", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  {TIPO_STYLE[t].icon} {t === "ajuste" ? "Retención" : TIPO_LABEL[t]}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
              <div>
                <label style={labelSt}>{form.tipo === "factura" ? "Fecha de emisión" : form.tipo === "pago" ? "Fecha efectiva del pago" : "Fecha"}</label>
                <input type="date" value={form.fecha} onChange={e => setCampo("fecha", e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Importe ($)</label>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={form.importe} onChange={e => setCampo("importe", e.target.value)} placeholder="0" style={inputSt} />
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={labelSt}>
                {form.tipo === "factura" ? "N° de factura *" : form.tipo === "pago" ? "N° de transferencia, E-Cheq u otro comprobante" : "N° de nota de crédito / certificado de retención"}
              </label>
              <input value={form.comprobante} onChange={e => setCampo("comprobante", e.target.value)}
                placeholder={form.tipo === "factura" ? "Ej: 0004-00000120" : form.tipo === "pago" ? "Ej: E-Cheq 00001234" : "Ej: Retención IIBB"} style={inputSt} />
            </div>

            {form.tipo === "pago" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={labelSt}>Medio de pago</label>
                  <select value={form.medioPago} onChange={e => setCampo("medioPago", e.target.value)} style={inputSt}>
                    {MEDIOS_PAGO_CUENTA.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Factura que paga (opcional)</label>
                  <select value={form.facturaRef} onChange={e => setCampo("facturaRef", e.target.value)} style={inputSt}>
                    <option value="">-- Pago a cuenta --</option>
                    {facturasCliente.map(f => <option key={f.id} value={f.id}>{f.comprobante} · {fmtMonto(f.importe)}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "14px" }}>
              <label style={labelSt}>Descripción</label>
              <input value={form.descripcion} onChange={e => setCampo("descripcion", e.target.value)}
                placeholder={form.tipo === "factura" ? "Ej: Servicio de recarga de extintores" : form.tipo === "pago" ? "Ej: Pago parcial (si elegís la factura se completa sola)" : "Ej: Retención de Ingresos Brutos"} style={inputSt} />
            </div>

            {form.tipo === "pago" && (
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "0.85rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px", cursor: "pointer" }}>
                <input type="checkbox" checked={form.enLibro} onChange={e => setCampo("enLibro", e.target.checked)} style={{ marginTop: "3px" }} />
                <span>
                  <b>Registrar también como ingreso en el Libro Contable.</b><br />
                  <span style={{ color: "#666" }}>Destildalo solo si ese cobro ya está cargado a mano en el libro.</span>
                </span>
              </label>
            )}
            {form.tipo === "ajuste" && (
              <div style={{ fontSize: "0.8rem", color: "#666", background: "#f8fafc", borderRadius: "10px", padding: "10px 12px" }}>
                Las retenciones, notas de crédito y ajustes <b>descuentan</b> del saldo del cliente.
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
      {borrar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", maxWidth: "420px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "10px" }}>¿Eliminar {TIPO_LABEL[borrar.tipo].toLowerCase()} {borrar.comprobante}?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "22px", fontSize: "0.9rem" }}>
              El saldo del cliente se recalcula sin este movimiento.{borrar.libroId ? " También se borra el ingreso del Libro Contable." : ""} No se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setBorrar(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={eliminar} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .ec-header > div:last-child { border-left: none !important; padding-left: 0 !important; }
        }
      `}</style>
      <Toast {...toast} />
    </div>
  );
}

function TarjetaTotal({ icon, titulo, valor, sub, color, bg }: { icon: React.ReactNode; titulo: string; valor: string; sub: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: "12px", padding: "16px 18px", display: "flex", gap: "14px", alignItems: "center" }}>
      <div style={{ color, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 800, color, textTransform: "uppercase" }}>{titulo}</div>
        <div style={{ fontSize: "1.45rem", fontWeight: 900, color, whiteSpace: "nowrap" }}>{valor}</div>
        <div style={{ fontSize: "0.74rem", color: "#64748b" }}>{sub}</div>
      </div>
    </div>
  );
}

export default function EstadoCuentaPage() {
  return (
    <Suspense fallback={<div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>}>
      <EstadoCuentaContent />
    </Suspense>
  );
}
