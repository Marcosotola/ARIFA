"use client";
import { useState } from "react";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured) {
      alert("Firebase no está configurado. Revisa tu archivo .env.local.");
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        // Default role: cliente
        await setDoc(doc(db, "usuarios", userCred.user.uid), {
          email,
          rol: "cliente",
          nombre: email.split("@")[0],
          fechaCreacion: new Date().toISOString(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/admin"); // Redirect to admin (we'll create it later)
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    if (!isFirebaseConfigured) {
      alert("Firebase no está configurado. Revisa tu archivo .env.local.");
      setLoading(false);
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "usuarios", user.uid), {
          email: user.email,
          rol: "cliente",
          nombre: user.displayName || user.email?.split("@")[0],
          fechaCreacion: new Date().toISOString(),
        });
      }
      router.push("/admin");
    } catch (error: any) {
      alert("Error con Google: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-padding" style={{ minHeight: "80vh", display: "flex", alignItems: "center", background: "var(--bg-light)" }}>
      <div className="container" style={{ maxWidth: "450px" }}>
        <div style={{ background: "#fff", padding: "40px", borderRadius: "8px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h1 style={{ color: "var(--primary-blue)", fontSize: "1.8rem", fontWeight: 800 }}>
              {isRegister ? "Crear Cuenta" : "Ingresar a ARIFA"}
            </h1>
            <p style={{ color: "var(--text-muted)", marginTop: "10px" }}>
              {isRegister ? "Registrate para gestionar tus pedidos" : "Accedé a tu panel de control"}
            </p>
          </div>

          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <div className="form-group">
              <label>Email</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="tu@email.com"
                style={{ width: "100%", padding: "12px", borderRadius: "4px", border: "1px solid var(--border-light)" }}
              />
            </div>
            <div className="form-group">
              <label>Contraseña</label>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••"
                style={{ width: "100%", padding: "12px", borderRadius: "4px", border: "1px solid var(--border-light)" }}
              />
            </div>

            <button type="submit" className="btn-red" disabled={loading} style={{ width: "100%", padding: "14px" }}>
              {loading ? "Procesando..." : (isRegister ? "Registrarse" : "Entrar")}
            </button>
          </form>

          <div style={{ margin: "20px 0", textAlign: "center", position: "relative" }}>
            <hr style={{ border: "0", borderTop: "1px solid var(--border-light)" }} />
            <span style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", background: "#fff", padding: "0 10px", color: "var(--text-muted)", fontSize: "0.85rem" }}>o continuar con</span>
          </div>

          <button 
            onClick={handleGoogle} 
            className="btn-outline-white" 
            style={{ width: "100%", padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "var(--text-dark)", borderColor: "var(--border-light)" }}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google
          </button>

          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "0.9rem" }}>
            {isRegister ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"} {" "}
            <button 
              onClick={() => setIsRegister(!isRegister)} 
              style={{ color: "var(--primary-red)", fontWeight: 700, background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              {isRegister ? "Ingresa aquí" : "Regístrate ahora"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
