"use client";
import { useEffect, useState, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, query, where, doc, getDoc, serverTimestamp, updateDoc, setDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, Plus, Trash2, User, Package, Hash, Calendar, PenLine } from "lucide-react";
import { Suspense } from "react";

const lbl: React.CSSProperties = { display: "block", fontSize: "0.7rem", fontWeight: 800, color: "#999", marginBottom: "5px", textTransform: "uppercase" };
const inp: React.CSSProperties = { width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", outline: "none", fontSize: "0.9rem", background: "#fff" };
const sec: React.CSSProperties = { background: "#fff", padding: "30px", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", marginBottom: "25px", border: "1px solid #eee" };
const secTitle: React.CSSProperties = { fontSize: "1.05rem", fontWeight: 800, color: "var(--primary-blue)", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 20px 0" };

function NuevoRemitoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [numero, setNumero] = useState<number | "">("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
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
  const [descripcionGeneral, setDescripcionGeneral] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<{ id: string; cantidad: number; descripcion: string }[]>([{ id: crypto.randomUUID(), cantidad: 1, descripcion: "" }]);
  const [nombreReceptor, setNombreReceptor] = useState("");
  const [firmaReceptor, setFirmaReceptor] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

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
          const snap = await getDoc(doc(db, "remitos_doc", editId));
          if (snap.exists()) {
            const d = snap.data();
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
            setDescripcionGeneral(d.descripcionGeneral || "");
            setObservaciones(d.observaciones || "");
            setNombreReceptor(d.nombreReceptor || "");
            if (d.items?.length) setItems(d.items.map((it: any) => ({ ...it, id: it.id || crypto.randomUUID() })));
            if (d.clienteId) {
              const cList = clientsSnap.docs.map(dd => ({ id: dd.id, ...dd.data() }));
              const c = cList.find((x: any) => x.id === d.clienteId);
              if (c) { setClienteSeleccionado(c); setFilteredSedes((c as any).sedes || []); }
            }
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
          const configSnap = await getDoc(doc(db, "configuracion", "remitos_doc"));
          if (configSnap.exists()) {
            setNumero(configSnap.data().proximoNumero || 1);
          } else {
            const allSnap = await getDocs(collection(db, "remitos_doc"));
            const maxN = allSnap.docs.reduce((acc, d) => Math.max(acc, d.data().numero || 0), 0);
            setNumero(maxN + 1);
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    });
    return () => unsub();
  }, [router, editId]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); isDrawing.current = true; const c = canvasRef.current; if (c) lastPos.current = getPos(e, c); };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current || !canvasRef.current || !lastPos.current) return;
    const canvas = canvasRef.current; const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    lastPos.current = pos;
  };
  const stopDraw = () => { if (!isDrawing.current) return; isDrawing.current = false; lastPos.current = null; const c = canvasRef.current; if (c) setFirmaReceptor(c.toDataURL("image/png")); };
  const clearCanvas = () => { const c = canvasRef.current; if (c) { c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setFirmaReceptor(""); } };

  const clientesFiltrados = clientes.filter(c =>
    clienteSearch.length < 2 ? false :
      `${c.nombre || ""} ${c.apellido || ""} ${c.razonSocial || ""} ${c.empresa || ""} ${c.email || ""}`.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  const onSelectCliente = (id: string) => {
    const c = clientes.find(x => x.id === id);
    if (c) {
      setClienteSeleccionado(c);
      setClienteNombre(c.nombre || ""); setClienteApellido(c.apellido || "");
      setClienteEmpresa(c.empresa || c.razonSocial || ""); setClienteEmail(c.email || "");
      setClienteTelefono(c.telefono || ""); setClienteDireccion(c.direccion || "");
      setClienteDniCuit(c.dniCuit || ""); setFilteredSedes(c.sedes || []);
      setSedeId(""); setSedeNombre(""); setClienteSearch("");
    }
  };

  const updateItem = (id: string, field: string, value: any) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  const addItem = () => setItems(prev => [...prev, { id: crypto.randomUUID(), cantidad: 1, descripcion: "" }]);
  const removeItem = (id: string) => setItems(prev => prev.filter(it => it.id !== id));

  const handleSave = async () => {
    if (!clienteNombre.trim()) { alert("El nombre del cliente es obligatorio."); return; }
    if (!numero) { alert("El número de remito es obligatorio."); return; }
    if (items.some(it => !it.descripcion.trim())) { alert("Todos los ítems deben tener descripción."); return; }
    setSaving(true);
    try {
      const payload: any = {
        numero: Number(numero), fecha,
        clienteId: clienteSeleccionado?.id || null,
        clienteNombre: clienteNombre.trim(), clienteApellido: clienteApellido.trim(),
        clienteEmpresa: clienteEmpresa.trim(), clienteEmail: clienteEmail.trim(),
        clienteTelefono: clienteTelefono.trim(), clienteDireccion: clienteDireccion.trim(),
        clienteDniCuit: clienteDniCuit.trim(), sedeId: sedeId || null, sedeNombre,
        descripcionGeneral: descripcionGeneral.trim(), observaciones: observaciones.trim(),
        items: items.map(it => ({ id: it.id, cantidad: Number(it.cantidad), descripcion: it.descripcion.trim() })),
        nombreReceptor: nombreReceptor.trim(), firmaReceptor,
        creadoPorId: currentUser?.uid || "", creadoPorNombre: currentUser?.nombre || currentUser?.email || "ARIFA",
        updatedAt: serverTimestamp(),
      };
      if (!editId) {
        payload.estado = "pendiente"; payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "remitos_doc"), payload);
        await setDoc(doc(db, "configuracion", "remitos_doc"), { proximoNumero: Number(numero) + 1 }, { merge: true });
      } else {
        await updateDoc(doc(db, "remitos_doc", editId), payload);
      }
      router.push("/admin/documentos/remitos");
    } catch (e) { console.error(e); alert("Error al guardar."); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 15px 100px" }}>
      <header style={{ marginBottom: "30px" }}>
        <button onClick={() => router.push("/admin/documentos/remitos")} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", marginBottom: "10px", padding: 0 }}>
          <ArrowLeft size={18} /> Volver
        </button>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>
          {editId ? `Editando RM-${String(numero).padStart(5, "0")}` : "Nuevo Remito"}
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Completá los datos del remito de entrega de materiales.</p>
      </header>

      {/* Sección 1: Encabezado */}
      <div style={sec}>
        <h3 style={secTitle}><Hash size={20} /> Datos del Documento</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }} className="grid-2">
          <div>
            <label style={lbl}>N° REMITO</label>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #ddd", borderRadius: "10px", overflow: "hidden", background: "#f0f7ff" }}>
              <span style={{ padding: "12px 10px 12px 14px", fontWeight: 800, color: "var(--primary-blue)", fontSize: "0.9rem", whiteSpace: "nowrap" }}>RM-</span>
              <input type="number" value={numero} onChange={e => setNumero(e.target.value === "" ? "" : Number(e.target.value))} min={1} style={{ ...inp, border: "none", borderRadius: 0, background: "transparent", color: "var(--primary-blue)", fontWeight: 800, padding: "12px 12px 12px 0", width: "100%" }} />
            </div>
          </div>
          <div>
            <label style={lbl}>FECHA</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
          </div>
        </div>
      </div>

      {/* Sección 2: Cliente */}
      <div style={sec}>
        <h3 style={secTitle}><User size={20} /> Datos del Cliente</h3>
        <div style={{ position: "relative", marginBottom: "15px" }}>
          <label style={lbl}>BUSCAR CLIENTE REGISTRADO</label>
          <input style={inp} placeholder="Escribe el nombre, empresa o email..."
            value={clienteSeleccionado ? `${clienteSeleccionado.nombre || ""} ${clienteSeleccionado.apellido || ""} ${clienteSeleccionado.empresa ? `(${clienteSeleccionado.empresa})` : ""}`.trim() : clienteSearch}
            onChange={e => { setClienteSearch(e.target.value); setClienteSeleccionado(null); setFilteredSedes([]); setSedeId(""); setSedeNombre(""); }}
          />
          {clientesFiltrados.length > 0 && !clienteSeleccionado && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "10px", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "220px", overflowY: "auto", marginTop: "5px" }}>
              {clientesFiltrados.map(c => (
                <div key={c.id} onClick={() => onSelectCliente(c.id)} style={{ padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8f9ff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                  <div style={{ fontWeight: 700, color: "var(--primary-blue)" }}>{c.nombre || c.razonSocial || c.email} {c.apellido || ""}</div>
                  {c.empresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{c.empresa}</div>}
                </div>
              ))}
            </div>
          )}
          {clienteSeleccionado && (
            <button onClick={() => { setClienteSeleccionado(null); setClienteSearch(""); setFilteredSedes([]); setSedeId(""); setSedeNombre(""); }}
              style={{ position: "absolute", right: "12px", top: "34px", background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "1rem" }}>✕</button>
          )}
        </div>

        {clienteSeleccionado && filteredSedes.length > 0 && (
          <div style={{ marginBottom: "15px" }}>
            <label style={lbl}>SEDE / SUCURSAL (Opcional)</label>
            <select style={inp} value={sedeId} onChange={e => {
              const s = filteredSedes.find(x => x.id === e.target.value);
              if (s) { setSedeId(s.id); setSedeNombre(s.nombre); setClienteDireccion(s.direccion || clienteSeleccionado.direccion || ""); }
              else { setSedeId(""); setSedeNombre(""); setClienteDireccion(clienteSeleccionado.direccion || ""); }
            }}>
              <option value="">-- Sede principal --</option>
              {filteredSedes.map(s => <option key={s.id} value={s.id}>{s.nombre}{s.direccion ? ` — ${s.direccion}` : ""}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }} className="grid-2">
          <div><label style={lbl}>NOMBRE *</label><input value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>APELLIDO</label><input value={clienteApellido} onChange={e => setClienteApellido(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>EMPRESA / RAZÓN SOCIAL</label><input value={clienteEmpresa} onChange={e => setClienteEmpresa(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>DNI / CUIT</label><input value={clienteDniCuit} onChange={e => setClienteDniCuit(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>TELÉFONO</label><input value={clienteTelefono} onChange={e => setClienteTelefono(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>EMAIL</label><input type="email" value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} style={inp} /></div>
          <div style={{ gridColumn: "span 2" }}><label style={lbl}>DIRECCIÓN</label><input value={clienteDireccion} onChange={e => setClienteDireccion(e.target.value)} style={inp} /></div>
        </div>
      </div>

      {/* Sección 3: Ítems */}
      <div style={sec}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ ...secTitle, margin: 0 }}><Package size={20} /> Materiales / Equipos Entregados</h3>
          <button type="button" onClick={addItem} style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#fff", background: "var(--primary-blue)", border: "none", fontWeight: 800, padding: "8px 14px", borderRadius: "8px" }}>
            <Plus size={14} strokeWidth={3} /> AGREGAR ÍTEM
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 36px", gap: "10px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase" }}>Cantidad</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#aaa", textTransform: "uppercase" }}>Descripción</span>
            <span />
          </div>
          {items.map((item, idx) => (
            <div key={item.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 36px", gap: "10px", alignItems: "center" }}>
              <input type="number" value={item.cantidad} onChange={e => updateItem(item.id, "cantidad", Number(e.target.value))} min={1} style={{ ...inp, textAlign: "center", fontWeight: 700 }} />
              <input value={item.descripcion} onChange={e => updateItem(item.id, "descripcion", e.target.value)} placeholder={`Descripción del ítem ${idx + 1}...`} style={inp} />
              <button type="button" onClick={() => items.length > 1 && removeItem(item.id)} disabled={items.length === 1} style={{ width: "36px", height: "36px", borderRadius: "8px", border: "none", background: items.length === 1 ? "#f0f0f0" : "#fef2f2", color: items.length === 1 ? "#ccc" : "#ef4444", cursor: items.length === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "20px" }}>
          <label style={lbl}>DESCRIPCIÓN GENERAL / MOTIVO DE ENTREGA</label>
          <textarea value={descripcionGeneral} onChange={e => setDescripcionGeneral(e.target.value)} placeholder="Ej: Materiales dejados en obra para instalación de sistema contra incendios..." rows={3} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
        </div>
        <div style={{ marginTop: "15px" }}>
          <label style={lbl}>OBSERVACIONES</label>
          <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Observaciones adicionales..." rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
        </div>
      </div>

      {/* Sección 4: Firma */}
      <div style={sec}>
        <h3 style={secTitle}><PenLine size={20} /> Firma del Receptor</h3>
        <div style={{ marginBottom: "15px" }}>
          <label style={lbl}>NOMBRE DE QUIEN RECIBE</label>
          <input value={nombreReceptor} onChange={e => setNombreReceptor(e.target.value)} placeholder="Nombre completo del receptor..." style={inp} />
        </div>
        <div>
          <label style={lbl}>FIRMA</label>
          <div style={{ border: "1.5px dashed #ccc", borderRadius: "12px", overflow: "hidden", background: "#fafbfc", position: "relative" }}>
            <canvas ref={canvasRef} width={780} height={160} style={{ display: "block", width: "100%", height: "160px", cursor: "crosshair", touchAction: "none" }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
            {!firmaReceptor && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", color: "#bbb", fontSize: "0.85rem" }}>
                Dibujá la firma aquí
              </div>
            )}
          </div>
          <button type="button" onClick={clearCanvas} style={{ marginTop: "8px", padding: "7px 16px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#666" }}>
            Limpiar firma
          </button>
        </div>
      </div>

      {/* Botones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "15px" }}>
        <button onClick={() => router.back()} style={{ padding: "18px", borderRadius: "12px", border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem" }}>Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="btn-red" style={{ padding: "20px", fontSize: "1rem", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontWeight: 800, textTransform: "uppercase" }}>
          {saving ? "GUARDANDO..." : <><Save size={22} /> {editId ? "Actualizar Remito" : "Emitir Remito"}</>}
        </button>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .grid-2 { grid-template-columns: 1fr !important; }
          .grid-2 [style*="span 2"] { grid-column: span 1 !important; }
        }
      `}</style>
    </div>
  );
}

export default function NuevoRemitoPage() {
  return (
    <Suspense fallback={<div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>}>
      <NuevoRemitoContent />
    </Suspense>
  );
}
