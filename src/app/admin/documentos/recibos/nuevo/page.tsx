"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, addDoc, getDocs, query, where, doc,
  getDoc, serverTimestamp, updateDoc, setDoc,
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Save, Plus, Trash2, User, FileText,
  Hash, Calendar, DollarSign, PenLine,
} from "lucide-react";
import { Suspense } from "react";

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.7rem", fontWeight: 800,
  color: "#999", marginBottom: "5px", textTransform: "uppercase",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px", borderRadius: "10px",
  border: "1px solid #ddd", outline: "none", fontSize: "0.9rem",
  background: "#fff",
};
const sectionStyle: React.CSSProperties = {
  background: "#fff", padding: "30px", borderRadius: "16px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.05)", marginBottom: "25px",
  border: "1px solid #eee",
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.05rem", fontWeight: 800, color: "var(--primary-blue)",
  display: "flex", alignItems: "center", gap: "8px",
  margin: "0 0 20px 0",
};

const fmt = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function NuevoReciboContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Datos del recibo
  const [numero, setNumero] = useState<number | "">("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);

  // Cliente
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [filteredSedes, setFilteredSedes] = useState<any[]>([]);
  const [sedeId, setSedeId] = useState("");
  const [sedeNombre, setSedeNombre] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteApellido, setClienteApellido] = useState("");
  const [clienteEmpresa, setClienteEmpresa] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteDniCuit, setClienteDniCuit] = useState("");

  // Cobro
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState<number | "">("");
  const [formaPago, setFormaPago] = useState("efectivo");
  const [observaciones, setObservaciones] = useState("");

  // Firma
  const [nombreReceptor, setNombreReceptor] = useState("");
  const [firmaReceptor, setFirmaReceptor] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Modal nuevo cliente
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({
    nombre: "", apellido: "", email: "", empresa: "",
    dniCuit: "", telefono: "", direccion: "", cargo: "",
    sedes: [] as any[],
  });
  const [newSedeNombre, setNewSedeNombre] = useState("");
  const [newSedeDireccion, setNewSedeDireccion] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      try {
        const [userDoc, clientsSnap] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente"))),
        ]);
        const userData = userDoc.exists() ? userDoc.data() : {};
        setCurrentUser({ uid: u.uid, ...userData });
        setClientes(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        if (editId) {
          const reciboDoc = await getDoc(doc(db, "recibos", editId));
          if (reciboDoc.exists()) {
            const d = reciboDoc.data();
            setNumero(d.numero || "");
            setFecha(d.fecha || "");
            setClienteNombre(d.clienteNombre || "");
            setClienteApellido(d.clienteApellido || "");
            setClienteEmpresa(d.clienteEmpresa || "");
            setClienteEmail(d.clienteEmail || "");
            setClienteTelefono(d.clienteTelefono || "");
            setClienteDireccion(d.clienteDireccion || "");
            setClienteDniCuit(d.clienteDniCuit || "");
            setSedeId(d.sedeId || "");
            setSedeNombre(d.sedeNombre || "");
            setConcepto(d.concepto || "");
            setMonto(d.monto ?? "");
            setFormaPago(d.formaPago || "efectivo");
            setObservaciones(d.observaciones || "");
            setNombreReceptor(d.nombreReceptor || "");
            if (d.clienteId) {
              const cList = clientsSnap.docs.map(dd => ({ id: dd.id, ...dd.data() }));
              const c = cList.find((x: any) => x.id === d.clienteId);
              if (c) { setClienteSeleccionado(c); setFilteredSedes((c as any).sedes || []); }
            }
            // Restore saved signature to canvas after mount
            if (d.firmaReceptor) {
              setFirmaReceptor(d.firmaReceptor);
              setTimeout(() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const img = new Image();
                img.onload = () => canvas.getContext("2d")!.drawImage(img, 0, 0);
                img.src = d.firmaReceptor;
              }, 300);
            }
          }
        } else {
          const configSnap = await getDoc(doc(db, "configuracion", "recibos"));
          if (configSnap.exists()) {
            setNumero(configSnap.data().proximoNumero || 1);
          } else {
            const allSnap = await getDocs(collection(db, "recibos"));
            const maxN = allSnap.docs.reduce((acc, d) => Math.max(acc, d.data().numero || 0), 0);
            setNumero(maxN + 1);
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    });
    return () => unsub();
  }, [router, editId]);

  // ── Canvas helpers ──
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current || !canvasRef.current || !lastPos.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas) setFirmaReceptor(canvas.toDataURL("image/png"));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setFirmaReceptor("");
  };

  const clientesFiltrados = clientes.filter(c =>
    clienteSearch.length < 2 ? false :
      `${c.nombre || ""} ${c.apellido || ""} ${c.razonSocial || ""} ${c.empresa || ""} ${c.email || ""}`.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  const onSelectCliente = (id: string) => {
    const c = clientes.find(x => x.id === id);
    if (c) {
      setClienteSeleccionado(c);
      setClienteNombre(c.nombre || "");
      setClienteApellido(c.apellido || "");
      setClienteEmpresa(c.empresa || c.razonSocial || "");
      setClienteEmail(c.email || "");
      setClienteTelefono(c.telefono || "");
      setClienteDireccion(c.direccion || "");
      setClienteDniCuit(c.dniCuit || "");
      setFilteredSedes(c.sedes || []);
      setSedeId(""); setSedeNombre("");
      setClienteSearch("");
    }
  };

  const handleSave = async () => {
    if (!clienteNombre.trim()) { alert("El nombre del cliente es obligatorio."); return; }
    if (!concepto.trim()) { alert("El concepto del recibo es obligatorio."); return; }
    if (!monto || Number(monto) <= 0) { alert("El monto debe ser mayor a cero."); return; }
    if (!numero) { alert("El número de recibo es obligatorio."); return; }
    setSaving(true);
    try {
      const payload: any = {
        numero: Number(numero),
        fecha,
        clienteId: clienteSeleccionado?.id || null,
        clienteNombre: clienteNombre.trim(),
        clienteApellido: clienteApellido.trim(),
        clienteEmpresa: clienteEmpresa.trim(),
        clienteEmail: clienteEmail.trim(),
        clienteTelefono: clienteTelefono.trim(),
        clienteDireccion: clienteDireccion.trim(),
        clienteDniCuit: clienteDniCuit.trim(),
        sedeId: sedeId || null,
        sedeNombre,
        concepto: concepto.trim(),
        monto: Number(monto),
        formaPago,
        observaciones: observaciones.trim(),
        nombreReceptor: nombreReceptor.trim(),
        firmaReceptor,
        creadoPorId: currentUser?.uid || "",
        creadoPorNombre: currentUser?.nombre || currentUser?.email || "ARIFA",
        updatedAt: serverTimestamp(),
      };
      if (!editId) {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "recibos"), payload);
        await setDoc(doc(db, "configuracion", "recibos"), { proximoNumero: Number(numero) + 1 }, { merge: true });
      } else {
        await updateDoc(doc(db, "recibos", editId), payload);
      }
      router.push("/admin/documentos/recibos");
    } catch (e) { console.error(e); alert("Error al guardar."); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 15px 100px" }}>
      <header style={{ marginBottom: "30px" }}>
        <button
          onClick={() => router.push("/admin/documentos/recibos")}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", marginBottom: "10px", padding: 0 }}
        >
          <ArrowLeft size={18} /> Volver
        </button>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>
          {editId ? `Editando RC-${String(numero).padStart(5, "0")}` : "Nuevo Recibo"}
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>
          Completá los datos del recibo de cobro.
        </p>
      </header>

      {/* ── SECCIÓN 1: ENCABEZADO ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}><Hash size={20} /> Datos del Documento</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }} className="grid-2">
          <div>
            <label style={labelStyle}>N° RECIBO</label>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #ddd", borderRadius: "10px", overflow: "hidden", background: "#f0f7ff" }}>
              <span style={{ padding: "12px 10px 12px 14px", fontWeight: 800, color: "var(--primary-blue)", fontSize: "0.9rem", whiteSpace: "nowrap", userSelect: "none" }}>RC-</span>
              <input
                type="number"
                value={numero}
                onChange={e => setNumero(e.target.value === "" ? "" : Number(e.target.value))}
                min={1}
                style={{ ...inputStyle, border: "none", borderRadius: 0, background: "transparent", color: "var(--primary-blue)", fontWeight: 800, padding: "12px 12px 12px 0", width: "100%" }}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>FECHA</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 2: CLIENTE ── */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ ...sectionTitleStyle, margin: 0 }}><User size={20} /> Datos del Cliente</h3>
          <button
            type="button"
            onClick={() => setShowNewClientModal(true)}
            style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#fff", background: "var(--primary-blue)", border: "none", fontWeight: 800, padding: "8px 14px", borderRadius: "8px" }}
          >
            <Plus size={14} strokeWidth={3} /> NUEVO CLIENTE
          </button>
        </div>

        {/* Buscador */}
        <div style={{ position: "relative", marginBottom: "15px" }}>
          <label style={labelStyle}>BUSCAR CLIENTE REGISTRADO</label>
          <input
            style={inputStyle}
            placeholder="Escribe el nombre, empresa o email..."
            value={clienteSeleccionado
              ? `${clienteSeleccionado.nombre || ""} ${clienteSeleccionado.apellido || ""} ${clienteSeleccionado.empresa ? `(${clienteSeleccionado.empresa})` : ""}`.trim()
              : clienteSearch}
            onChange={e => {
              setClienteSearch(e.target.value);
              setClienteSeleccionado(null);
              setFilteredSedes([]);
              setSedeId(""); setSedeNombre("");
            }}
          />
          {clientesFiltrados.length > 0 && !clienteSeleccionado && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "10px", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "220px", overflowY: "auto", marginTop: "5px" }}>
              {clientesFiltrados.map(c => (
                <div
                  key={c.id}
                  onClick={() => onSelectCliente(c.id)}
                  style={{ padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8f9ff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                >
                  <div style={{ fontWeight: 700, color: "var(--primary-blue)" }}>{c.nombre || c.razonSocial || c.email} {c.apellido || ""}</div>
                  {c.empresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{c.empresa}</div>}
                </div>
              ))}
            </div>
          )}
          {clienteSeleccionado && (
            <button
              onClick={() => { setClienteSeleccionado(null); setClienteSearch(""); setFilteredSedes([]); setSedeId(""); setSedeNombre(""); }}
              style={{ position: "absolute", right: "12px", top: "34px", background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "1rem" }}
            >✕</button>
          )}
        </div>

        {/* Sede */}
        {clienteSeleccionado && filteredSedes.length > 0 && (
          <div style={{ marginBottom: "15px" }}>
            <label style={labelStyle}>SEDE / SUCURSAL (Opcional)</label>
            <select
              style={inputStyle}
              value={sedeId}
              onChange={e => {
                const s = filteredSedes.find(x => x.id === e.target.value);
                if (s) {
                  setSedeId(s.id); setSedeNombre(s.nombre);
                  setClienteDireccion(s.direccion || clienteSeleccionado.direccion || "");
                } else {
                  setSedeId(""); setSedeNombre("");
                  setClienteDireccion(clienteSeleccionado.direccion || "");
                }
              }}
            >
              <option value="">-- Sede principal (sin sede específica) --</option>
              {filteredSedes.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}{s.direccion ? ` — ${s.direccion}` : ""}</option>
              ))}
            </select>
          </div>
        )}

        {/* Campos manuales */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }} className="grid-2">
          <div>
            <label style={labelStyle}>NOMBRE *</label>
            <input value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>APELLIDO</label>
            <input value={clienteApellido} onChange={e => setClienteApellido(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>EMPRESA / RAZÓN SOCIAL</label>
            <input value={clienteEmpresa} onChange={e => setClienteEmpresa(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>DNI / CUIT</label>
            <input value={clienteDniCuit} onChange={e => setClienteDniCuit(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>TELÉFONO</label>
            <input value={clienteTelefono} onChange={e => setClienteTelefono(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>EMAIL</label>
            <input type="email" value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>DIRECCIÓN</label>
            <input value={clienteDireccion} onChange={e => setClienteDireccion(e.target.value)} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 3: COBRO ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}><DollarSign size={20} /> Datos del Cobro</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }} className="grid-2">
          <div>
            <label style={labelStyle}>MONTO RECIBIDO *</label>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #ddd", borderRadius: "10px", overflow: "hidden", background: "#fff" }}>
              <span style={{ padding: "12px 10px 12px 14px", fontWeight: 800, color: "#555", fontSize: "0.9rem", whiteSpace: "nowrap", userSelect: "none" }}>$</span>
              <input
                type="number"
                value={monto}
                onChange={e => setMonto(e.target.value === "" ? "" : Number(e.target.value))}
                min={0}
                step={0.01}
                placeholder="0.00"
                style={{ ...inputStyle, border: "none", borderRadius: 0, background: "transparent", padding: "12px 12px 12px 4px", width: "100%", fontWeight: 700, fontSize: "1rem" }}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>FORMA DE PAGO</label>
            <select
              value={formaPago}
              onChange={e => setFormaPago(e.target.value)}
              style={inputStyle}
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia bancaria</option>
              <option value="cheque">Cheque</option>
              <option value="tarjeta_credito">Tarjeta de crédito</option>
              <option value="tarjeta_debito">Tarjeta de débito</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label style={labelStyle}>CONCEPTO *</label>
          <textarea
            value={concepto}
            onChange={e => setConcepto(e.target.value)}
            placeholder="Descripción del servicio o motivo del cobro..."
            rows={3}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
        <div>
          <label style={labelStyle}>OBSERVACIONES</label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Observaciones adicionales..."
            rows={2}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
      </div>

      {/* ── SECCIÓN 4: FIRMA ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}><PenLine size={20} /> Firma del Receptor</h3>
        <div style={{ marginBottom: "15px" }}>
          <label style={labelStyle}>NOMBRE DE QUIEN RECIBE</label>
          <input
            value={nombreReceptor}
            onChange={e => setNombreReceptor(e.target.value)}
            placeholder="Nombre completo del receptor..."
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>FIRMA</label>
          <div style={{ border: "1.5px dashed #ccc", borderRadius: "12px", overflow: "hidden", background: "#fafbfc", position: "relative" }}>
            <canvas
              ref={canvasRef}
              width={780}
              height={160}
              style={{ display: "block", width: "100%", height: "160px", cursor: "crosshair", touchAction: "none" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {!firmaReceptor && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", color: "#bbb", fontSize: "0.85rem" }}>
                Dibujá la firma aquí
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={clearCanvas}
            style={{ marginTop: "8px", padding: "7px 16px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#666" }}
          >
            Limpiar firma
          </button>
        </div>
      </div>

      {/* BOTONES */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "15px" }}>
        <button
          onClick={() => router.back()}
          style={{ padding: "18px", borderRadius: "12px", border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem" }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-red"
          style={{ padding: "20px", fontSize: "1rem", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontWeight: 800, textTransform: "uppercase" }}
        >
          {saving ? "GUARDANDO..." : <><Save size={22} /> {editId ? "Actualizar Recibo" : "Emitir Recibo"}</>}
        </button>
      </div>

      {/* ── MODAL NUEVO CLIENTE ── */}
      {showNewClientModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "30px", maxWidth: "620px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>Nuevo Cliente</h2>
              <button
                onClick={() => setShowNewClientModal(false)}
                style={{ background: "#f1f5f9", border: "none", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
              >✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div>
                <label style={labelStyle}>NOMBRE *</label>
                <input value={newClientData.nombre} onChange={e => setNewClientData({ ...newClientData, nombre: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>APELLIDO</label>
                <input value={newClientData.apellido} onChange={e => setNewClientData({ ...newClientData, apellido: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelStyle}>EMPRESA / RAZÓN SOCIAL</label>
                <input value={newClientData.empresa} onChange={e => setNewClientData({ ...newClientData, empresa: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>DNI / CUIT</label>
                <input value={newClientData.dniCuit} onChange={e => setNewClientData({ ...newClientData, dniCuit: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>TELÉFONO</label>
                <input value={newClientData.telefono} onChange={e => setNewClientData({ ...newClientData, telefono: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelStyle}>EMAIL *</label>
                <input type="email" value={newClientData.email} onChange={e => setNewClientData({ ...newClientData, email: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelStyle}>DIRECCIÓN PRINCIPAL</label>
                <input value={newClientData.direccion} onChange={e => setNewClientData({ ...newClientData, direccion: e.target.value })} style={inputStyle} />
              </div>

              {/* Sedes */}
              <div style={{ gridColumn: "span 2", borderTop: "1px solid #eee", paddingTop: "20px", marginTop: "5px" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 900, color: "var(--primary-blue)", marginBottom: "15px", textTransform: "uppercase" }}>
                  Sedes / Sucursales
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                  {newClientData.sedes.map(s => (
                    <div key={s.id} style={{ background: "#f8fafc", padding: "10px 15px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{s.nombre}</div>
                        {s.direccion && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{s.direccion}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewClientData({ ...newClientData, sedes: newClientData.sedes.filter(x => x.id !== s.id) })}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}
                      ><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#f1f5f9", padding: "15px", borderRadius: "12px", display: "grid", gap: "10px" }}>
                  <input
                    value={newSedeNombre}
                    onChange={e => setNewSedeNombre(e.target.value)}
                    style={inputStyle}
                    placeholder="Nombre de la sede"
                  />
                  <input
                    value={newSedeDireccion}
                    onChange={e => setNewSedeDireccion(e.target.value)}
                    style={inputStyle}
                    placeholder="Dirección de la sede"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newSedeNombre.trim()) { alert("El nombre de la sede es obligatorio."); return; }
                      setNewClientData({
                        ...newClientData,
                        sedes: [...newClientData.sedes, { id: crypto.randomUUID(), nombre: newSedeNombre.trim(), direccion: newSedeDireccion.trim() }],
                      });
                      setNewSedeNombre(""); setNewSedeDireccion("");
                    }}
                    style={{ background: "var(--primary-blue)", color: "#fff", border: "none", padding: "10px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}
                  >
                    + Agregar Sede
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "25px" }}>
              <button
                onClick={() => setShowNewClientModal(false)}
                style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 700 }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!newClientData.nombre || !newClientData.email) { alert("Nombre y Email son obligatorios."); return; }
                  try {
                    const docRef = await addDoc(collection(db, "usuarios"), {
                      ...newClientData,
                      rol: "cliente",
                      createdAt: serverTimestamp(),
                    });
                    const created = { id: docRef.id, ...newClientData };
                    setClientes(prev => [...prev, created]);
                    onSelectCliente(docRef.id);
                    setShowNewClientModal(false);
                    setNewClientData({ nombre: "", apellido: "", email: "", empresa: "", dniCuit: "", telefono: "", direccion: "", cargo: "", sedes: [] });
                  } catch { alert("Error al crear cliente."); }
                }}
                className="btn-red"
                style={{ flex: 2, padding: "14px", borderRadius: "12px", fontWeight: 800, textTransform: "uppercase" }}
              >
                Crear y Seleccionar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 600px) {
          .grid-2 { grid-template-columns: 1fr !important; }
          .grid-2 [style*="span 2"] { grid-column: span 1 !important; }
        }
      `}</style>
    </div>
  );
}

export default function NuevoReciboPage() {
  return (
    <Suspense fallback={<div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>}>
      <NuevoReciboContent />
    </Suspense>
  );
}
