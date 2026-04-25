"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, getDoc, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const CARGOS = ["Propietario", "Gerente", "Responsable de Seguridad", "Encargado", "Administrativo", "Técnico", "Otro"];

const inputSt: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.92rem" };
const labelSt: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: "6px", color: "var(--text-muted)" };

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
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
    return [u.nombre, u.apellido, u.empresa, u.email, u.cargo, u.telefono].some(v => v?.toLowerCase().includes(q));
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
      await updateDoc(doc(db, "usuarios", editingUser.id), {
        nombre: editingUser.nombre || "",
        apellido: editingUser.apellido || "",
        empresa: editingUser.empresa || "",
        direccion: editingUser.direccion || "",
        telefono: editingUser.telefono || "",
        cargo: editingUser.cargo || "",
        rol: editingUser.rol,
        updatedAt: new Date().toISOString(),
      });
      setUsuarios(usuarios.map(u => u.id === editingUser.id ? { ...u, ...editingUser } : u));
      setIsModalOpen(false);
    } catch (e) {
      alert("Error al actualizar usuario");
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

  return (
    <div style={{ width: "100%" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Gestión de Usuarios</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
            {usuariosVisibles.length} registro{usuariosVisibles.length !== 1 ? "s" : ""} encontrado{usuariosVisibles.length !== 1 ? "s" : ""}
          </p>
        </div>
        <input
          style={{ padding: "10px 16px", borderRadius: "8px", border: "1.5px solid #ddd", minWidth: "260px", fontSize: "0.92rem" }}
          placeholder="🔎 Buscar por nombre, empresa, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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
                      {u.empresa && <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{u.empresa}</div>}
                      {u.cargo && <div style={{ fontSize: "0.75rem", color: "#888" }}>{u.cargo}</div>}
                      {!u.empresa && !u.cargo && <span style={{ color: "#ccc" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      {u.telefono ? (
                        <a href={`https://wa.me/${u.telefono.replace("+", "")}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: "#16a34a", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
                          📱 {u.telefono}
                        </a>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 18px", fontSize: "0.85rem", color: "#555" }}>
                      {u.direccion || <span style={{ color: "#ccc" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 900, padding: "4px 10px", borderRadius: "20px", background: bg, color, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {u.rol || "cliente"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      {u.perfilCompleto
                        ? <span style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 700 }}>✓ Completo</span>
                        : <span style={{ fontSize: "0.72rem", color: "#f59e0b", fontWeight: 700 }}>⚠ Incompleto</span>}
                    </td>
                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                      {(currentUserRole === "admin" || currentUserRole === "superadmin") && (
                        <>
                          <button onClick={() => handleEdit(u)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "5px", borderRadius: "6px" }} title="Editar">✏️</button>
                          <button onClick={() => handleDelete(u.id)} disabled={u.id === currentUser?.uid}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "5px", marginLeft: "2px", opacity: u.id === currentUser?.uid ? 0.3 : 1 }} title="Eliminar">🗑️</button>
                        </>
                      )}
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
          <div style={{ background: "#fff", padding: "35px", borderRadius: "14px", width: "100%", maxWidth: "580px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary-blue)" }}>Editar Usuario</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#999" }}>✕</button>
            </div>

            <form onSubmit={saveUser} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
                <label style={labelSt}>Empresa / Razón Social</label>
                <input style={inputSt} value={editingUser.empresa || ""} onChange={e => setEditingUser({ ...editingUser, empresa: e.target.value })} />
              </div>

              <div>
                <label style={labelSt}>Dirección</label>
                <input style={inputSt} value={editingUser.direccion || ""} onChange={e => setEditingUser({ ...editingUser, direccion: e.target.value })} />
              </div>

              <div>
                <label style={labelSt}>Teléfono / WhatsApp</label>
                <input style={inputSt} value={editingUser.telefono || ""} onChange={e => setEditingUser({ ...editingUser, telefono: e.target.value })} placeholder="+549..." />
              </div>

              <div>
                <label style={labelSt}>Cargo</label>
                <select style={{ ...inputSt, background: "#fff" }} value={editingUser.cargo || ""} onChange={e => setEditingUser({ ...editingUser, cargo: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={labelSt}>Rol de Acceso</label>
                <select style={{ ...inputSt, background: "#fff" }} value={editingUser.rol} onChange={e => setEditingUser({ ...editingUser, rol: e.target.value })}>
                  <option value="cliente">Cliente</option>
                  <option value="tecnico">Técnico</option>
                  <option value="secretaria">Secretaria</option>
                  <option value="admin">Administrador</option>
                  {currentUserRole?.toLowerCase() === "superadmin" && <option value="superadmin">Superadmin</option>}
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button type="button" onClick={() => setIsModalOpen(false)}
                  style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ddd", background: "none", fontWeight: 700, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading}
                  style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: "var(--primary-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  {actionLoading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
