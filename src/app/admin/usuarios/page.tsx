"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, getDoc, doc, updateDoc, deleteDoc, query, orderBy, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { 
  UserPlus, 
  Edit, 
  Trash2, 
  Search, 
  Plus, 
  X, 
  Building2, 
  MapPin, 
  Phone, 
  Briefcase, 
  Shield, 
  CheckCircle2, 
  AlertCircle,
  Mail,
  User,
  ShieldCheck,
  UserCheck,
  MessageCircle,
  Eye
} from "lucide-react";

const CARGOS = ["Propietario", "Gerente", "Responsable de Seguridad", "Encargado", "Administrativo", "Técnico", "Otro"];

const inputSt: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.92rem" };
const labelSt: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: "6px", color: "var(--text-muted)" };

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) setCurrentUserRole(userDoc.data().rol);
      }
    });
    fetchUsuarios();
    return () => unsub();
  }, []);

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "usuarios"), orderBy("fechaCreacion", "desc"));
      const snapshot = await getDocs(q);
      setUsuarios(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error fetching users:", e);
    } finally {
      setLoading(false);
    }
  };

  const usuariosVisibles = usuarios.filter(u => {
    const isTargetSuper = u.rol?.toLowerCase() === "superadmin";
    const isMeSuper = currentUserRole?.toLowerCase() === "superadmin";
    if (!isMeSuper && isTargetSuper) return false;
    // search filter
    const q = search.toLowerCase();
    if (!q) return true;
    return [u.nombre, u.apellido, u.empresa, u.email, u.cargo, u.telefono, u.dniCuit].some(v => v?.toLowerCase().includes(q));
  });

  const handleEdit = (user: any) => {
    setEditingUser({ ...user });
    setIsModalOpen(true);
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionLoading(true);
    try {
      const payload = {
        nombre: editingUser.nombre || "",
        apellido: editingUser.apellido || "",
        empresa: editingUser.empresa || "",
        direccion: editingUser.direccion || "",
        telefono: editingUser.telefono || "",
        cargo: editingUser.cargo || "",
        dniCuit: editingUser.dniCuit || "",
        rol: editingUser.rol,
        email: editingUser.email || "",
        sedes: editingUser.sedes || [],
        updatedAt: new Date().toISOString(),
      };

      if (editingUser.id) {
        await updateDoc(doc(db, "usuarios", editingUser.id), payload);
      } else {
        await addDoc(collection(db, "usuarios"), {
          ...payload,
          fechaCreacion: new Date().toISOString(),
          perfilCompleto: true
        });
      }
      
      await fetchUsuarios();
      setIsModalOpen(false);
    } catch (e) {
      alert("Error al guardar usuario");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.uid) { alert("No podés eliminar tu propia cuenta."); return; }
    if (!confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "usuarios", id));
      setUsuarios(usuarios.filter(u => u.id !== id));
    } catch { alert("Error al eliminar"); }
    finally { setActionLoading(false); }
  };

  const rolColor = (rol: string) => {
    const r = rol?.toLowerCase();
    if (r === "superadmin") return { bg: "var(--primary-blue)", color: "#fff" };
    if (r === "admin") return { bg: "rgba(163,31,29,0.1)", color: "var(--primary-red)" };
    if (r === "tecnico") return { bg: "rgba(0,34,68,0.08)", color: "var(--primary-blue)" };
    if (r === "secretaria") return { bg: "rgba(245,158,11,0.12)", color: "#b45309" };
    return { bg: "rgba(0,0,0,0.05)", color: "#666" };
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Cargando usuarios...</div>;

  const openCreate = () => {
    setEditingUser({
      nombre: "",
      apellido: "",
      empresa: "",
      email: "",
      direccion: "",
      telefono: "",
      dniCuit: "",
      cargo: "",
      rol: "cliente",
      sedes: [],
      perfilCompleto: true,
      fechaCreacion: new Date().toISOString()
    });
    setIsModalOpen(true);
  };

  const addSede = () => {
    const nombre = (document.getElementById("sede-nombre") as HTMLInputElement)?.value;
    const direccion = (document.getElementById("sede-direccion") as HTMLInputElement)?.value;
    const rs = (document.getElementById("sede-rs") as HTMLInputElement)?.value;

    if (!nombre) {
      alert("El nombre es obligatorio para la sede.");
      return;
    }

    const nuevaSede = {
      id: Math.random().toString(36).substr(2, 9),
      nombre,
      direccion,
      razonSocial: rs || ""
    };

    setEditingUser({
      ...editingUser,
      sedes: [...(editingUser.sedes || []), nuevaSede]
    });

    // Reset inputs
    (document.getElementById("sede-nombre") as HTMLInputElement).value = "";
    (document.getElementById("sede-direccion") as HTMLInputElement).value = "";
    (document.getElementById("sede-rs") as HTMLInputElement).value = "";
  };

  const removeSede = (id: string) => {
    setEditingUser({
      ...editingUser,
      sedes: editingUser.sedes.filter((s: any) => s.id !== id)
    });
  };

  return (
    <div style={{ maxWidth: "1350px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Gestión de Usuarios</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
            {usuariosVisibles.length} registro{usuariosVisibles.length !== 1 ? "s" : ""} encontrado{usuariosVisibles.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', color: '#999' }} />
            <input
              style={{ ...inputSt, paddingLeft: '40px', minWidth: "260px" }}
              placeholder="Buscar por nombre, empresa, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {(currentUserRole === "admin" || currentUserRole === "superadmin") && (
            <button onClick={openCreate} className="btn-red" style={{ padding: "11px 22px", borderRadius: "8px", display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={18} strokeWidth={2.5} /> Nuevo Usuario
            </button>
          )}
        </div>
      </header>

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", overflow: "hidden", border: "1px solid #eee" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
            <thead style={{ background: "#fafafa", borderBottom: "1.5px solid #eee" }}>
              <tr>
                {["Usuario", "Empresa / Cargo", "Contacto", "Dirección", "Rol", "Perfil", "Acciones"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: "0.72rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuariosVisibles.map(u => {
                const { bg, color } = rolColor(u.rol);
                const fullName = [u.nombre, u.apellido].filter(Boolean).join(" ") || u.email?.split("@")[0];
                const initials = (u.nombre?.charAt(0) || u.email?.charAt(0) || "?").toUpperCase();
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f5f5f5" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafcff")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "var(--bg-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-blue)", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.92rem" }}>{fullName}</div>
                          <div style={{ fontSize: "0.78rem", color: "#888" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {u.empresa && (
                          <div style={{ fontWeight: 700, fontSize: "0.92rem", color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Building2 size={14} style={{ color: '#64748b' }} /> {u.empresa}
                          </div>
                        )}
                        {u.cargo && (
                          <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Briefcase size={13} /> {u.cargo}
                          </div>
                        )}
                        {!u.empresa && !u.cargo && <span style={{ color: "#ccc" }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      {u.telefono ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <a href={`https://wa.me/${u.telefono.replace("+", "")}`} target="_blank" rel="noopener noreferrer"
                            style={{ color: "#16a34a", textDecoration: "none", fontSize: "0.88rem", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <MessageCircle size={14} /> {u.telefono}
                          </a>
                        </div>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 18px", fontSize: "0.85rem", color: "#555" }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {u.direccion ? (
                          <div style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <MapPin size={14} style={{ color: '#64748b' }} /> {u.direccion}
                          </div>
                        ) : <span style={{ color: "#ccc" }}>—</span>}
                        {u.sedes?.length > 0 && (
                          <button 
                            onClick={() => setViewingUser(u)}
                            style={{ 
                              fontSize: "0.65rem", 
                              color: "var(--primary-blue)", 
                              fontWeight: 800, 
                              background: 'rgba(0,97,255,0.08)', 
                              border: '1px solid rgba(0,97,255,0.2)', 
                              borderRadius: '4px', 
                              padding: '2px 6px', 
                              width: 'fit-content', 
                              cursor: 'pointer',
                              marginTop: '2px'
                            }}
                          >
                            {u.sedes.length} sede{u.sedes.length !== 1 ? "s" : ""} cargada{u.sedes.length !== 1 ? "s" : ""}
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, padding: "5px 12px", borderRadius: "20px", background: bg, color, textTransform: "uppercase", letterSpacing: "0.5px", display: 'inline-flex', alignItems: 'center', gap: '5px', border: `1px solid ${color}33` }}>
                        <Shield size={12} /> {u.rol || "cliente"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      {u.perfilCompleto
                        ? <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle2 size={14} /> Completo</span>
                        : <span style={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}><AlertCircle size={14} /> Incompleto</span>}
                    </td>
                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setViewingUser(u)} 
                          style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", border: 'none', cursor: 'pointer' }} title="Ver Detalle">
                          <Eye size={18} strokeWidth={2.5} />
                        </button>
                        {(currentUserRole === "admin" || currentUserRole === "superadmin") && (
                          <>
                            <button onClick={() => handleEdit(u)} 
                              style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", border: 'none', cursor: 'pointer' }} title="Editar">
                              <Edit size={18} strokeWidth={2.5} />
                            </button>
                            <button onClick={() => handleDelete(u.id)} disabled={u.id === currentUser?.uid}
                              style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fef2f2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", border: 'none', cursor: 'pointer', opacity: u.id === currentUser?.uid ? 0.3 : 1 }} title="Eliminar">
                              <Trash2 size={18} strokeWidth={2.5} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {usuariosVisibles.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#bbb" }}>No hay usuarios que coincidan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Editar ── */}
      {isModalOpen && editingUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "#fff", padding: "35px", borderRadius: "14px", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0,97,255,0.1)', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={24} />
                </div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary-blue)", margin: 0 }}>
                  {editingUser.id ? "Editar Usuario" : "Nuevo Usuario"}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#ccc" }}>✕</button>
            </div>

            <form onSubmit={saveUser} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelSt}>Email *</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
                  <input style={{ ...inputSt, paddingLeft: '38px' }} type="email" required value={editingUser.email || ""} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} placeholder="email@ejemplo.com" />
                </div>
              </div>
              {/* Nombres */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelSt}>Nombre</label>
                  <input style={inputSt} value={editingUser.nombre || ""} onChange={e => setEditingUser({ ...editingUser, nombre: e.target.value })} />
                </div>
                <div>
                  <label style={labelSt}>Apellido</label>
                  <input style={inputSt} value={editingUser.apellido || ""} onChange={e => setEditingUser({ ...editingUser, apellido: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={labelSt}>Empresa / Razón Social Principal</label>
                <input style={inputSt} value={editingUser.empresa || ""} onChange={e => setEditingUser({ ...editingUser, empresa: e.target.value })} />
              </div>

              <div>
                <label style={labelSt}>DNI / CUIT</label>
                <input style={inputSt} value={editingUser.dniCuit || ""} onChange={e => setEditingUser({ ...editingUser, dniCuit: e.target.value })} placeholder="DNI o CUIT" />
              </div>

              <div>
                <label style={labelSt}>Dirección Principal</label>
                <input style={inputSt} value={editingUser.direccion || ""} onChange={e => setEditingUser({ ...editingUser, direccion: e.target.value })} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelSt}>Teléfono</label>
                  <input style={inputSt} value={editingUser.telefono || ""} onChange={e => setEditingUser({ ...editingUser, telefono: e.target.value })} placeholder="+549..." />
                </div>
                <div>
                  <label style={labelSt}>Cargo</label>
                  <select style={{ ...inputSt, background: "#fff" }} value={editingUser.cargo || ""} onChange={e => setEditingUser({ ...editingUser, cargo: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelSt}>Rol de Acceso</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <ShieldCheck size={16} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
                  <select style={{ ...inputSt, paddingLeft: '38px', background: "#fff" }} value={editingUser.rol} onChange={e => setEditingUser({ ...editingUser, rol: e.target.value })}>
                    <option value="cliente">Cliente</option>
                    <option value="tecnico">Técnico</option>
                    <option value="secretaria">Secretaria</option>
                    <option value="admin">Administrador</option>
                    {currentUserRole?.toLowerCase() === "superadmin" && <option value="superadmin">Superadmin</option>}
                  </select>
                </div>
              </div>

              {/* SECCIÓN DE SEDES */}
              { (editingUser.rol === "cliente" || editingUser.rol === "admin" || editingUser.rol === "superadmin") && (
                <div style={{ borderTop: "1.5px solid #eee", paddingTop: "20px", marginTop: "10px" }}>
                  <h3 style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px", textTransform: "uppercase" }}>Sedes / Obras / Consorcios</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                    {(editingUser.sedes || []).map((s: any) => (
                      <div key={s.id} style={{ background: "#f9f9f9", padding: "12px", borderRadius: "10px", border: "1px solid #eee", position: "relative" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--primary-blue)" }}>{s.nombre}</div>
                        <div style={{ fontSize: "0.78rem", color: "#666" }}>{s.direccion}</div>
                        {s.razonSocial && <div style={{ fontSize: "0.7rem", color: "#999", fontStyle: "italic", marginTop: "2px" }}>RS: {s.razonSocial}</div>}
                        <button type="button" onClick={() => removeSede(s.id)} 
                          style={{ position: "absolute", top: "10px", right: "10px", background: "#fee2e2", border: "none", color: "#ef4444", borderRadius: "6px", padding: "4px 8px", fontSize: "0.65rem", fontWeight: 800, cursor: "pointer" }}>
                          Eliminar
                        </button>
                      </div>
                    ))}
                    {(!editingUser.sedes || editingUser.sedes.length === 0) && (
                      <div style={{ textAlign: "center", padding: "15px", background: "#fafafa", borderRadius: "10px", border: "1px dashed #ddd", fontSize: "0.8rem", color: "#999" }}>
                        No hay sedes cargadas. El cliente usará su dirección principal.
                      </div>
                    )}
                  </div>

                  <div style={{ background: "#f8fafc", padding: "18px", borderRadius: "12px", border: "1.5px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.75rem", color: "var(--primary-blue)", marginBottom: "12px", textTransform: "uppercase", display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Plus size={14} /> Agregar Nueva Ubicación
                    </div>
                    <div style={{ display: "grid", gap: "10px" }}>
                      <input id="sede-nombre" style={inputSt} placeholder="Nombre (ej: Consorcio Edificio X)" />
                      <input id="sede-direccion" style={inputSt} placeholder="Dirección (opcional)" />
                      <input id="sede-rs" style={inputSt} placeholder="Razón Social específica (opcional)" />
                      <button type="button" onClick={addSede} className="btn-blue" style={{ marginTop: "5px", padding: "12px", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <MapPin size={18} /> Agregar Sede
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "15px", borderTop: "1px solid #eee", paddingTop: "20px" }}>
                <button type="button" onClick={() => setIsModalOpen(false)}
                  style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "none", fontWeight: 700, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading} className="btn-red"
                  style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", fontWeight: 700, cursor: "pointer", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {actionLoading ? "Guardando..." : <><UserCheck size={18} /> Guardar Cambios</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Modal Detalle (Ver Sedes) ── */}
      {viewingUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "20px" }}>
          <div style={{ background: "#fff", padding: "35px", borderRadius: "14px", width: "100%", maxWidth: "500px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(22,163,74,0.1)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Eye size={24} />
                </div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary-blue)", margin: 0 }}>Detalles del Cliente</h2>
              </div>
              <button onClick={() => setViewingUser(null)} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#ccc" }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 800, color: 'var(--primary-blue)', fontSize: '1.1rem', marginBottom: '4px' }}>
                  {[viewingUser.nombre, viewingUser.apellido].filter(Boolean).join(" ") || "Sin nombre"}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={14} /> {viewingUser.email}
                </div>
                {viewingUser.empresa && (
                  <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 600, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building2 size={14} /> {viewingUser.empresa}
                  </div>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>Sedes / Ubicaciones ({viewingUser.sedes?.length || 0})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {viewingUser.sedes?.length > 0 ? (
                    viewingUser.sedes.map((s: any) => (
                      <div key={s.id} style={{ background: '#fff', padding: '12px', borderRadius: '10px', border: '1px solid #eee', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ background: '#eff6ff', color: 'var(--primary-blue)', padding: '8px', borderRadius: '8px' }}>
                          <MapPin size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{s.nombre}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{s.direccion || "Sin dirección"}</div>
                          {s.razonSocial && <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>RS: {s.razonSocial}</div>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#94a3b8', fontSize: '0.9rem' }}>
                      No tiene sedes adicionales cargadas.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button onClick={() => setViewingUser(null)} className="btn-blue" style={{ width: '100%', marginTop: '30px', padding: '12px' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
