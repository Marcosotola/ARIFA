"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, addDoc, getDocs, query, where, doc,
  getDoc, serverTimestamp, updateDoc, setDoc, limit,
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Save, Plus, Trash2, User, FileText,
  Hash, Calendar, Receipt, TrendingUp, TrendingDown
} from "lucide-react";
import { Suspense } from "react";

interface EstadoCuentaItem {
  id: string;
  descripcion: string;
  monto: number | "";
  tipo: "ingreso" | "egreso";
}

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

function NuevoEstadoCuentaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Datos del documento
  const [numero, setNumero] = useState<number | "">("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [obraNombre, setObraNombre] = useState("");

  // Sede
  const [filteredSedes, setFilteredSedes] = useState<any[]>([]);
  const [sedeId, setSedeId] = useState("");
  const [sedeNombre, setSedeNombre] = useState("");

  // Cliente
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteApellido, setClienteApellido] = useState("");
  const [clienteEmpresa, setClienteEmpresa] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteDniCuit, setClienteDniCuit] = useState("");

  // Ítems
  const [items, setItems] = useState<EstadoCuentaItem[]>([
    { id: crypto.randomUUID(), descripcion: "", monto: "", tipo: "egreso" },
  ]);

  // Notas
  const [notas, setNotas] = useState("");

  // Modal nuevo cliente
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({
    nombre: "", apellido: "", email: "", empresa: "",
    dniCuit: "", telefono: "", direccion: "", cargo: "",
    sedes: [] as any[],
  });

  // Cálculos
  const totalEgresos = items.reduce((acc, it) => acc + (it.tipo === "egreso" ? Number(it.monto) || 0 : 0), 0);
  const totalIngresos = items.reduce((acc, it) => acc + (it.tipo === "ingreso" ? Number(it.monto) || 0 : 0), 0);
  const saldoActual = totalEgresos - totalIngresos;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      try {
        const [userDoc, clientsSnap] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente"))),
        ]);
        const userData = userDoc.exists() ? userDoc.data() : {};
        const r = userData.rol || "cliente";
        if (r === "cliente") { router.push("/admin/documentos/estado-cuenta"); return; }
        
        setCurrentUser({ uid: u.uid, ...userData });
        setClientes(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        if (editId) {
          const docRef = await getDoc(doc(db, "estados-cuenta", editId));
          if (docRef.exists()) {
            const d = docRef.data();
            setNumero(d.numero || "");
            setFecha(d.fecha || "");
            setObraNombre(d.obraNombre || "");
            setClienteNombre(d.clienteNombre || "");
            setClienteApellido(d.clienteApellido || "");
            setClienteEmpresa(d.clienteEmpresa || "");
            setClienteEmail(d.clienteEmail || "");
            setClienteTelefono(d.clienteTelefono || "");
            setClienteDireccion(d.clienteDireccion || "");
            setClienteDniCuit(d.clienteDniCuit || "");
            setItems(d.items?.length ? d.items : [{ id: crypto.randomUUID(), descripcion: "", monto: "", tipo: "egreso" }]);
            setNotas(d.notas || "");
            if (d.clienteId) {
              const cList = clientsSnap.docs.map(dd => ({ id: dd.id, ...dd.data() }));
              const c = cList.find((x: any) => x.id === d.clienteId);
              if (c) { 
                setClienteSeleccionado(c); 
                setFilteredSedes((c as any).sedes || []);
              }
            }
            if (d.sedeId) { setSedeId(d.sedeId); setSedeNombre(d.sedeNombre || ""); }
          }
        } else {
          // Auto-número
          const configSnap = await getDoc(doc(db, "configuracion", "estados-cuenta"));
          if (configSnap.exists()) {
            setNumero(configSnap.data().proximoNumero || 1);
          } else {
            // Auto-número fallback: solo si es staff
            try {
              const allSnap = await getDocs(query(collection(db, "estados-cuenta"), limit(1)));
              if (allSnap.empty) {
                setNumero(1);
              } else {
                // Si no hay configuración, intentamos buscar el máximo, pero mejor sugerir 1 o dejar que el usuario complete
                setNumero(1);
              }
            } catch {
              setNumero(1);
            }
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    });
    return () => unsub();
  }, [router, editId]);

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

  const onSelectSede = (sid: string) => {
    if (!sid) {
      setSedeId(""); setSedeNombre("");
      return;
    }
    const s = filteredSedes.find(x => x.id === sid);
    if (s) {
      setSedeId(sid);
      setSedeNombre(s.nombre);
      setClienteDireccion(s.direccion || clienteDireccion);
      // Sugerir nombre de obra basado en sede
      if (!obraNombre || obraNombre.includes("Obra:")) {
        setObraNombre(`Obra: ${s.nombre}`);
      }
    }
  };

  const updateItem = (idx: number, field: keyof EstadoCuentaItem, value: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    setItems(next);
  };

  const agregarItem = () => {
    setItems([...items, { id: crypto.randomUUID(), descripcion: "", monto: "", tipo: "egreso" }]);
  };

  const eliminarItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!clienteNombre.trim()) { alert("El nombre del cliente es obligatorio."); return; }
    if (items.some(it => !it.descripcion.trim() || !it.monto)) { alert("Todos los renglones deben tener una descripción y monto."); return; }
    if (!numero) { alert("El número de documento es obligatorio."); return; }
    setSaving(true);
    try {
      const payload: any = {
        numero: Number(numero),
        fecha,
        obraNombre: obraNombre.trim(),
        clienteId: clienteSeleccionado?.id || null,
        clienteNombre: clienteNombre.trim(),
        clienteApellido: clienteApellido.trim(),
        clienteEmpresa: clienteEmpresa.trim(),
        clienteEmail: clienteEmail.trim(),
        clienteTelefono: clienteTelefono.trim(),
        clienteDireccion: clienteDireccion.trim(),
        clienteDniCuit: clienteDniCuit.trim(),
        sedeId: sedeId || null,
        sedeNombre: sedeNombre,
        items: items.map(it => ({ ...it, monto: Number(it.monto) })),
        totalEgresos,
        totalIngresos,
        saldoActual,
        notas,
        creadoPorId: currentUser?.uid || "",
        creadoPorNombre: currentUser?.nombre || currentUser?.email || "ARIFA",
        updatedAt: serverTimestamp(),
      };
      if (!editId) {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "estados-cuenta"), payload);
        await setDoc(doc(db, "configuracion", "estados-cuenta"), { proximoNumero: Number(numero) + 1 }, { merge: true });
      } else {
        await updateDoc(doc(db, "estados-cuenta", editId), payload);
      }
      router.push("/admin/documentos/estado-cuenta");
    } catch (e) { console.error(e); alert("Error al guardar."); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 15px 100px" }}>
      <header style={{ marginBottom: "30px" }}>
        <button
          onClick={() => router.push("/admin/documentos/estado-cuenta")}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", marginBottom: "10px", padding: 0 }}
        >
          <ArrowLeft size={18} /> Volver
        </button>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>
          {editId ? `Editando EC-${String(numero).padStart(5, "0")}` : "Nuevo Estado de Cuenta"}
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>
          Gestión de seguimiento de costos de obra.
        </p>
      </header>

      {/* ── SECCIÓN 1: ENCABEZADO ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}><Hash size={20} /> Datos del Documento</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }} className="grid-responsive">
          <div>
            <label style={labelStyle}>N° ESTADO DE CUENTA</label>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #ddd", borderRadius: "10px", overflow: "hidden", background: "#f0f7ff" }}>
              <span style={{ padding: "12px 10px 12px 14px", fontWeight: 800, color: "var(--primary-blue)", fontSize: "0.9rem", whiteSpace: "nowrap", userSelect: "none" }}>EC-</span>
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
          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>NOMBRE DE LA OBRA / REFERENCIA</label>
            <input
              value={obraNombre}
              onChange={e => setObraNombre(e.target.value)}
              placeholder="Ej: Seguimiento de obra calle Rivadavia 123"
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
              onClick={() => { setClienteSeleccionado(null); setClienteSearch(""); }}
              style={{ position: "absolute", right: "12px", top: "34px", background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "1rem" }}
            >✕</button>
          )}
        </div>

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

          {/* Selector de Sede */}
          {filteredSedes.length > 0 && (
            <div style={{ gridColumn: "span 2", marginTop: "10px", padding: "15px", background: "#f8f9fc", borderRadius: "10px", border: "1px solid #eef0f7" }}>
              <label style={labelStyle}>SELECCIONAR SEDE / SUCURSAL</label>
              <select
                value={sedeId}
                onChange={e => onSelectSede(e.target.value)}
                style={inputStyle}
              >
                <option value="">-- Seleccionar Sede (Opcional) --</option>
                {filteredSedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre} - {s.direccion}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── SECCIÓN 3: ÍTEMS ── */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ ...sectionTitleStyle, margin: 0 }}><FileText size={20} /> Movimientos</h3>
          <button
            onClick={agregarItem}
            className="btn-blue"
            style={{ padding: "10px 18px", borderRadius: "10px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Plus size={18} strokeWidth={3} /> Agregar Item
          </button>
        </div>

        {/* Cabecera */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 130px 36px", gap: "8px", marginBottom: "8px", padding: "0 4px" }}>
          {["Descripción", "Tipo", "Monto", ""].map(h => (
            <div key={h} style={{ fontSize: "0.68rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase" }}>{h}</div>
          ))}
        </div>

        {items.map((item, idx) => (
          <div
            key={item.id}
            style={{ display: "grid", gridTemplateColumns: "1fr 140px 130px 36px", gap: "8px", marginBottom: "12px", alignItems: "center" }}
          >
            <input
              placeholder="Ej: Monto inicial de obra, Adelanto, etc..."
              value={item.descripcion}
              onChange={e => updateItem(idx, "descripcion", e.target.value)}
              style={{ ...inputStyle, padding: "10px" }}
            />
            <select
              value={item.tipo}
              onChange={e => updateItem(idx, "tipo", e.target.value as any)}
              style={{ ...inputStyle, padding: "10px", fontWeight: 700, color: item.tipo === "egreso" ? "#ef4444" : "#16a34a" }}
            >
              <option value="egreso">DEUDA (Egreso)</option>
              <option value="ingreso">PAGO (Ingreso)</option>
            </select>
            <input
              type="number"
              value={item.monto}
              onChange={e => updateItem(idx, "monto", e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
              step={0.01}
              style={{ ...inputStyle, padding: "10px", textAlign: "right", fontWeight: 700 }}
              placeholder="0.00"
            />
            <button
              onClick={() => eliminarItem(idx)}
              disabled={items.length === 1}
              style={{ width: "36px", height: "36px", borderRadius: "8px", background: items.length === 1 ? "#f8f9fc" : "#fef2f2", color: items.length === 1 ? "#ccc" : "#ef4444", border: "none", cursor: items.length === 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        {/* Resumen de movimientos */}
        <div style={{ marginTop: "25px", borderTop: "2px solid #f0f0f0", paddingTop: "20px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "40px" }}>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#999", textTransform: "uppercase" }}>Total Deudas</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ef4444" }}>$ {fmt(totalEgresos)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#999", textTransform: "uppercase" }}>Total Pagos</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#16a34a" }}>$ {fmt(totalIngresos)}</div>
                </div>
            </div>
        </div>
      </div>

      {/* ── SECCIÓN 4: SALDO FINAL ── */}
      <div style={{ ...sectionStyle, background: saldoActual > 0 ? "#fff5f5" : "#f5fff7" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ ...sectionTitleStyle, color: saldoActual > 0 ? "#c53030" : "#2f855a", marginBottom: "5px" }}>
              {saldoActual > 0 ? <TrendingDown size={24} /> : <TrendingUp size={24} />} 
              SALDO PENDIENTE
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: saldoActual > 0 ? "#9b2c2c" : "#276749" }}>
              {saldoActual > 0 ? "Monto que el cliente adeuda actualmente." : "El cliente no posee deudas o tiene saldo a favor."}
            </p>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: saldoActual > 0 ? "#c53030" : "#2f855a" }}>
            $ {fmt(Math.abs(saldoActual))}
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 5: NOTAS ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}><FileText size={20} /> Observaciones</h3>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Observaciones adicionales, detalles de pago, aclaraciones sobre la obra..."
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
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
          {saving ? "GUARDANDO..." : <><Save size={22} /> {editId ? "Actualizar Estado" : "Guardar Estado de Cuenta"}</>}
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
          .grid-responsive { grid-template-columns: 1fr !important; }
          .grid-2 { grid-template-columns: 1fr !important; }
          .grid-2 [style*="span 2"] { grid-column: span 1 !important; }
        }
      `}</style>
    </div>
  );
}

export default function NuevoEstadoCuentaPage() {
  return (
    <Suspense fallback={<div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>}>
      <NuevoEstadoCuentaContent />
    </Suspense>
  );
}
