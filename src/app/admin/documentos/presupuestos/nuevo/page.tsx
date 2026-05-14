"use client";
import { useEffect, useState } from "react";
import { useToast, Toast } from "@/components/Toast";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, addDoc, getDocs, query, where, doc,
  getDoc, serverTimestamp, updateDoc, setDoc,
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Save, Plus, Trash2, User, FileText,
  Hash, Calendar, Receipt, Search, ClipboardList,
  Package,
} from "lucide-react";
import { Suspense } from "react";
import { fetchAllProductos } from "@/lib/productos";

interface PresupuestoItem {
  id: string;
  cantidad: number | "";
  descripcion: string;
  precioUnitario: number | "";
  subtotal: number;
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

function NuevoPresupuestoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast, showToast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Datos del presupuesto
  const [numero, setNumero] = useState<number | "">("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [validezDias, setValidezDias] = useState(15);

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

  // Ítems
  const [items, setItems] = useState<PresupuestoItem[]>([
    { id: crypto.randomUUID(), cantidad: "", descripcion: "", precioUnitario: "", subtotal: 0 },
  ]);

  // Descuento
  const [descuentoTipo, setDescuentoTipo] = useState<"porcentaje" | "monto">("porcentaje");
  const [descuentoValor, setDescuentoValor] = useState<number | "">("");

  // Impuesto
  const [impuestoTipo, setImpuestoTipo] = useState<"porcentaje" | "monto">("porcentaje");
  const [impuestoValor, setImpuestoValor] = useState<number | "">("");

  // Notas
  const [notas, setNotas] = useState("");

  // Catálogo y Plan de Acción
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [showCatalogoModal, setShowCatalogoModal] = useState(false);
  const [catalogoSearch, setCatalogoSearch] = useState("");
  
  const [planAccion, setPlanAccion] = useState<any[]>([]);
  const [showPlanAccionModal, setShowPlanAccionModal] = useState(false);

  // Modal nuevo cliente
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({
    nombre: "", apellido: "", email: "", empresa: "",
    dniCuit: "", telefono: "", direccion: "", cargo: "",
    sedes: [] as any[],
  });
  const [newSedeNombre, setNewSedeNombre] = useState("");
  const [newSedeDireccion, setNewSedeDireccion] = useState("");

  // Cálculos
  const subtotal = items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  const descVal = Number(descuentoValor) || 0;
  const descuentoMonto = descuentoTipo === "porcentaje"
    ? (subtotal * descVal) / 100
    : descVal;
  const baseConDescuento = subtotal - descuentoMonto;
  const impVal = Number(impuestoValor) || 0;
  const impuestoMonto = impuestoTipo === "porcentaje"
    ? (baseConDescuento * impVal) / 100
    : impVal;
  const total = baseConDescuento + impuestoMonto;

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
          const presDoc = await getDoc(doc(db, "presupuestos", editId));
          if (presDoc.exists()) {
            const d = presDoc.data();
            setNumero(d.numero || "");
            setFecha(d.fecha || "");
            setValidezDias(d.validezDias || 15);
            setClienteNombre(d.clienteNombre || "");
            setClienteApellido(d.clienteApellido || "");
            setClienteEmpresa(d.clienteEmpresa || "");
            setClienteEmail(d.clienteEmail || "");
            setClienteTelefono(d.clienteTelefono || "");
            setClienteDireccion(d.clienteDireccion || "");
            setClienteDniCuit(d.clienteDniCuit || "");
            setSedeId(d.sedeId || "");
            setSedeNombre(d.sedeNombre || "");
            setItems(d.items?.length ? d.items : [{ id: crypto.randomUUID(), cantidad: 1, descripcion: "", precioUnitario: 0, subtotal: 0 }]);
            setDescuentoTipo(d.descuentoTipo || "porcentaje");
            setDescuentoValor(d.descuentoValor ?? 0);
            setImpuestoTipo(d.impuestoTipo || "porcentaje");
            setImpuestoValor(d.impuestoValor ?? 0);
            setNotas(d.notas || "");
            if (d.clienteId) {
              const cList = clientsSnap.docs.map(dd => ({ id: dd.id, ...dd.data() }));
              const c = cList.find((x: any) => x.id === d.clienteId);
              if (c) { setClienteSeleccionado(c); setFilteredSedes((c as any).sedes || []); }
            }
          }
        } else {
          // Auto-número
          const configSnap = await getDoc(doc(db, "configuracion", "presupuestos"));
          if (configSnap.exists()) {
            setNumero(configSnap.data().proximoNumero || 1);
          } else {
            const allSnap = await getDocs(collection(db, "presupuestos"));
            const maxN = allSnap.docs.reduce((acc, d) => Math.max(acc, d.data().numero || 0), 0);
            setNumero(maxN + 1);
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    });

