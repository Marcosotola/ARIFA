"use client";
import { useEffect, useState, Suspense } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, query, where, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";

interface MantenimientoItem {
  id: string; 
  nroTarjeta: string;
  agente: string;
  capacidad: string;
  claseFuego: string[];
  marca: string;
  anioFab: string;
  estadoCilindro: "aprobado" | "rechazado";
  inspeccionVisual: "ok" | "nok" | "observaciones";
  componentesReemplazados: string[];
  agenteAdicional: string;
  presionFinal: string;
  pesoFinal: string;
  marbeteColor: string;
  marbeteAnio: string;
  precintoColor: string;
  vencimientoCarga: string;
  ultimaPH: string;
  proximaPH: string;
  observaciones: string;
}

function FichaFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tecnico, setTecnico] = useState<any>(null);

  // Datos de cabecera
  const [numeroFichaExistente, setNumeroFichaExistente] = useState<number | null>(null);
  const [fechaServicio, setFechaServicio] = useState(new Date().toISOString().split("T")[0]);
  const [clienteManual, setClienteManual] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");

  const [items, setItems] = useState<MantenimientoItem[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      
      try {
        // Cargar técnicos y clientes primero
        const [userDoc, clientsSnap] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente")))
        ]);
        
        const tecData = { uid: u.uid, nombre: (userDoc.exists() ? userDoc.data().nombre : "") || u.email };
        setTecnico(tecData);
        
        const allClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setClientes(allClients);

        // SI HAY EDICION, CARGAR FICHA AHORA QUE TENEMOS CLIENTES
        if (editId) {
          const fichaDoc = await getDoc(doc(db, "mantenimiento_matafuegos", editId));
          if (fichaDoc.exists()) {
            const data = fichaDoc.data();
            setNumeroFichaExistente(data.numeroFicha);
            setFechaServicio(data.fechaServicio || "");
            setNombre(data.clienteNombre || "");
            setEmpresa(data.clienteEmpresa || "");
            setItems(data.items || []);
            
            if (data.clienteId) {
              const matched = allClients.find(c => c.id === data.clienteId);
              if (matched) setClienteSeleccionado(matched);
            } else {
              setClienteManual(true);
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
    if (!id) {
        setClienteSeleccionado(null);
        setNombre("");
        setEmpresa("");
        return;
    }
    const c = clientes.find(x => x.id === id);
    if (c) {
      setClienteSeleccionado(c);
      setNombre(c.nombre || c.razonSocial || "");
      setEmpresa(c.empresa || c.razonSocial || "");
    }
  };

  const agregarItem = () => {
    const nuevo: MantenimientoItem = {
      id: Math.random().toString(36).substr(2, 9),
      nroTarjeta: "", agente: "ABC", capacidad: "5kg", claseFuego: ["A", "B", "C"],
      marca: "", anioFab: "", estadoCilindro: "aprobado", inspeccionVisual: "ok",
      componentesReemplazados: [], agenteAdicional: "", presionFinal: "", pesoFinal: "",
      marbeteColor: "", marbeteAnio: new Date().getFullYear().toString(),
      precintoColor: "", vencimientoCarga: "", ultimaPH: "", proximaPH: "", observaciones: ""
    };
    setItems([...items, nuevo]);
  };

  const updateItem = (idx: number, field: keyof MantenimientoItem, value: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setItems(newItems);
  };

  const toggleArrayItem = (idx: number, field: "claseFuego" | "componentesReemplazados", value: string) => {
    const newItems = [...items];
    const current = newItems[idx][field] as string[];
    if (current.includes(value)) {
      newItems[idx][field] = current.filter(x => x !== value) as any;
    } else {
      newItems[idx][field] = [...current, value] as any;
    }
    setItems(newItems);
  };

  const handleSave = async () => {
    if (!nombre.trim()) return alert("El nombre del cliente es obligatorio.");
    if (items.length === 0) return alert("Debes agregar al menos un extintor.");
    
    setSaving(true);
    try {
      let numeroFicha = numeroFichaExistente;
      if (!editId) {
        const snap = await getDocs(collection(db, "mantenimiento_matafuegos"));
        numeroFicha = snap.size + 1;
      }

      const payload = {
        numeroFicha,
        fechaServicio,
        clienteId: clienteSeleccionado?.id || null,
        clienteNombre: nombre,
        clienteEmpresa: empresa,
        tecnicoId: tecnico.uid,
        tecnicoNombre: tecnico.nombre,
        items,
        updatedAt: serverTimestamp()
      };

      if (editId) {
        await updateDoc(doc(db, "mantenimiento_matafuegos", editId), payload);
      } else {
        await addDoc(collection(db, "mantenimiento_matafuegos"), { ...payload, createdAt: serverTimestamp() });
      }

      alert("Ficha técnica guardada con éxito.");
      router.push("/admin/planillas/matafuegos/mantenimiento");
    } catch (e) {
      console.error(e);
      alert("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando datos...</div>;

  const marcasDisponibles = ["Melisam", "Horizonte", "Drago", "Yukon", "Cassaro", "Fadesa", "Centurion", "Otro"];
  const componentesDisponibles = ["Tubo sifón", "Válvula", "Anilla", "Precinto", "Manómetro", "Manguera", "Difusor"];

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", paddingBottom: "100px" }}>
      <header style={{ marginBottom: "30px" }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: '10px' }}>← Volver</button>
        <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "var(--primary-blue)" }}>
          {editId ? `Editando Ficha FT-${String(numeroFichaExistente).padStart(5, "0")}` : "Nueva Ficha Técnica de Taller"}
        </h1>
      </header>

      {/* CLIENTE */}
      <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: '25px', border: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-blue)' }}>Datos del Cliente</h3>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={clienteManual} onChange={e => { setClienteManual(e.target.checked); if(e.target.checked) setClienteSeleccionado(null); }} />
                Carga Manual
            </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {!clienteManual && (
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>CLIENTE REGISTRADO</label>
                <select 
                  onChange={(e) => onSelectCliente(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }}
                  value={clienteSeleccionado?.id || ""}
                >
                  <option value="">-- Seleccionar --</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre || c.razonSocial}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>FECHA DE SERVICIO</label>
              <input type="date" value={fechaServicio} onChange={(e) => setFechaServicio(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
            {(clienteManual || editId) && (
              <>
                <div>
                  <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>NOMBRE / CLIENTE</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre o Razón Social" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>EMPRESA (OPCIONAL)</label>
                  <input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nombre Fantasía o Empresa" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
                </div>
              </>
            )}
        </div>
      </div>

      {/* ITEMS */}
      <div style={{ marginBottom: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-blue)' }}>Registro de Equipos</h3>
            <button onClick={agregarItem} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>+ Agregar Extintor</button>
        </div>

        {items.map((item, idx) => (
          <div key={item.id} style={{ background: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #eee', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
              <span style={{ fontWeight: 900, color: 'var(--primary-red)' }}>EXTINTOR #{idx + 1}</span>
              <button onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '0.8rem' }}>Eliminar</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '5px' }}>TARJETA N°</label>
                <input value={item.nroTarjeta} onChange={e => updateItem(idx, 'nroTarjeta', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '5px' }}>AGENTE</label>
                <select value={item.agente} onChange={e => updateItem(idx, 'agente', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                  <option value="ABC">Polvo ABC</option>
                  <option value="CO2">CO2</option>
                  <option value="Agua">Agua</option>
                  <option value="K">Clase K</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '5px' }}>CAPACIDAD</label>
                <input value={item.capacidad} onChange={e => updateItem(idx, 'capacidad', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '5px' }}>MARCA</label>
                <select value={item.marca} onChange={e => updateItem(idx, 'marca', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                  <option value="">-- Seleccionar --</option>
                  {marcasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '8px' }}>CLASES DE FUEGO</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {["A", "B", "C", "D", "K"].map(clase => (
                    <button key={clase} onClick={() => toggleArrayItem(idx, 'claseFuego', clase)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', background: item.claseFuego.includes(clase) ? 'var(--primary-blue)' : '#fff', color: item.claseFuego.includes(clase) ? '#fff' : '#666', fontWeight: 800, flex: 1 }}>{clase}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '8px' }}>ESTADO CILINDRO</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => updateItem(idx, 'estadoCilindro', 'aprobado')} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', background: item.estadoCilindro === 'aprobado' ? '#dcfce7' : '#fff', flex: 1, fontWeight: 700 }}>Aprobado</button>
                  <button onClick={() => updateItem(idx, 'estadoCilindro', 'rechazado')} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', background: item.estadoCilindro === 'rechazado' ? '#fee2e2' : '#fff', flex: 1, fontWeight: 700 }}>Rechazado</button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '8px' }}>COMP. REEMPLAZADOS</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {componentesDisponibles.map(comp => (
                  <button key={comp} onClick={() => toggleArrayItem(idx, 'componentesReemplazados', comp)} style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid #ddd', fontSize: '0.75rem', background: item.componentesReemplazados.includes(comp) ? '#f1f5f9' : '#fff', fontWeight: 600 }}>{comp}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.6rem', color: '#64748b', marginBottom: '5px' }}>VENC. CARGA</label>
                <input type="month" value={item.vencimientoCarga} onChange={e => updateItem(idx, 'vencimientoCarga', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.6rem', color: '#64748b', marginBottom: '5px' }}>ÚLT. PH</label>
                <input type="date" value={item.ultimaPH} onChange={e => updateItem(idx, 'ultimaPH', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.6rem', color: '#64748b', marginBottom: '5px' }}>PRÓX. PH</label>
                <input type="date" value={item.proximaPH} onChange={e => updateItem(idx, 'proximaPH', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
        <button onClick={() => router.back()} style={{ padding: '18px', borderRadius: '12px', border: '1px solid #ddd', background: '#fff', fontWeight: 700 }}>Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="btn-red" style={{ padding: '20px', fontSize: '1.2rem', borderRadius: '12px', background: '#0f172a' }}>
            {saving ? "Guardando..." : "GUARDAR FICHA TÉCNICA"}
        </button>
      </div>
    </div>
  );
}

export default function FichaMantenimientoPage() {
  return (
    <Suspense fallback={<div style={{ padding: '100px', textAlign: "center" }}>Cargando formulario...</div>}>
      <FichaFormContent />
    </Suspense>
  );
}
