"use client";
import { useEffect, useState, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, doc, setDoc, updateDoc, deleteDoc, getDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast, Toast } from "@/components/Toast";
import { ArrowLeft, Plus, Trash2, PackageCheck, PackageX } from "lucide-react";

interface HistorialItem {
  fecha: string;
  accion: "prestado" | "devuelto" | "creado";
  clienteNombre?: string;
  sedeNombre?: string;
}

interface Backup {
  id: string;
  numero: string;
  estado: "deposito" | "prestado";
  clienteId?: string | null;
  clienteNombre?: string;
  sedeNombre?: string;
  observaciones?: string;
  historial?: HistorialItem[];
}

const cardSt: React.CSSProperties = { background: "#fff", borderRadius: "14px", border: "1px solid #eee", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", padding: "20px" };
const inputSt: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid #ddd", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" };
const labelSt: React.CSSProperties = { display: "block", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", color: "#666", marginBottom: "5px" };
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];

export default function BackupsPage() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [autorizado, setAutorizado] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<any[]>([]);

  const [nuevoNumero, setNuevoNumero] = useState("");
  const [creandoRango, setCreandoRango] = useState(false);
  const [rangoHasta, setRangoHasta] = useState("25");

  const [prestarId, setPrestarId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [clienteSel, setClienteSel] = useState<any>(null);
  const [sedeSel, setSedeSel] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [borrarId, setBorrarId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "usuarios", u.uid));
      const rol = snap.exists() ? snap.data().rol : "cliente";
      if (!["admin", "superadmin", "tecnico", "tecnicoTaller", "secretaria", "supervisor"].includes(rol)) {
        router.push("/admin"); return;
      }
      setAutorizado(true);
    });
    return () => unsub();
  }, [router]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [backupsSnap, clientesSnap] = await Promise.all([
        getDocs(query(collection(db, "matafuegos_backup"), orderBy("numero"))),
        getDocs(query(collection(db, "usuarios"))),
      ]);
      setBackups(backupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Backup))
        .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0) || a.numero.localeCompare(b.numero)));
      setClientes(clientesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((c: any) => c.rol === "cliente"));
    } catch (e) {
      console.error(e);
      showToast("No se pudo cargar el inventario de backups.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { if (autorizado) cargar(); }, [autorizado, cargar]);

  const crearBackup = async (numero: string) => {
    const n = numero.trim();
    if (!n) return false;
    if (backups.some(b => b.numero === n)) { showToast(`Ya existe el backup N° ${n}.`, "error"); return false; }
    await setDoc(doc(collection(db, "matafuegos_backup")), {
      numero: n, estado: "deposito", clienteId: null, clienteNombre: "", sedeNombre: "",
      historial: [{ fecha: hoy(), accion: "creado" }],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return true;
  };

  const agregarUno = async () => {
    if (await crearBackup(nuevoNumero)) { setNuevoNumero(""); await cargar(); showToast("Backup agregado", "success"); }
  };

  const crearRango = async () => {
    const hasta = Math.max(1, Math.floor(Number(rangoHasta) || 0));
    setCreandoRango(true);
    try {
      let creados = 0;
      for (let i = 1; i <= hasta; i++) {
        if (await crearBackup(String(i))) creados++;
      }
      await cargar();
      showToast(creados > 0 ? `Se crearon ${creados} backups nuevos.` : "No se creó ninguno: ya existían todos.", "success");
    } finally {
      setCreandoRango(false);
    }
  };

  const abrirPrestar = (b: Backup) => {
    setPrestarId(b.id); setBusqueda(""); setClienteSel(null); setSedeSel("");
  };

  const clientesFiltrados = clientes.filter(c =>
    busqueda.length < 2 ? false :
    `${c.nombre || ""} ${c.razonSocial || ""} ${c.empresa || ""} ${c.email || ""}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const confirmarPrestamo = async () => {
    if (!prestarId || !clienteSel) return;
    setGuardando(true);
    try {
      await updateDoc(doc(db, "matafuegos_backup", prestarId), {
        estado: "prestado",
        clienteId: clienteSel.id,
        clienteNombre: `${clienteSel.nombre || clienteSel.razonSocial || ""} ${clienteSel.apellido || ""}`.trim(),
        sedeNombre: sedeSel || "",
        historial: arrayUnion({ fecha: hoy(), accion: "prestado", clienteNombre: `${clienteSel.nombre || clienteSel.razonSocial || ""}`.trim(), sedeNombre: sedeSel || "" }),
        updatedAt: serverTimestamp(),
      });
      setPrestarId(null);
      await cargar();
      showToast("Backup marcado como prestado", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al guardar. Intentá de nuevo.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const marcarDevuelto = async (b: Backup) => {
    try {
      await updateDoc(doc(db, "matafuegos_backup", b.id), {
        estado: "deposito", clienteId: null, clienteNombre: "", sedeNombre: "",
        historial: arrayUnion({ fecha: hoy(), accion: "devuelto", clienteNombre: b.clienteNombre || "", sedeNombre: b.sedeNombre || "" }),
        updatedAt: serverTimestamp(),
      });
      await cargar();
      showToast("Backup marcado como devuelto", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al guardar. Intentá de nuevo.", "error");
    }
  };

  const eliminar = async () => {
    if (!borrarId) return;
    try {
      await deleteDoc(doc(db, "matafuegos_backup", borrarId));
      setBackups(prev => prev.filter(b => b.id !== borrarId));
      showToast("Backup eliminado", "success");
    } catch (e) {
      console.error(e);
      showToast("No se pudo eliminar.", "error");
    } finally {
      setBorrarId(null);
    }
  };

  if (!autorizado) return <div style={{ padding: "100px", textAlign: "center" }}>Cargando...</div>;

  const enDeposito = backups.filter(b => b.estado === "deposito").length;
  const prestados = backups.filter(b => b.estado === "prestado").length;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", paddingBottom: "80px" }}>
      <header style={{ marginBottom: "24px" }}>
        <button onClick={() => router.push("/admin/planillas/matafuegos")}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#666", fontWeight: 700, cursor: "pointer", marginBottom: "10px", padding: 0 }}>
          <ArrowLeft size={18} /> Volver
        </button>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)", margin: 0 }}>Extintores Backup</h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Equipos de ARIFA que se prestan a clientes mientras se recarga el suyo.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        <div style={cardSt}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#15803d", textTransform: "uppercase" }}>En depósito</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#15803d" }}>{enDeposito}</div>
        </div>
        <div style={cardSt}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#b45309", textTransform: "uppercase" }}>Prestados</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#b45309" }}>{prestados}</div>
        </div>
      </div>

      <div style={{ ...cardSt, marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: "160px" }}>
          <label style={labelSt}>Agregar un backup (N°)</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input value={nuevoNumero} onChange={e => setNuevoNumero(e.target.value)} placeholder="Ej: 26" style={inputSt} />
            <button onClick={agregarUno} className="btn-blue" style={{ padding: "10px 16px", borderRadius: "8px", fontWeight: 800, whiteSpace: "nowrap" }}>
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div style={{ minWidth: "220px" }}>
          <label style={labelSt}>O crear del 1 al N (salta los que ya existen)</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input type="number" min="1" value={rangoHasta} onChange={e => setRangoHasta(e.target.value)} style={{ ...inputSt, width: "80px" }} />
            <button onClick={crearRango} disabled={creandoRango} style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              {creandoRango ? "Creando..." : "Crear rango"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "50px", textAlign: "center", color: "#999" }}>Cargando...</div>
      ) : backups.length === 0 ? (
        <div style={{ ...cardSt, textAlign: "center", color: "#999", padding: "40px" }}>Todavía no cargaste ningún backup. Usá &quot;Crear rango&quot; para cargar del 1 al 25, por ejemplo.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {backups.map(b => (
            <div key={b.id} style={{ ...cardSt, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <span style={{ background: b.estado === "deposito" ? "#dcfce7" : "#fef3c7", color: b.estado === "deposito" ? "#166534" : "#b45309", fontWeight: 900, fontSize: "0.95rem", padding: "6px 14px", borderRadius: "10px", minWidth: "50px", textAlign: "center" }}>
                  N° {b.numero}
                </span>
                <div>
                  {b.estado === "deposito" ? (
                    <div style={{ fontWeight: 700, color: "#15803d", fontSize: "0.85rem" }}>En depósito</div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700, color: "#b45309", fontSize: "0.85rem" }}>Prestado a {b.clienteNombre || "—"}</div>
                      {b.sedeNombre && <div style={{ fontSize: "0.75rem", color: "#888" }}>📍 {b.sedeNombre}</div>}
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {b.estado === "deposito" ? (
                  <button onClick={() => abrirPrestar(b)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #fdba74", background: "#fff7ed", color: "#c2410c", fontWeight: 700, cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    <PackageX size={15} /> Prestar
                  </button>
                ) : (
                  <button onClick={() => marcarDevuelto(b)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #86efac", background: "#f0fdf4", color: "#15803d", fontWeight: 700, cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    <PackageCheck size={15} /> Marcar devuelto
                  </button>
                )}
                <button onClick={() => setBorrarId(b.id)} title="Eliminar backup" style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL PRESTAR */}
      {prestarId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "26px", maxWidth: "440px", width: "100%" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--primary-blue)", margin: "0 0 16px" }}>
              Prestar backup N° {backups.find(b => b.id === prestarId)?.numero}
            </h3>
            <div style={{ position: "relative", marginBottom: "14px" }}>
              <label style={labelSt}>Cliente</label>
              <input
                value={clienteSel ? `${clienteSel.nombre || clienteSel.razonSocial || clienteSel.empresa} ${clienteSel.apellido || ""}`.trim() : busqueda}
                onChange={e => { setBusqueda(e.target.value); setClienteSel(null); }}
                placeholder="Escribí el nombre, empresa o email..."
                style={inputSt}
              />
              {clientesFiltrados.length > 0 && !clienteSel && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "10px", zIndex: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "180px", overflowY: "auto", marginTop: "5px" }}>
                  {clientesFiltrados.map(c => (
                    <div key={c.id} onClick={() => { setClienteSel(c); setSedeSel(""); }}
                      style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}>
                      <div style={{ fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.85rem" }}>{c.nombre || c.razonSocial || c.email}</div>
                      {c.empresa && <div style={{ fontSize: "0.75rem", color: "#888" }}>{c.empresa}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {clienteSel?.sedes?.length > 0 && (
              <div style={{ marginBottom: "14px" }}>
                <label style={labelSt}>Sede (opcional)</label>
                <select value={sedeSel} onChange={e => setSedeSel(e.target.value)} style={{ ...inputSt, background: "#fff" }}>
                  <option value="">-- Sin especificar --</option>
                  {clienteSel.sedes.map((s: any) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button onClick={() => setPrestarId(null)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #ddd", background: "#f8f9fa", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmarPrestamo} disabled={!clienteSel || guardando} className="btn-red" style={{ flex: 2, padding: "12px", borderRadius: "10px", fontWeight: 800, opacity: !clienteSel ? 0.5 : 1 }}>
                {guardando ? "Guardando..." : "Confirmar préstamo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAR ELIMINAR */}
      {borrarId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "26px", maxWidth: "380px", width: "100%" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "10px" }}>¿Eliminar este backup del inventario?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "0.88rem" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setBorrarId(null)} style={{ flex: 1, padding: "11px", borderRadius: "8px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={eliminar} className="btn-red" style={{ flex: 1, padding: "11px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
      <Toast {...toast} />
    </div>
  );
}