    // Cargar Catálogo
    fetchAllProductos().then(setCatalogo).catch(console.error);

    return () => unsub();
  }, [router, editId]);

  // Cargar Plan de Acción cuando cambia el cliente
  useEffect(() => {
    if (clienteSeleccionado) {
      const qPlan = query(
        collection(db, "plan_accion"), 
        where("clienteId", "==", clienteSeleccionado.id),
        where("realizado", "==", false)
      );
      getDocs(qPlan).then(snap => {
        setPlanAccion(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }).catch(console.error);
    } else {
      setPlanAccion([]);
    }
  }, [clienteSeleccionado]);

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

  const updateItem = (idx: number, field: keyof PresupuestoItem, value: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    if (field === "cantidad" || field === "precioUnitario") {
      const cant = field === "cantidad" ? Number(value) : Number(next[idx].cantidad);
      const pu = field === "precioUnitario" ? Number(value) : Number(next[idx].precioUnitario);
      next[idx].subtotal = cant * pu;
    }
    setItems(next);
  };

  const agregarItem = () => {
    setItems([...items, { id: crypto.randomUUID(), cantidad: "", descripcion: "", precioUnitario: "", subtotal: 0 }]);
  };

  const eliminarItem = (idx: number) => {
    if (items.length === 1) {
      setItems([{ id: crypto.randomUUID(), cantidad: "", descripcion: "", precioUnitario: "", subtotal: 0 }]);
      return;
    }
    setItems(items.filter((_, i) => i !== idx));
  };

  const agregarDesdeCatalogo = (p: any) => {
    const newItem: PresupuestoItem = {
      id: crypto.randomUUID(),
      cantidad: 1,
      descripcion: p.nombre,
      precioUnitario: p.precio || 0,
      subtotal: p.precio || 0,
    };
    // Si el único item está vacío, reemplazarlo
    if (items.length === 1 && !items[0].descripcion && !items[0].cantidad) {
      setItems([newItem]);
    } else {
      setItems([...items, newItem]);
    }
    setShowCatalogoModal(false);
  };

  const agregarDesdePlan = (p: any) => {
    const newItem: PresupuestoItem = {
      id: crypto.randomUUID(),
      cantidad: 1,
      descripcion: p.detalle,
      precioUnitario: p.costo || 0,
      subtotal: p.costo || 0,
    };
    // Si el único item está vacío, reemplazarlo
    if (items.length === 1 && !items[0].descripcion && !items[0].cantidad) {
      setItems([newItem]);
    } else {
      setItems([...items, newItem]);
    }
    setShowPlanAccionModal(false);
  };

  const handleSave = async () => {
    if (!clienteNombre.trim()) { showToast("El nombre del cliente es obligatorio.", "error"); return; }
    if (items.some(it => !it.descripcion.trim())) { showToast("Todos los renglones deben tener una descripción.", "error"); return; }
    if (!numero) { showToast("El número de presupuesto es obligatorio.", "error"); return; }
    setSaving(true);
    try {
      const payload: any = {
        numero: Number(numero),
        fecha,
        validezDias: Number(validezDias),
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
        items,
        subtotal,
        descuentoTipo,
        descuentoValor: Number(descuentoValor) || 0,
        descuentoMonto,
        impuestoTipo,
        impuestoValor: Number(impuestoValor) || 0,
        impuestoMonto,
        total,
        notas,
        estado: editId ? undefined : "pendiente",
        creadoPorId: currentUser?.uid || "",
        creadoPorNombre: currentUser?.nombre || currentUser?.email || "ARIFA",
        updatedAt: serverTimestamp(),
      };
      if (!editId) {
        payload.estado = "pendiente";
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "presupuestos"), payload);
        // Actualizar contador
        await setDoc(doc(db, "configuracion", "presupuestos"), { proximoNumero: Number(numero) + 1 }, { merge: true });
      } else {
        delete payload.estado;
        await updateDoc(doc(db, "presupuestos", editId), payload);
      }
      showToast("Presupuesto guardado correctamente", "success");
      setTimeout(() => router.push("/admin/documentos/presupuestos"), 1200);
    } catch (e) { console.error(e); showToast("Error al guardar. Intentá de nuevo.", "error"); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 15px 100px" }}>
      <header style={{ marginBottom: "30px" }}>
        <button
          onClick={() => router.push("/admin/documentos/presupuestos")}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", marginBottom: "10px", padding: 0 }}
        >
          <ArrowLeft size={18} /> Volver
        </button>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>
          {editId ? `Editando P-${String(numero).padStart(5, "0")}` : "Nuevo Presupuesto"}
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>
          Completá los datos del presupuesto.
        </p>
      </header>

      {/* ── SECCIÓN 1: ENCABEZADO ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}><Hash size={20} /> Datos del Documento</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px" }} className="grid-responsive">
          <div>
            <label style={labelStyle}>N° PRESUPUESTO</label>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #ddd", borderRadius: "10px", overflow: "hidden", background: "#f0f7ff" }}>
              <span style={{ padding: "12px 10px 12px 14px", fontWeight: 800, color: "var(--primary-blue)", fontSize: "0.9rem", whiteSpace: "nowrap", userSelect: "none" }}>P-</span>
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
          <div>
            <label style={labelStyle}>VALIDEZ (DÍAS)</label>
            <input
              type="number"
              value={validezDias}
              onChange={e => setValidezDias(Number(e.target.value))}
              style={inputStyle}
              min={1}
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

      {/* ── SECCIÓN 3: ÍTEMS ── */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ ...sectionTitleStyle, margin: 0 }}><FileText size={20} /> Detalle de Servicios / Productos</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setShowCatalogoModal(true)}
              style={{ padding: "8px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", background: "#f0f7ff", color: "var(--primary-blue)", border: "1px solid #cce3ff", fontSize: "0.8rem" }}
            >
              <Package size={16} /> Catálogo
            </button>
            <button
              onClick={() => {
                if (!clienteSeleccionado) { showToast("Seleccioná un cliente para ver su Plan de Acción.", "error"); return; }
                setShowPlanAccionModal(true);
              }}
              style={{ padding: "8px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", background: "#fff9f0", color: "#92400e", border: "1px solid #fef3c7", fontSize: "0.8rem" }}
            >
              <ClipboardList size={16} /> Plan Acción
            </button>
            <button
              onClick={agregarItem}
              className="btn-blue"
              style={{ padding: "8px 14px", borderRadius: "10px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }}
            >
              <Plus size={16} strokeWidth={3} /> Item
            </button>
          </div>
        </div>

        {/* Cabecera */}
        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 130px 120px 36px", gap: "8px", marginBottom: "8px", padding: "0 4px" }}>
          {["Cant.", "Descripción", "P. Unitario", "Subtotal", ""].map(h => (
            <div key={h} style={{ fontSize: "0.68rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase" }}>{h}</div>
          ))}
        </div>

        {items.map((item, idx) => (
          <div
            key={item.id}
            style={{ display: "grid", gridTemplateColumns: "70px 1fr 130px 120px 36px", gap: "8px", marginBottom: "8px", alignItems: "center" }}
          >
            <input
              type="number"
              value={item.cantidad}
              onChange={e => updateItem(idx, "cantidad", e.target.value === "" ? "" : Number(e.target.value))}
              min={1}
              style={{ ...inputStyle, padding: "10px", textAlign: "center" }}
            />
            <input
              placeholder="Descripción del servicio o producto..."
              value={item.descripcion}
              onChange={e => updateItem(idx, "descripcion", e.target.value)}
              style={{ ...inputStyle, padding: "10px" }}
            />
            <input
              type="number"
              value={item.precioUnitario}
              onChange={e => updateItem(idx, "precioUnitario", e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
              step={0.01}
              style={{ ...inputStyle, padding: "10px", textAlign: "right" }}
              placeholder="0.00"
            />
            <div style={{ ...inputStyle, padding: "10px", background: "#f8f9fc", fontWeight: 700, fontSize: "0.9rem", textAlign: "right", color: "var(--primary-blue)" }}>
              $ {fmt(item.subtotal)}
            </div>
            <button
              onClick={() => eliminarItem(idx)}
              disabled={items.length === 1}
              style={{ width: "36px", height: "36px", borderRadius: "8px", background: items.length === 1 ? "#f8f9fc" : "#fef2f2", color: items.length === 1 ? "#ccc" : "#ef4444", border: "none", cursor: items.length === 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* ── SECCIÓN 4: TOTALES ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}><Receipt size={20} /> Totales</h3>

        <div style={{ display: "flex", gap: "30px", flexWrap: "wrap" }}>
          {/* Descuento */}
          <div style={{ flex: 1, minWidth: "260px" }}>
            <label style={labelStyle}>DESCUENTO</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <select
                value={descuentoTipo}
                onChange={e => setDescuentoTipo(e.target.value as any)}
                style={{ ...inputStyle, width: "100px", flexShrink: 0 }}
              >
                <option value="porcentaje">%</option>
                <option value="monto">$ Monto</option>
              </select>
              <input
                type="number"
                value={descuentoValor}
                onChange={e => setDescuentoValor(e.target.value === "" ? "" : Number(e.target.value))}
                min={0}
                step={0.01}
                style={inputStyle}
                placeholder="0"
              />
            </div>
          </div>

          {/* Impuesto */}
          <div style={{ flex: 1, minWidth: "260px" }}>
            <label style={labelStyle}>IMPUESTO / IVA</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <select
                value={impuestoTipo}
                onChange={e => setImpuestoTipo(e.target.value as any)}
                style={{ ...inputStyle, width: "100px", flexShrink: 0 }}
              >
                <option value="porcentaje">%</option>
                <option value="monto">$ Monto</option>
              </select>
              <input
                type="number"
                value={impuestoValor}
                onChange={e => setImpuestoValor(e.target.value === "" ? "" : Number(e.target.value))}
                min={0}
                step={0.01}
                style={inputStyle}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div style={{ marginTop: "25px", background: "#f8f9fc", borderRadius: "12px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ minWidth: "280px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee", fontSize: "0.9rem" }}>
                <span style={{ color: "#666" }}>Subtotal</span>
                <span style={{ fontWeight: 700 }}>$ {fmt(subtotal)}</span>
              </div>
              {descuentoMonto > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee", fontSize: "0.9rem", color: "#dc2626" }}>
                  <span>Descuento {descuentoTipo === "porcentaje" ? `(${descuentoValor}%)` : ""}</span>
                  <span style={{ fontWeight: 700 }}>- $ {fmt(descuentoMonto)}</span>
                </div>
              )}
              {impuestoMonto > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee", fontSize: "0.9rem", color: "#16a34a" }}>
                  <span>Impuesto {impuestoTipo === "porcentaje" ? `(${impuestoValor}%)` : ""}</span>
                  <span style={{ fontWeight: 700 }}>+ $ {fmt(impuestoMonto)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", fontSize: "1.15rem" }}>
                <span style={{ fontWeight: 900, color: "var(--primary-blue)" }}>TOTAL</span>
                <span style={{ fontWeight: 900, color: "var(--primary-red)", fontSize: "1.2rem" }}>$ {fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 5: NOTAS ── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}><FileText size={20} /> Notas / Condiciones</h3>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Condiciones de pago, observaciones adicionales, información relevante..."
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
          {saving ? "GUARDANDO..." : <><Save size={22} /> {editId ? "Actualizar Presupuesto" : "Crear Presupuesto"}</>}
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
                      if (!newSedeNombre.trim()) { showToast("El nombre de la sede es obligatorio.", "error"); return; }
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
                  if (!newClientData.nombre || !newClientData.email) { showToast("Nombre y Email son obligatorios.", "error"); return; }
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
                  } catch { showToast("Error al crear cliente. Intentá de nuevo.", "error"); }
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
      {/* ── MODAL CATÁLOGO ── */}
      {showCatalogoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "30px", maxWidth: "600px", width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>Catálogo de Productos</h2>
              <button
                onClick={() => setShowCatalogoModal(false)}
                style={{ background: "#f1f5f9", border: "none", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
              >✕</button>
            </div>
            <div style={{ position: "relative", marginBottom: "20px" }}>
              <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#999" }} />
              <input
                style={{ ...inputStyle, paddingLeft: "40px" }}
                placeholder="Buscar producto en el catálogo..."
                value={catalogoSearch}
                onChange={e => setCatalogoSearch(e.target.value)}
              />
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              {catalogo
                .filter(p => p.nombre.toLowerCase().includes(catalogoSearch.toLowerCase()))
                .map(p => (
                  <div
                    key={p.id}
                    onClick={() => agregarDesdeCatalogo(p)}
                    style={{ padding: "15px", border: "1px solid #eee", borderRadius: "12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8f9ff")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--primary-blue)" }}>{p.nombre}</div>
                      <div style={{ fontSize: "0.75rem", color: "#888" }}>{p.categoriaId}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: "var(--primary-red)" }}>$ {fmt(p.precio || 0)}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PLAN DE ACCIÓN ── */}
      {showPlanAccionModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "30px", maxWidth: "600px", width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>Plan de Acción</h2>
                <p style={{ fontSize: "0.85rem", color: "#666" }}>Items pendientes para {clienteNombre}</p>
              </div>
              <button
                onClick={() => setShowPlanAccionModal(false)}
                style={{ background: "#f1f5f9", border: "none", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
              >✕</button>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              {planAccion.length === 0 ? (
                <p style={{ textAlign: "center", color: "#999", padding: "20px" }}>No hay mejoras pendientes para este cliente.</p>
              ) : (
                planAccion.map(p => (
                  <div
                    key={p.id}
                    onClick={() => agregarDesdePlan(p)}
                    style={{ padding: "15px", border: "1px solid #eee", borderRadius: "12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "15px" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fffbeb")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.7rem", color: "#999", fontWeight: 800 }}>{p.fecha} • {p.prioridad}</div>
                      <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.9rem" }}>{p.detalle}</div>
                      {p.sedeNombre && <div style={{ fontSize: "0.7rem", color: "#888" }}>📍 {p.sedeNombre}</div>}
                    </div>
                    <div style={{ fontWeight: 800, color: "#16a34a", whiteSpace: "nowrap" }}>$ {fmt(p.costo || 0)}</div>
                  </div>
                ))
              )}
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
      <Toast {...toast} />
    </div>
  );
}

export default function NuevoPresupuestoPage() {
  return (
    <Suspense fallback={<div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>}>
      <NuevoPresupuestoContent />
    </Suspense>
  );
}
