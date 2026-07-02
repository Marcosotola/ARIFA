"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useToast, Toast } from "@/components/Toast";
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

import SignatureCanvas from "react-signature-canvas";

interface MantenimientoItem {
  id: string;
  nroTarjeta: string;
  sector: string;
  agente: string;
  base: string;
  capacidad: string;
  claseFuego: string[];
  marca: string;
  marcaOtro?: string;
  nroFabricacion: string;
  anioFab: string;
  estadoCilindro: "aprobado" | "rechazado";
  inspeccionVisual: "ok" | "nok" | "observaciones";
  componentesReemplazados: string[];
  agenteAdicional: string;
  presionInicial: string;
  presionFinal: string;
  pesoInicial: string;
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
  const { toast, showToast } = useToast();
  const [tecnico, setTecnico] = useState<any>(null);
  const sigCanvas = useRef<any>(null);
  const [proximaOblea, setProximaOblea] = useState<number>(1);
  const [isMounted, setIsMounted] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    const updateWidth = () => {
      const container = document.getElementById("sig-container");
      if (container) setCanvasWidth(container.offsetWidth);
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Datos de cabecera
  const [numeroFichaExistente, setNumeroFichaExistente] = useState<number | null>(null);
  const [fechaServicio, setFechaServicio] = useState(new Date().toISOString().split("T")[0]);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({ 
    nombre: "", 
    apellido: "",
    email: "", 
    empresa: "", 
    dniCuit: "", 
    telefono: "", 
    direccion: "",
    cargo: "",
    sedes: [] as any[]
  });
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [sedeNombre, setSedeNombre] = useState("");
  const [filteredSedes, setFilteredSedes] = useState<any[]>([]);
  const [allTecnicos, setAllTecnicos] = useState<any[]>([]);
  const [tallerNombre, setTallerNombre] = useState("Taller Central");
  const [isFromRemito, setIsFromRemito] = useState(false);

  const [items, setItems] = useState<MantenimientoItem[]>([]);
  const [dniCuit, setDniCuit] = useState("");
  const [telefono, setTelefono] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [quienRecibe, setQuienRecibe] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      
      try {
        // Cargar técnicos y clientes primero
        const [userDoc, clientsSnap, tecnicosSnap] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente"))),
          getDocs(query(collection(db, "usuarios"), where("rol", "==", "tecnico")))
        ]);
        
        const tecs = tecnicosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllTecnicos(tecs);

        const tecData = { uid: u.uid, nombre: (userDoc.exists() ? userDoc.data().nombre : "") || u.email };
        setTecnico(tecData);
        
        const allClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setClientes(allClients);

        // Cargar configuración de obleas
        const configDoc = await getDoc(doc(db, "configuracion", "matafuegos"));
        if (configDoc.exists()) {
          setProximaOblea(configDoc.data().proximaTarjeta || 1);
        }

        // CARGA DESDE REMITO SI EXISTE
        const fromRemitoId = searchParams.get("fromRemito");
        if (fromRemitoId && !editId) {
          setIsFromRemito(true);
          const remitoSnap = await getDoc(doc(db, "remitos_matafuegos", fromRemitoId));
          if (remitoSnap.exists()) {
            const rem = remitoSnap.data();
            setNombre(rem.clienteNombre || "");
            setEmpresa(rem.clienteEmpresa || "");
            setDniCuit(rem.clienteDniCuit || "");
            setTelefono(rem.clienteTelefono || "");
            setDomicilio(rem.clienteDireccion || "");
            setSedeId(rem.sedeId || "");
            setSedeNombre(rem.sedeNombre || "");
            
            if (rem.clienteId) {
              const matched = allClients.find(c => c.id === rem.clienteId);
              if (matched) {
                setClienteSeleccionado(matched);
                setFilteredSedes(matched.sedes || []);
              }
            }

            // Mapear equipos a items de mantenimiento
            const newItems: MantenimientoItem[] = rem.equipos.map((eq: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              nroTarjeta: eq.id || "",
              sector: "",
              agente: eq.tipo || "ABC",
              base: "",
              capacidad: eq.capacidad || "",
              claseFuego: ["A", "B", "C"],
              marca: "",
              marcaOtro: "",
              nroFabricacion: "",
              anioFab: "",
              estadoCilindro: "aprobado",
              inspeccionVisual: "ok",
              componentesReemplazados: [],
              agenteAdicional: "",
              presionInicial: "",
              presionFinal: "",
              pesoInicial: "",
              pesoFinal: "",
              marbeteColor: "",
              marbeteAnio: "",
              precintoColor: "",
              vencimientoCarga: "",
              ultimaPH: "",
              proximaPH: "",
              observaciones: ""
            }));
            setItems(newItems);
          }
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
            setDniCuit(data.dniCuit || "");
            setTelefono(data.telefono || "");
            setDomicilio(data.domicilio || "");
            setQuienRecibe(data.quienRecibe || "");
            setItems(data.items || []);
            setTallerNombre(data.tallerNombre || "Taller Central");
            
