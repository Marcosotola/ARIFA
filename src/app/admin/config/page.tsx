"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function ConfigPage() {
  const [user, setUser] = useState<any>(null);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDoc = await getDoc(doc(db, "usuarios", u.uid));
        if (userDoc.exists()) {
          setNombre(userDoc.data().nombre || "");
        }
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await updateDoc(doc(db, "usuarios", user.uid), {
        nombre: nombre
      });
      setMessage("✓ Perfil actualizado con éxito.");
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("✗ Error al actualizar.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontStyle: 'italic', color: 'var(--text-muted)' }}>Cargando perfil...</div>;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ marginBottom: "35px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Configuración de Perfil</h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px", fontSize: "0.95rem" }}>
          Administra tus datos personales y preferencias de cuenta.
        </p>
      </header>

      <div style={{ background: "#fff", borderRadius: "12px", padding: "35px", boxShadow: "0 4px 15px rgba(0,0,0,0.04)", border: "1px solid #eee" }}>
        <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-blue)', textTransform: 'uppercase', marginBottom: '8px' }}>Nombre Completo</label>
              <input 
                type="text" 
                value={nombre} 
                onChange={(e) => setNombre(e.target.value)} 
                required 
                placeholder="Tu nombre"
                style={{ width: "100%", padding: "12px 15px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "1rem" }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-blue)', opacity: 0.6, textTransform: 'uppercase', marginBottom: '8px' }}>Email (No editable)</label>
              <input 
                type="email" 
                disabled 
                value={user?.email || ""} 
                style={{ width: "100%", padding: "12px 15px", borderRadius: "8px", border: "1px solid #eee", fontSize: "1rem", color: '#999', background: '#fafafa' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '10px' }}>
            <button 
              type="submit" 
              className="btn-red" 
              disabled={saving} 
              style={{ padding: '14px 40px', fontSize: '0.9rem', fontWeight: 800 }}
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
            {message && (
              <span style={{ 
                marginLeft: '15px', 
                fontSize: '0.9rem', 
                fontWeight: 700, 
                color: message.startsWith('✓') ? '#2e7d32' : 'var(--primary-red)',
                transition: '0.3s'
              }}>
                {message}
              </span>
            )}
          </div>
        </form>
      </div>

      <div style={{ marginTop: "40px", padding: "30px", background: "var(--bg-light)", borderRadius: "12px", border: "1px solid #ddd" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "15px" }}>Seguridad de la cuenta</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px", lineHeight: 1.6 }}>
          Para cambiar tu contraseña, debés cerrar sesión e iniciar el proceso de recuperación de contraseña en el panel de ingreso.
        </p>
        <button 
          onClick={() => auth.signOut()}
          style={{ background: 'none', border: '1px solid var(--primary-red)', color: 'var(--primary-red)', padding: '10px 20px', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          Cerrar Sesión para Cambiar Contraseña
        </button>
      </div>
    </div>
  );
}
