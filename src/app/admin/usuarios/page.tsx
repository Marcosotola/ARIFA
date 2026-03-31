"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    fetchUsuarios();
    return () => unsub();
  }, []);

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "usuarios"), orderBy("fechaCreacion", "desc"));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsuarios(docs);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

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
        nombre: editingUser.nombre,
        rol: editingUser.rol
      });
      setUsuarios(usuarios.map(u => u.id === editingUser.id ? editingUser : u));
      setIsModalOpen(false);
    } catch (e) {
      console.error("Error updating user:", e);
      alert("Error al actualizar usuario");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.uid) {
      alert("No podés eliminar tu propia cuenta.");
      return;
    }
    if (!confirm("¿Estás seguro de que querés eliminar este usuario? Esta acción no se puede deshacer.")) {
      return;
    }
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "usuarios", id));
      setUsuarios(usuarios.filter(u => u.id !== id));
    } catch (e) {
      console.error("Error deleting user:", e);
      alert("Error al eliminar");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontStyle: 'italic', color: 'var(--text-muted)' }}>Cargando usuarios...</div>;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", position: 'relative' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Gestión de Usuarios</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px", fontSize: "0.95rem" }}>
            Administra los roles y estados de los usuarios en ARIFA.
          </p>
        </div>
      </header>

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", overflow: "hidden", border: "1px solid #eee" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafafa", borderBottom: "1.5px solid #eee" }}>
              <tr>
                <th style={{ textAlign: "left", padding: "15px 20px", fontSize: "0.75rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px" }}>Usuario</th>
                <th style={{ textAlign: "left", padding: "15px 20px", fontSize: "0.75rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px" }}>Email</th>
                <th style={{ textAlign: "left", padding: "15px 20px", fontSize: "0.75rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px" }}>Rol</th>
                <th style={{ textAlign: "right", padding: "15px 20px", fontSize: "0.75rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.5px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f8f8f8" }}>
                  <td style={{ padding: "15px 20px" }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-light)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--primary-blue)', fontWeight:800 }}>
                        {u.nombre?.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.9rem" }}>{u.nombre}</div>
                    </div>
                  </td>
                  <td style={{ padding: "15px 20px", fontSize: "0.85rem", color: "var(--text-muted)" }}>{u.email}</td>
                  <td style={{ padding: "15px 20px" }}>
                    <span style={{ 
                      fontSize: "0.65rem", fontWeight: 900, padding: "4px 10px", borderRadius: "20px", 
                      background: u.rol === "admin" ? "rgba(163, 31, 29, 0.1)" : u.rol === 'tecnico' ? "rgba(0, 34, 68, 0.1)" : "rgba(0,0,0,0.05)", 
                      color: u.rol === "admin" ? "var(--primary-red)" : u.rol === 'tecnico' ? "var(--primary-blue)" : "#666",
                      textTransform: "uppercase", letterSpacing: '0.5px'
                    }}>
                      {u.rol}
                    </span>
                  </td>
                  <td style={{ padding: "15px 20px", textAlign: "right", whiteSpace: 'nowrap' }}>
                    <button 
                      onClick={() => handleEdit(u)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px' }} title="Editar"
                    >📝</button>
                    <button 
                      onClick={() => handleDelete(u.id)}
                      disabled={u.id === currentUser?.uid}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px', marginLeft: '5px', opacity: u.id === currentUser?.uid ? 0.3 : 1 }} title="Eliminar"
                    >🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', padding: '35px', borderRadius: '12px', width: '100%', maxWidth: '450px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-blue)', marginBottom: '25px' }}>Editar Usuario</h2>
            
            <form onSubmit={saveUser} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--text-muted)' }}>Nombre</label>
                <input 
                  type="text" 
                  value={editingUser.nombre} 
                  onChange={(e) => setEditingUser({...editingUser, nombre: e.target.value})}
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--text-muted)' }}>Rol de Acceso</label>
                <select 
                  value={editingUser.rol} 
                  onChange={(e) => setEditingUser({...editingUser, rol: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background:'#fff' }}
                >
                  <option value="cliente">Cliente</option>
                  <option value="tecnico">Técnico</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: 'none', fontWeight: 700, cursor: 'pointer' }}
                >Cancelar</button>
                <button 
                  type="submit" 
                  disabled={actionLoading}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--primary-red)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
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
