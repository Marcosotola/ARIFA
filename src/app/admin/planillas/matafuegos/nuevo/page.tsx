"use client";
import { useEffect, useState, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, query, where, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

// Firma digital (solo cliente) - Desactivamos SSR porque usa APIs del navegador (canvas)
const SignatureCanvas = dynamic(() => import("react-signature-canvas"), { ssr: false }) as any;

interface EquipoRemito {
  id: string;
  tipo: string;
  capacidad: string;
  cantidad: string;
  marca: string;
  esPrestamo: boolean;
  estado: "bueno" | "malo" | "recarga";
}

export default function NuevoRemitoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const sigCanvas = useRef<any>(null);

  // Datos del Remito
  const [tipoMovimiento, setTipoMovimiento] = useState<"retiro" | "entrega">("retiro");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  
  // Cliente
  const [clienteManual, setClienteManual] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");

  const [equipos, setEquipos] = useState<EquipoRemito[]>([]);
  const [tecnico, setTecnico] = useState<any>(null);
  const [aclaracion, setAclaracion] = useState("");
  const [numeroExistente, setNumeroExistente] = useState<number | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      
      try {
        const [userDoc, clientsSnap] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente")))
        ]);

        const tecnicoData = { uid: u.uid, nombre: userDoc.exists() ? userDoc.data().nombre || u.email : u.email };
        setTecnico(tecnicoData);
        const allClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setClientes(allClients);

        if (editId) {
          const remitoDoc = await getDoc(doc(db, "remitos_matafuegos", editId));
          if (remitoDoc.exists()) {
            const r = remitoDoc.data();
            setTipoMovimiento(r.type || r.tipo || "retiro");
            setFecha(r.fecha || "");
            setNombre(r.clienteNombre || "");
            setEmpresa(r.clienteEmpresa || "");
            setDireccion(r.clienteDireccion || "");
            setTelefono(r.clienteTelefono || "");
            setEquipos(r.equipos || []);
            setAclaracion(r.aclaracion || "");
            setNumeroExistente(r.numero || 0);
            if (r.clienteId) {
              const cli = allClients.find(c => c.id === r.clienteId);
              if (cli) setClienteSeleccionado(cli);
            }
          }
        }
      } catch (e) {
        console.error("Error loading data:", e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router, editId]);

  const onSelectCliente = (id: string) => {
    const c = clientes.find(x => x.id === id);
    if (c) {
      setClienteSeleccionado(c);
      setNombre(c.nombre || "");
      setEmpresa(c.empresa || c.razonSocial || "");
      setDireccion(c.direccion || "");
      setTelefono(c.telefono || "");
    } else {
      setClienteSeleccionado(null);
    }
  };

  const agregarEquipo = () => {
    const nuevo: EquipoRemito = { id: "", tipo: "ABC", capacidad: "5kg", cantidad: "", marca: "", esPrestamo: false, estado: "recarga" };
    setEquipos([...equipos, nuevo]);
  };

  const eliminarEquipo = (idx: number) => {
    setEquipos(equipos.filter((_, i) => i !== idx));
  };

  const updateEquipo = (idx: number, field: keyof EquipoRemito, value: any) => {
    const n = [...equipos];
    n[idx] = { ...n[idx], [field]: value };
    setEquipos(n);
  };

  const handleSave = async () => {
    if (!nombre.trim()) return alert("El nombre del cliente es obligatorio.");
    if (equipos.length === 0) return alert("Debes agregar al menos un equipo.");
    if (equipos.some(eq => !eq.cantidad)) return alert("Todos los renglones deben tener una cantidad definida.");
    if (!editId && (!sigCanvas.current || sigCanvas.current.isEmpty())) return alert("El cliente debe firmar el remito.");
    if (!aclaracion.trim()) return alert("Por favor, ingresa la aclaración de la firma.");

    setSaving(true);
    try {
      let proximoNumero = numeroExistente;
      if (!editId) {
        const remitosSnap = await getDocs(collection(db, "remitos_matafuegos"));
        proximoNumero = remitosSnap.size + 1;
      }

      const payload: any = {
        numero: proximoNumero,
        tipo: tipoMovimiento,
        fecha,
        clienteId: clienteSeleccionado?.id || null,
        clienteNombre: nombre,
        clienteEmpresa: empresa,
        clienteDireccion: direccion,
        clienteTelefono: telefono,
        tecnicoId: tecnico.uid,
        tecnicoNombre: tecnico.nombre,
        equipos,
        aclaracion,
        updatedAt: serverTimestamp()
      };

      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        payload.firma = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png");
      }

      if (editId) {
        await updateDoc(doc(db, "remitos_matafuegos", editId), payload);
      } else {
        await addDoc(collection(db, "remitos_matafuegos"), { ...payload, createdAt: serverTimestamp() });
      }

      alert(editId ? "¡Remito actualizado!" : "¡Remito generado con éxito!");
      router.push("/admin/planillas/matafuegos");
    } catch (e) {
      console.error(e);
      alert("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: "100px" }}>
      <header style={{ marginBottom: "30px" }}>
        <button onClick={() => router.push("/admin/planillas/matafuegos")} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: '10px' }}>← Volver</button>
        <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "var(--primary-blue)" }}>
          {editId ? `Editando Remito R-${String(numeroExistente).padStart(5, "0")}` : "Nuevo Movimiento"}
        </h1>
        <p style={{ color: "var(--text-muted)" }}>Completa los datos del retiro o entrega de equipos.</p>
      </header>

      {/* SECCION 1: CLIENTE */}
      <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: '25px', border: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-blue)' }}>Datos del Cliente</h3>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#666' }}>
                <input type="checkbox" checked={clienteManual} onChange={e => { setClienteManual(e.target.checked); if(e.target.checked) setClienteSeleccionado(null); }} />
                Carga 100% Manual
            </label>
        </div>

        {!clienteManual && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>BUSCAR CLIENTE REGISTRADO</label>
            <select 
              onChange={(e) => onSelectCliente(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', background: '#f8fafc' }}
              value={clienteSeleccionado?.id || ""}
            >
              <option value="">-- Seleccionar --</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre || c.razonSocial} ({c.empresa || 'S/E'})</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>NOMBRE / CONTACTO</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>EMPRESA</label>
              <input value={empresa} onChange={e => setEmpresa(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>DIRECCIÓN</label>
              <input value={direccion} onChange={e => setDireccion(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>TELÉFONO</label>
              <input value={telefono} onChange={e => setTelefono(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>OPERACIÓN</label>
              <select value={tipoMovimiento} onChange={(e:any) => setTipoMovimiento(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', background: '#f8fafc', fontWeight: 700 }}>
                <option value="retiro">🚩 RETIRO (A taller)</option>
                <option value="entrega">✅ ENTREGA (Al cliente)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>FECHA</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
        </div>
      </div>

      {/* SECCION 2: EQUIPOS */}
      <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: '25px', border: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-blue)' }}>Inventario de Equipos</h3>
            <button onClick={agregarEquipo} style={{ background: 'var(--primary-blue)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>+ Agregar Equipo</button>
        </div>
        {equipos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '30px', border: '2px dashed #eee', borderRadius: '12px' }}>Aún no se han agregado equipos.</div>
        ) : (
          equipos.map((eq, idx) => (
              <div key={idx} style={{ padding: '20px', border: '1px solid #eee', borderRadius: '12px', marginBottom: '10px', background: '#fafafa' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#999', display: 'block', marginBottom: '3px' }}>CANT.</label>
                        <input type="number" placeholder="Cant" value={eq.cantidad || ""} onChange={(e) => updateEquipo(idx, 'cantidad', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#999', display: 'block', marginBottom: '3px' }}>ID / CÓDIGO</label>
                        <input placeholder="Cod. Equipo" value={eq.id || ""} onChange={(e) => updateEquipo(idx, 'id', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#999', display: 'block', marginBottom: '3px' }}>TIPO</label>
                        <select value={eq.tipo || "ABC"} onChange={(e) => updateEquipo(idx, 'tipo', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                            <option value="ABC">Polvo ABC</option>
                            <option value="CO2">CO2</option>
                            <option value="Agua">Agua</option>
                            <option value="K">Clase K</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#999', display: 'block', marginBottom: '3px' }}>CAPAC.</label>
                        <input placeholder="5kg" value={eq.capacidad || ""} onChange={(e) => updateEquipo(idx, 'capacidad', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
                      </div>
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={eq.esPrestamo} onChange={(e) => updateEquipo(idx, 'esPrestamo', e.target.checked)} />
                        Equipo de préstamo
                    </label>
                    <button onClick={() => eliminarEquipo(idx)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>✕ Eliminar</button>
                  </div>
              </div>
          ))
        )}
      </div>

      {/* SECCION 3: FIRMA */}
      <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #eee' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '15px', color: 'var(--primary-blue)' }}>Conformidad del Cliente</h3>
        
        {/* Si estamos editando y ya existe una firma, la mostramos como referencia */}
        {editId && (
          <div style={{ marginBottom: '15px', padding: '10px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
            <p style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 800, marginBottom: '5px' }}>📌 FIRMA ACTUAL EN ARCHIVO:</p>
            <div style={{ background: '#fff', borderRadius: '8px', padding: '5px' }}>
                <p style={{ fontSize: '0.7rem', color: '#999', fontStyle: 'italic' }}>Si firma el recuadro de abajo, la firma actual será reemplazada.</p>
            </div>
          </div>
        )}

        <div style={{ border: '2px dashed #ddd', borderRadius: '12px', background: '#fcfcfc', marginBottom: '15px' }}>
            <SignatureCanvas 
              ref={sigCanvas} 
              penColor="#002244" 
              canvasProps={{ width: 740, height: 200, className: 'sigCanvas', style: { width: '100%' } }} 
            />
        </div>
        
        <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>ACLARACIÓN DE LA FIRMA (OBLIGATORIO)</label>
        <input 
          placeholder="Nombre completo de quien firma..." 
          value={aclaracion} 
          onChange={e => setAclaracion(e.target.value)} 
          style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem', marginBottom: '10px' }} 
        />

        <div style={{ textAlign: 'right' }}>
          <button onClick={() => sigCanvas.current.clear()} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Borrar firma</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
        <button onClick={() => router.back()} style={{ padding: '18px', borderRadius: '12px', border: '1px solid #ddd', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Cancelar
        </button>
        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="btn-red" 
          style={{ padding: '20px', fontSize: '1.2rem', borderRadius: '12px' }}
        >
          {saving ? "GENERANDO..." : "CONFIRMAR Y GUARDAR"}
        </button>
      </div>
    </div>
  );
}