            if (data.clienteId) {
              const matched = allClients.find(c => c.id === data.clienteId);
              if (matched) {
                setClienteSeleccionado(matched);
                setFilteredSedes(matched.sedes || []);
                setSedeId(data.sedeId || "");
                setSedeNombre(data.sedeNombre || "");
              }
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
      setNombre(`${c.nombre || c.razonSocial || ""} ${c.apellido || ""}`.trim());
      setEmpresa(c.empresa || c.razonSocial || "");
      setDniCuit(c.dniCuit || c.cuit || "");
      setTelefono(c.telefono || c.celular || "");
      setDomicilio(c.direccion || c.domicilio || "");
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
      nroTarjeta: "", sector: "", agente: "ABC", base: "", capacidad: "5kg", claseFuego: ["A", "B", "C"],
      marca: "", marcaOtro: "", nroFabricacion: "", anioFab: "", estadoCilindro: "aprobado", inspeccionVisual: "ok",
      componentesReemplazados: [], agenteAdicional: "",
      presionInicial: "", presionFinal: "", pesoInicial: "", pesoFinal: "",
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
    if (!nombre.trim()) { showToast("El nombre del cliente es obligatorio.", "error"); return; }
    if (items.length === 0) { showToast("Debés agregar al menos un extintor.", "error"); return; }
    
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
        dniCuit,
        telefono,
        domicilio,
        quienRecibe,
        sedeNombre: sedeNombre || "",
        tecnicoId: tecnico.uid || tecnico.id,
        tecnicoNombre: tecnico.nombre,
        tallerNombre,
        items,
        firmaTecnico: sigCanvas.current && !sigCanvas.current.isEmpty() ? sigCanvas.current.getTrimmedCanvas().toDataURL("image/png") : null,
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
            marca: it.marca === "Otro" ? it.marcaOtro : it.marca,
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
      
      // 5. Actualizar datos del cliente en la colección 'usuarios' si cambió algo
      if (clienteSeleccionado?.id) {
        await updateDoc(doc(db, "usuarios", clienteSeleccionado.id), {
            nombre,
            empresa,
            dniCuit,
            telefono,
            direccion: domicilio,
            firmaTecnico: sigCanvas.current && !sigCanvas.current.isEmpty() ? sigCanvas.current.getTrimmedCanvas().toDataURL("image/png") : (editId ? null : ""),
            updatedAt: serverTimestamp()
        }).catch(err => console.error("Error updating client profile:", err));
      }

      showToast("Ficha técnica guardada con éxito", "success");
      setTimeout(() => router.push("/admin/planillas/matafuegos?tab=fichas"), 1200);
    } catch (e) {
      console.error(e);
      showToast("Error al guardar. Intentá de nuevo.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando datos...</div>;

  const marcasDisponibles = ["Melisam", "Horizonte", "Drago", "Yukon", "Cassaro", "Fadesa", "Centurion", "Otro"];
  const componentesDisponibles = ["Tubo sifón", "Válvula", "Anilla", "Precinto", "Manómetro", "Manguera", "Difusor"];

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 15px 100px", overflowX: "hidden" }}>
      <style jsx>{`
        .responsive-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .grid-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 15px;
        }
        .form-card {
          background: #fff;
          padding: 30px;
          borderRadius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          margin-bottom: 25px;
          border: 1px solid #eee;
        }
        @media (max-width: 768px) {
          .responsive-grid, .grid-4, .grid-3, .grid-2 {
            grid-template-columns: 1fr !important;
            gap: 15px;
          }
          .grid-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          .form-card {
            padding: 15px !important;
          }
          .grid-column-span-2 {
            grid-column: span 1 !important;
          }
        }
      `}</style>
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
      <div className="form-card">
        <div className="grid-header">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <User size={20} /> Datos del Cliente
            </h3>
            {!isFromRemito && (
              <button 
                type="button"
                onClick={() => setShowNewClientModal(true)}
                style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#fff', background: 'var(--primary-blue)', border: 'none', fontWeight: 800, padding: '8px 14px', borderRadius: '8px', transition: '0.2s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                  <Plus size={14} strokeWidth={3} /> NUEVO CLIENTE
              </button>
            )}
        </div>

        <div className="responsive-grid">
            {!isFromRemito && (
              <div style={{ position: "relative" }}>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>BUSCAR CLIENTE REGISTRADO</label>
                <input 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', background: '#f8fafc' }}
                  placeholder="Escribe el nombre, empresa o email..."
                  value={clienteSeleccionado ? (`${clienteSeleccionado.nombre || clienteSeleccionado.razonSocial || clienteSeleccionado.empresa || clienteSeleccionado.email} ${clienteSeleccionado.apellido || ""}`.trim()) : clienteSearch}
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
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>TÉCNICO RESPONSABLE</label>
              <select 
                value={tecnico?.uid || tecnico?.id || ""} 
                onChange={e => {
                  const t = allTecnicos.find(x => x.id === e.target.value);
                  if (t) setTecnico({ uid: t.id, nombre: t.nombre || t.email });
                }}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', background: '#f8fafc' }}
              >
                <option value="">-- Seleccionar Técnico --</option>
                {allTecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre || t.email}</option>)}
                {/* Fallback para el usuario actual si no está en la lista de técnicos */}
                {!allTecnicos.find(t => t.id === tecnico?.uid) && tecnico && (
                  <option value={tecnico.uid}>{tecnico.nombre} (Actual)</option>
                )}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>TALLER</label>
              <input value={tallerNombre} onChange={e => setTallerNombre(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', background: '#f8fafc' }} />
            </div>
            <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>NOMBRE / CLIENTE</label>
                <input
                  value={nombre}
                  readOnly={!!clienteSeleccionado}
                  onChange={e => { if (clienteSeleccionado) return; setNombre(e.target.value); }}
                  placeholder="Nombre o Razón Social"
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', ...(clienteSeleccionado ? { background: '#f1f5f9', color: '#334155', cursor: 'default' } : {}) }}
                />
                {clienteSeleccionado && <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px' }}>Bloqueado: cliente registrado seleccionado. Usá la ✕ de arriba para cambiarlo.</div>}
            </div>
            <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>EMPRESA (OPCIONAL)</label>
                <input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nombre Fantasía o Empresa" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
            <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>DNI / CUIT</label>
                <input value={dniCuit} onChange={e => setDniCuit(e.target.value)} placeholder="DNI o CUIT" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
            <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>TELÉFONO</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Teléfono de contacto" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
            <div className="grid-column-span-2">
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>DOMICILIO</label>
                <input value={domicilio} onChange={e => setDomicilio(e.target.value)} placeholder="Dirección completa" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
            <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.7rem', color: '#999', marginBottom: '5px' }}>RECIBIDO POR</label>
                <input value={quienRecibe} onChange={e => setQuienRecibe(e.target.value)} placeholder="Nombre de quien recibe" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
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
          <div key={item.id} className="form-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px', alignItems: 'center' }}>
              <span style={{ fontWeight: 900, color: 'var(--primary-red)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} /> EXTINTOR #{idx + 1}
              </span>
              <button onClick={() => setItems(items.filter((_, i) => i !== idx))} 
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                <Trash2 size={14} /> Eliminar
              </button>
            </div>

            <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
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
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '5px' }}>SECTOR</label>
                <input value={item.sector} onChange={e => updateItem(idx, 'sector', e.target.value)} placeholder="Ej: Planta baja" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '5px' }}>AGENTE / TIPO</label>
                <select value={item.agente} onChange={e => updateItem(idx, 'agente', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                  <option value="ABC">Polvo químico seco ABC</option>
                  <option value="CO2">Co2 BC</option>
                  <option value="Agua">Agua A</option>
                  <option value="Espuma">Espuma AFFF AB</option>
                  <option value="K">Acetato de potasio K</option>
                  <option value="HCFC">HCFC ABC</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '5px' }}>BASE</label>
                <input value={item.base} onChange={e => updateItem(idx, 'base', e.target.value)} placeholder="Ej: Portátil" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
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
                {item.marca === "Otro" && (
                  <input
                    value={item.marcaOtro}
                    onChange={e => updateItem(idx, 'marcaOtro', e.target.value)}
                    placeholder="Especifique marca"
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', marginTop: '5px', fontSize: '0.8rem' }}
                  />
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '5px' }}>Nº FABRICACIÓN</label>
                <input value={item.nroFabricacion} onChange={e => updateItem(idx, 'nroFabricacion', e.target.value)} placeholder="Serie del cilindro" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '5px' }}>AÑO FABRICACIÓN</label>
                <input value={item.anioFab} onChange={e => updateItem(idx, 'anioFab', e.target.value)} placeholder="Ej: 2020" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
              </div>
            </div>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '8px' }}>CLASES DE FUEGO</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {["A", "B", "C", "D", "K"].map(clase => (
                    <button key={clase} type="button" onClick={() => toggleArrayItem(idx, 'claseFuego', clase)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', background: item.claseFuego.includes(clase) ? 'var(--primary-blue)' : '#fff', color: item.claseFuego.includes(clase) ? '#fff' : '#666', fontWeight: 800, flex: 1 }}>{clase}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '8px' }}>ESTADO CILINDRO</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => updateItem(idx, 'estadoCilindro', 'aprobado')} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', background: item.estadoCilindro === 'aprobado' ? '#dcfce7' : '#fff', flex: 1, fontWeight: 700 }}>Aprobado</button>
                  <button type="button" onClick={() => updateItem(idx, 'estadoCilindro', 'rechazado')} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd', background: item.estadoCilindro === 'rechazado' ? '#fee2e2' : '#fff', flex: 1, fontWeight: 700 }}>Rechazado</button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.65rem', color: '#999', marginBottom: '8px' }}>COMP. REEMPLAZADOS</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {componentesDisponibles.map(comp => (
                  <button key={comp} type="button" onClick={() => toggleArrayItem(idx, 'componentesReemplazados', comp)} style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid #ddd', fontSize: '0.75rem', background: item.componentesReemplazados.includes(comp) ? '#f1f5f9' : '#fff', fontWeight: 600 }}>{comp}</button>
                ))}
              </div>
            </div>

            <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.6rem', color: '#64748b', marginBottom: '5px' }}>PRESION INICIAL</label>
                <input value={item.presionInicial} onChange={e => updateItem(idx, 'presionInicial', e.target.value)} placeholder="psi/kg" style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.6rem', color: '#64748b', marginBottom: '5px' }}>PRESION FINAL</label>
                <input value={item.presionFinal} onChange={e => updateItem(idx, 'presionFinal', e.target.value)} placeholder="psi/kg" style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.6rem', color: '#64748b', marginBottom: '5px' }}>PESO INICIAL</label>
                <input value={item.pesoInicial} onChange={e => updateItem(idx, 'pesoInicial', e.target.value)} placeholder="kg" style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.6rem', color: '#64748b', marginBottom: '5px' }}>PESO FINAL</label>
                <input value={item.pesoFinal} onChange={e => updateItem(idx, 'pesoFinal', e.target.value)} placeholder="kg" style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
            </div>

            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '20px', padding: '15px', background: '#f1f5f9', borderRadius: '12px' }}>
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
      
      {/* SECCIÓN FIRMA TÉCNICO */}
      <div className="form-card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '15px', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PenTool size={20} /> Firma del Técnico Responsable
        </h3>
        <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '15px' }}>Firma en el recuadro para validar el certificado técnico.</p>
        
        <div id="sig-container" style={{ border: '2px dashed #ddd', borderRadius: '12px', background: '#fcfcfc', marginBottom: '15px', overflow: 'hidden' }}>
            {isMounted && (
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="#002244" 
                canvasProps={{ 
                  width: canvasWidth, 
                  height: 180, 
                  className: 'sigCanvas',
                  style: { display: 'block' } 
                }} 
              />
            )}
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <button type="button" onClick={() => sigCanvas.current.clear()} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <RotateCcw size={14} /> Borrar firma
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
        <button onClick={() => router.back()} style={{ padding: '18px', borderRadius: '12px', border: '1px solid #ddd', background: '#fff', fontWeight: 700 }}>Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="btn-red" 
          style={{ padding: '20px', fontSize: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
            {saving ? "Guardando..." : <><Save size={22} /> Guardar Ficha Técnica</>}
        </button>
      </div>

      {showNewClientModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "35px", maxWidth: "600px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                <Plus size={24} strokeWidth={3} /> Registrar Nuevo Cliente
              </h2>
              <button 
                onClick={() => setShowNewClientModal(false)} 
                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: '0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >✕</button>
            </div>
            
            <div style={{ display: "grid", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Nombre *</label>
                  <input type="text" value={newClientData.nombre} onChange={e => setNewClientData({...newClientData, nombre: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} placeholder="Nombre" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Apellido</label>
                  <input type="text" value={newClientData.apellido} onChange={e => setNewClientData({...newClientData, apellido: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} placeholder="Apellido" />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Email *</label>
                <input type="email" value={newClientData.email} onChange={e => setNewClientData({...newClientData, email: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} placeholder="correo@ejemplo.com" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Empresa / R. Social</label>
                  <input type="text" value={newClientData.empresa} onChange={e => setNewClientData({...newClientData, empresa: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} placeholder="Empresa" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>DNI / CUIT</label>
                  <input type="text" value={newClientData.dniCuit} onChange={e => setNewClientData({...newClientData, dniCuit: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} placeholder="Número de CUIT" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Teléfono</label>
                  <input type="text" value={newClientData.telefono} onChange={e => setNewClientData({...newClientData, telefono: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} placeholder="+54..." />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Cargo</label>
                  <input type="text" value={newClientData.cargo} onChange={e => setNewClientData({...newClientData, cargo: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} placeholder="Responsable / Encargado" />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Dirección Principal</label>
                <input type="text" value={newClientData.direccion} onChange={e => setNewClientData({...newClientData, direccion: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} placeholder="Calle 123, Ciudad" />
              </div>

              {/* SECCIÓN SEDES */}
              <div style={{ borderTop: "1px solid #eee", paddingTop: "20px", marginTop: "10px" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 900, color: "var(--primary-blue)", marginBottom: "15px", textTransform: "uppercase" }}>Sedes / Consorcios</h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
                  {newClientData.sedes.map((s: any) => (
                    <div key={s.id} style={{ background: "#f8fafc", padding: "10px 15px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" }}>{s.nombre}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{s.direccion}</div>
                      </div>
                      <button type="button" onClick={() => setNewClientData({...newClientData, sedes: newClientData.sedes.filter(x => x.id !== s.id)})} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ background: "#f1f5f9", padding: "15px", borderRadius: "12px" }}>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <input id="new-sede-nombre" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }} placeholder="Nombre de la Sede" />
                    <input id="new-sede-direccion" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }} placeholder="Dirección" />
                    <button 
                      type="button" 
                      onClick={() => {
                        const n = (document.getElementById("new-sede-nombre") as HTMLInputElement).value;
                        const d = (document.getElementById("new-sede-direccion") as HTMLInputElement).value;
                        if (!n) { showToast("Nombre de sede obligatorio", "error"); return; }
                        const newSede = { id: Math.random().toString(36).substr(2, 9), nombre: n, direccion: d };
                        setNewClientData({...newClientData, sedes: [...newClientData.sedes, newSede]});
                        (document.getElementById("new-sede-nombre") as HTMLInputElement).value = "";
                        (document.getElementById("new-sede-direccion") as HTMLInputElement).value = "";
                      }}
                      style={{ background: "var(--primary-blue)", color: "#fff", border: "none", padding: "10px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}>
                      + Agregar Sede
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "35px" }}>
              <button onClick={() => setShowNewClientModal(false)} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 700, color: "#64748b", cursor: "pointer" }}>Cancelar</button>
              <button 
                onClick={async () => {
                  if (!newClientData.nombre || !newClientData.email) { showToast("Nombre y Email son obligatorios.", "error"); return; }
                  try {
                    const docRef = await addDoc(collection(db, "usuarios"), {
                      ...newClientData,
                      rol: "cliente",
                      fechaCreacion: new Date().toISOString(),
                      updatedAt: serverTimestamp()
                    });
                    const created = { id: docRef.id, ...newClientData };
                    setClientes(prev => [...prev, created]);
                    onSelectCliente(docRef.id);
                    setShowNewClientModal(false);
                    setNewClientData({ nombre: "", apellido: "", email: "", empresa: "", dniCuit: "", telefono: "", direccion: "", cargo: "", sedes: [] });
                  } catch (e) {
                    showToast("Error al crear cliente. Intentá de nuevo.", "error");
                  }
                }}
                className="btn-red" style={{ flex: 2, padding: "14px", borderRadius: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Crear y Seleccionar
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast {...toast} />
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
