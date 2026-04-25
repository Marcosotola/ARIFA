"use client";
import { useState } from "react";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────
type Mode = "login" | "register" | "complete_profile";

const CARGOS = ["Propietario", "Gerente", "Responsable de Seguridad", "Encargado", "Administrativo", "Técnico", "Otro"];

// ─── Phone formatter ──────────────────────────────────────────────────────────
function formatWhatsApp(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("549")) return `+${digits}`;
  if (digits.startsWith("54")) return `+549${digits.slice(2)}`;
  if (digits.startsWith("0")) return `+549${digits.slice(1)}`;
  return `+549${digits}`;
}

const inputSt: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: "8px",
  border: "1.5px solid #ddd", fontSize: "0.93rem", outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s",
};
const labelSt: React.CSSProperties = {
  display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#555",
  marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px",
};
const gridSt: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" };

// ─── Shared profile form ───────────────────────────────────────────────────────
const ProfileFields = ({ 
  nombre, setNombre, apellido, setApellido, empresa, setEmpresa, 
  direccion, setDireccion, telefono, setTelefono, cargo, setCargo 
}: any) => (
  <>
    <div style={gridSt}>
      <div>
        <label style={labelSt}>Nombre *</label>
        <input style={inputSt} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan" required />
      </div>
      <div>
        <label style={labelSt}>Apellido *</label>
        <input style={inputSt} value={apellido} onChange={e => setApellido(e.target.value)} placeholder="Ej: García" required />
      </div>
    </div>
    <div>
      <label style={labelSt}>Empresa / Razón Social</label>
      <input style={inputSt} value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Ej: ABC S.A." />
    </div>
    <div>
      <label style={labelSt}>Dirección</label>
      <input style={inputSt} value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Ej: Av. Colón 1200, Córdoba" />
    </div>
    <div>
      <label style={labelSt}>Teléfono / WhatsApp</label>
      <input style={inputSt} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 3514123456 (se guarda +549...)" />
      {telefono && (
        <span style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: "4px", display: "block" }}>
          📱 Se guardará como: {formatWhatsApp(telefono)}
        </span>
      )}
    </div>
    <div>
      <label style={labelSt}>Cargo</label>
      <select style={{ ...inputSt, background: "#fff" }} value={cargo} onChange={e => setCargo(e.target.value)}>
        <option value="">Seleccionar...</option>
        {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  </>
);

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register / profile fields
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cargo, setCargo] = useState("");

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured) { alert("Firebase no configurado."); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured) { alert("Firebase no configurado."); return; }
    if (!nombre.trim() || !apellido.trim()) { alert("Nombre y Apellido son obligatorios."); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        email,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        empresa: empresa.trim(),
        direccion: direccion.trim(),
        telefono: formatWhatsApp(telefono),
        cargo: cargo.trim(),
        rol: "cliente",
        perfilCompleto: true,
        fechaCreacion: new Date().toISOString(),
      });
      router.push("/admin");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    if (!isFirebaseConfigured) { alert("Firebase no configurado."); return; }
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (!userDoc.exists() || !userDoc.data()?.perfilCompleto) {
        const existing = userDoc.data() || {};
        setNombre(existing.nombre || user.displayName?.split(" ")[0] || "");
        setApellido(existing.apellido || user.displayName?.split(" ").slice(1).join(" ") || "");
        setEmpresa(existing.empresa || "");
        setDireccion(existing.direccion || "");
        setTelefono(existing.telefono || "");
        setCargo(existing.cargo || "");
        setPendingUid(user.uid);
        if (!userDoc.exists()) {
          await setDoc(doc(db, "usuarios", user.uid), {
            email: user.email,
            nombre: user.displayName?.split(" ")[0] || "",
            rol: "cliente",
            perfilCompleto: false,
            fechaCreacion: new Date().toISOString(),
          });
        }
        setMode("complete_profile");
      } else {
        router.push("/admin");
      }
    } catch (err: any) {
      alert("Error Google: " + err.message);
    } finally { setLoading(false); }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !apellido.trim()) { alert("Nombre y Apellido son obligatorios."); return; }
    const uid = pendingUid || auth.currentUser?.uid;
    if (!uid) { alert("Error de sesión."); return; }
    setLoading(true);
    try {
      await updateDoc(doc(db, "usuarios", uid), {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        empresa: empresa.trim(),
        direccion: direccion.trim(),
        telefono: formatWhatsApp(telefono),
        cargo: cargo.trim(),
        perfilCompleto: true,
        updatedAt: new Date().toISOString(),
      });
      router.push("/admin");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #001a3a 0%, #002f6c 60%, #003580 100%)", padding: "20px" }}>
      <div style={{ background: "#fff", padding: "40px", borderRadius: "16px", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", width: "100%", maxWidth: mode === "register" ? "560px" : "420px", transition: "max-width 0.3s" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--primary-blue)", letterSpacing: "2px" }}>ARIFA</div>
          <div style={{ fontSize: "0.75rem", color: "#888", letterSpacing: "1px", marginTop: "4px" }}>INGENIERÍA EN SEGURIDAD CONTRA INCENDIOS</div>
        </div>

        {mode === "login" && (
          <>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "22px", textAlign: "center" }}>Ingresar al Panel</h1>
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelSt}>Email</label>
                <input type="email" required style={inputSt} value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
              </div>
              <div>
                <label style={labelSt}>Contraseña</label>
                <input type="password" required style={inputSt} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading} className="btn-red" style={{ width: "100%", padding: "14px", marginTop: "4px" }}>
                {loading ? "Ingresando..." : "Entrar"}
              </button>
            </form>

            <div style={{ margin: "20px 0", display: "flex", alignItems: "center", gap: "12px" }}>
              <hr style={{ flex: 1, border: "none", borderTop: "1px solid #eee" }} />
              <span style={{ color: "#aaa", fontSize: "0.82rem" }}>o continuar con</span>
              <hr style={{ flex: 1, border: "none", borderTop: "1px solid #eee" }} />
            </div>

            <button onClick={handleGoogle} disabled={loading}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1.5px solid #ddd", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer", fontWeight: 600, fontSize: "0.92rem", color: "#333" }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
              Google
            </button>

            <p style={{ textAlign: "center", marginTop: "22px", fontSize: "0.9rem", color: "#666" }}>
              ¿No tenés cuenta?{" "}
              <button onClick={() => setMode("register")} style={{ color: "var(--primary-red)", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                Registrarse
              </button>
            </p>
          </>
        )}

        {mode === "register" && (
          <>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "22px", textAlign: "center" }}>Crear Cuenta</h1>
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={gridSt}>
                <div>
                  <label style={labelSt}>Email *</label>
                  <input type="email" required style={inputSt} value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
                </div>
                <div>
                  <label style={labelSt}>Contraseña *</label>
                  <input type="password" required minLength={6} style={inputSt} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mín. 6 caracteres" />
                </div>
              </div>
              <ProfileFields 
                nombre={nombre} setNombre={setNombre} 
                apellido={apellido} setApellido={setApellido} 
                empresa={empresa} setEmpresa={setEmpresa} 
                direccion={direccion} setDireccion={setDireccion} 
                telefono={telefono} setTelefono={setTelefono} 
                cargo={cargo} setCargo={setCargo} 
              />
              <button type="submit" disabled={loading} className="btn-red" style={{ width: "100%", padding: "14px", marginTop: "4px" }}>
                {loading ? "Registrando..." : "Crear mi cuenta"}
              </button>
            </form>
            <p style={{ textAlign: "center", marginTop: "18px", fontSize: "0.9rem", color: "#666" }}>
              ¿Ya tenés cuenta?{" "}
              <button onClick={() => setMode("login")} style={{ color: "var(--primary-red)", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                Ingresar
              </button>
            </p>
          </>
        )}

        {mode === "complete_profile" && (
          <>
            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <div style={{ fontSize: "2rem" }}>👤</div>
              <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary-blue)", marginTop: "8px" }}>Completar perfil</h1>
              <p style={{ color: "#777", fontSize: "0.88rem", marginTop: "6px" }}>Completá tus datos para continuar.</p>
            </div>
            <form onSubmit={handleCompleteProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <ProfileFields 
                nombre={nombre} setNombre={setNombre} 
                apellido={apellido} setApellido={setApellido} 
                empresa={empresa} setEmpresa={setEmpresa} 
                direccion={direccion} setDireccion={setDireccion} 
                telefono={telefono} setTelefono={setTelefono} 
                cargo={cargo} setCargo={setCargo} 
              />
              <button type="submit" disabled={loading} className="btn-red" style={{ width: "100%", padding: "14px", marginTop: "4px" }}>
                {loading ? "Guardando..." : "Guardar y Continuar →"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
