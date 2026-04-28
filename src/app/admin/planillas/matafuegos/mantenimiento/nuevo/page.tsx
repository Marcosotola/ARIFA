"use client";
import { useEffect, useState, Suspense } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, query, where, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  User, 
  ClipboardList, 
  PenTool, 
  Check,
  RotateCcw,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";

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
  const [proximaOblea, setProximaOblea] = useState<number>(1);

  // Datos de cabecera
  const [numeroFichaExistente, setNumeroFichaExistente] = useState<number | null>(null);
  const [fechaServicio, setFechaServicio] = useState(new Date().toISOString().split("T")[0]);
  const [clienteManual, setClienteManual] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [sedeNombre, setSedeNombre] = useState("");
  const [filteredSedes, setFilteredSedes] = useState<any[]>([]);

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
        
        const allClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setClientes(allClients);

        // Cargar configuración de obleas
        const configDoc = await getDoc(doc(db, "configuracion", "matafuegos"));
        if (configDoc.exists()) {
          setProximaOblea(configDoc.data().proximaTarjeta || 1);
        }

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
              if (matched) {
                setClienteSeleccionado(matched);
                setFilteredSedes(matched.sedes || []);
                setSedeId(data.sedeId || "");
                setSedeNombre(data.sedeNombre || "");
              }
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
      setFilteredSedes(c.sedes || []);
      setSedeId("");
      setSedeNombre("");
      setClienteSearch("");
    }
  };

  const clientesFiltrados = clientes.filter(c =>
    clienteSearch.length < 2 ? false :
    `${c.nombre || ""} ${c.razonSocial || ""} ${c.empresa || ""} ${c.email || ""}`.toLowerCase().includes(clienteSearch.toLowerCase())
  );

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

  const handleObleaBlur = async (idx: number, nroTarjeta: string) => {
    if (!nroTarjeta || nroTarjeta.trim() === "") return;
    
    try {
      // Buscar el matafuego por número de tarjeta
      const q = query(collection(db, "matafuegos_activos"), where("nroTarjeta", "==", nroTarjeta.trim()));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const data = snap.docs[0].data();
        const tec = data.datosTecnicos || {};
        const hist = data.historial || {};
        
        const newItems = [...items];
        newItems[idx] = {
          ...newItems[idx],
          agente: tec.agente || newItems[idx].agente,
          capacidad: tec.capacidad || newItems[idx].capacidad,
          marca: tec.marca || newItems[idx].marca,
          anioFab: tec.anioFab || newItems[idx].anioFab,
          claseFuego: tec.claseFuego || newItems[idx].claseFuego,
          ultimaPH: hist.ultimaPH || newItems[idx].ultimaPH,
          proximaPH: hist.proximaPH || newItems[idx].proximaPH,
          vencimientoCarga: hist.vencimientoCarga || newItems[idx].vencimientoCarga
        };
        setItems(newItems);
      }
    } catch (e) {
      console.error("Error buscando oblea:", e);
    }
  };

  const asignarProximaOblea = (idx: number) => {
    updateItem(idx, 'nroTarjeta', proximaOblea.toString());
    setProximaOblea(prev => prev + 1);
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
        sedeId: sedeId || null,
        sedeNombre: sedeNombre || "",
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

      // 4. Sincronizar Matafuegos Activos e incrementar contador de obleas
      const updates = items.map(async (it) => {
        const mfRef = doc(db, "matafuegos_activos", it.nroTarjeta);
        const mfData = {
          nroTarjeta: it.nroTarjeta,
          clienteId: clienteSeleccionado?.id || null,
          clienteNombre: nombre,
          clienteEmpresa: empresa,
          sedeId: sedeId || null,
          sedeNombre: sedeNombre || "",
          datosTecnicos: {
            agente: it.agente,
            capacidad: it.capacidad,
            marca: it.marca,
            anioFab: it.anioFab,
            claseFuego: it.claseFuego
          },
          historial: {
            ultimaPH: it.ultimaPH,
            proximaPH: it.proximaPH,
            vencimientoCarga: it.vencimientoCarga
          },
          updatedAt: serverTimestamp()
        };
        await updateDoc(mfRef, mfData).catch(async () => {
           // Si no existe, lo creamos (el ID es el nroTarjeta para fácil acceso)
           const { setDoc } = await import("firebase/firestore");
           await setDoc(mfRef, { ...mfData, createdAt: serverTimestamp() });
        });
      });

      // Actualizar contador global si se usaron nuevas obleas
      const maxObleaUsada = Math.max(...items.map(it => parseInt(it.nroTarjeta)).filter(n => !isNaN(n)));
      if (maxObleaUsada >= proximaOblea) {
        await updateDoc(doc(db, "configuracion", "matafuegos"), { proximaTarjeta: maxObleaUsada + 1 }).catch(async () => {
          const { setDoc } = await import("firebase/firestore");
          await setDoc(doc(db, "configuracion", "matafuegos"), { proximaTarjeta: maxObleaUsada + 1 });
        });
      }

      await Promise.all(updates);

      alert("Ficha técnica guardada con éxito.");
      router.push("/admin/planillas/matafuegos?tab=fichas");
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
        <button onClick={() => router.push("/admin/planillas/matafuegos")} 
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", marginBottom: "10px", padding: 0 }}>
          <ArrowLeft size={18} /> Volver
        </button>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>
          {editId ? `Editando Ficha FT-${String(numeroFichaExistente).padStart(5, "0")}` : "Nueva Ficha Técnica de Taller"}
        </h1>
      </header>

      {/* CLIENTE */}
      <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: '25px', border: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <User size={20} /> Datos del Cliente
            </h3>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#666' }}>
                <input type="checkbox" checked={clienteManual} onChange={e => { setClienteManual(e.target.checked); if(e.target.checked) setClienteSeleccionado(null); }} />
                Carga Manual
            </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {!clienteManual && (
              <div style={{ position: "relative" }}>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>CLIENTE REGISTRADO</label>
                <input 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', background: '#f8fafc' }}
                  placeholder="Escribe el nombre, empresa o email..."
                  value={clienteSeleccionado ? (clienteSeleccionado.nombre || clienteSeleccionado.razonSocial || clienteSeleccionado.empresa || clienteSeleccionado.email) : clienteSearch}
                  onChange={e => {
                    setClienteSearch(e.target.value);
                    setClienteSeleccionado(null);
                  }}
                />
                {clientesFiltrados.length > 0 && !clienteSeleccionado && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "10px", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "200px", overflowY: "auto", marginTop: "5px" }}>
                    {clientesFiltrados.map(c => (
                      <div key={c.id} onClick={() => onSelectCliente(c.id)}
                        style={{ padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8f9ff")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                        <div style={{ fontWeight: 700, color: "var(--primary-blue)" }}>{c.nombre || c.razonSocial || c.email}</div>
                        {c.empresa && <div style={{ fontSize: "0.78rem", color: "#888" }}>{c.empresa}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {clienteSeleccionado && (
                  <button 
                    onClick={() => { setClienteSeleccionado(null); setClienteSearch(""); }}
                    style={{ position: 'absolute', right: '12px', top: '35px', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                    ✕
                  </button>
                )}
              </div>
            )}
            {clienteSeleccionado && filteredSedes.length > 0 && (
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>SEDE / UBICACIÓN</label>
                <select 
                  value={sedeId}
                  onChange={e => {
                    const s = filteredSedes.find(x => x.id === e.target.value);
                    setSedeId(e.target.value);
                    setSedeNombre(s ? s.nombre : "");
                  }}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', background: '#f8fafc' }}
                >
                  <option value="">-- Seleccionar Sede (Opcional) --</option>
                  {filteredSedes.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.direccion || "Sin dirección"})</option>)}
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
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <ClipboardList size={20} /> Registro de Equipos
            </h3>
            <button onClick={agregarItem} className="btn-blue" style={{ padding: '10px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} strokeWidth={3} /> Agregar Extintor
            </button>
        </div>

        {items.map((item, idx) => (
          <div key={item.id} style={{ background: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #eee', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px', alignItems: 'center' }}>
              <span style={{ fontWeight: 900, color: 'var(--primary-red)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} /> EXTINTOR #{idx + 1}
              </span>
              <button onClick={() => setItems(items.filter((_, i) => i !== idx))} 
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                <Trash2 size={14} /> Eliminar
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '5px' }}>TARJETA N°</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input 
                    value={item.nroTarjeta} 
                    onChange={e => updateItem(idx, 'nroTarjeta', e.target.value)} 
                    onBlur={e => handleObleaBlur(idx, e.target.value)}
                    placeholder="0000"
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} 
                  />
                  <button 
                    onClick={() => asignarProximaOblea(idx)}
                    title="Asignar Siguiente Oblea Correlativa"
                    style={{ padding: '0 10px', borderRadius: '8px', border: '1px solid #3b82f6', background: '#eff6ff', color: '#3b82f6', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                    AUTO
                  </button>
                </div>
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
        <button onClick={handleSave} disabled={saving} className="btn-red" 
          style={{ padding: '20px', fontSize: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
            {saving ? "Guardando..." : <><Save size={22} /> Guardar Ficha Técnica</>}
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
