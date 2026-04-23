"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import Header from "./Header";
import Footer from "./Footer";
import Link from "next/link";

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [subscription, setSubscription] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true); // Nuevo: Estado de verificación

  const isAdminPath = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    setMounted(true);
    // 1. Role Check
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userDoc = await getDoc(doc(db, "usuarios", u.uid));
        if (userDoc.exists()) setRole(userDoc.data().rol);
      } else {
        setRole(null);
      }
    });

    // 2. Subscription Check
    const unsubSub = onSnapshot(doc(db, "configuracion", "suscripcion"), 
      (docSnap) => {
        if (docSnap.exists()) setSubscription(docSnap.data());
        setChecking(false); // Ya tenemos respuesta
      },
      (error) => {
        console.warn("Subscription check inhibited by permissions.");
        setChecking(false); // Aun con error, dejamos de bloquear la carga
      }
    );

    return () => {
      unsubAuth();
      unsubSub();
    };
  }, []);

  const isSuperAdmin = role?.toLowerCase() === "superadmin";
  const isExpired = subscription?.estado === "vencido" || (subscription?.vencimiento && subscription.vencimiento.toDate() < new Date());
  const isMaintenance = subscription?.estado === "mantenimiento";
  
  // Solo bloqueamos si el componente está montado y se cumplen las condiciones
  const shouldBlockGlobal = mounted && (isExpired || isMaintenance) && !isSuperAdmin && !isLoginPage && !isAdminPath;

  // Mientras está verificando con Firebase, no mostramos el sitio para evitar el "parpadeo"
  if (mounted && checking && !isLoginPage && !isAdminPath) {
    return <div style={{ background: '#fff', minHeight: '100vh' }} />;
  }

  return (
    <>
      {/* El sitio se renderiza siempre para evitar errores de Next.js */}
      {!isAdminPath && <Header />}
      <main>{children}</main>
      {!isAdminPath && <Footer />}

      {/* Pantalla de Mantenimiento (Capa superior) */}
      {shouldBlockGlobal && (
        <div className="maintenance-overlay">
          <style>{`
            .maintenance-overlay {
              position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
              background: #1a3a6b;
              z-index: 99999; display: flex; flex-direction: column;
              align-items: center; justify-content: center; padding: 20px;
              text-align: center; font-family: 'Inter', system-ui, sans-serif;
            }
            .maintenance-card {
              background: #ffffff;
              padding: 60px 40px; border-radius: 30px;
              max-width: 700px; width: 95%;
              box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
              animation: slideUp 0.6s ease-out;
            }
            .maintenance-icon {
              font-size: 70px; margin-bottom: 25px;
            }
            .maintenance-title {
              color: #1a3a6b; font-size: 3rem; font-weight: 800;
              margin-bottom: 15px; line-height: 1.1; letter-spacing: -0.02em;
            }
            .maintenance-line {
              width: 60px; height: 5px; background: #e63946;
              border-radius: 10px; margin: 0 auto 25px;
            }
            .maintenance-text {
              color: #4a5568; font-size: 1.3rem;
              line-height: 1.6; max-width: 550px; margin: 0 auto 35px;
              font-weight: 500;
            }
            .maintenance-btn {
              display: inline-block; padding: 16px 35px;
              background: #1a3a6b; color: #fff; font-weight: 700;
              text-decoration: none; border-radius: 12px;
              transition: all 0.2s ease;
              font-size: 1.1rem;
            }
            .maintenance-btn:hover {
              background: #112a50; transform: translateY(-2px);
            }
            .maintenance-footer {
              margin-top: 30px; color: rgba(255, 255, 255, 0.6);
              font-size: 0.95rem; font-weight: 500;
            }
            @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
            
            @media (max-width: 768px) {
              .maintenance-title { font-size: 2rem; }
              .maintenance-text { font-size: 1.1rem; }
              .maintenance-card { padding: 40px 20px; }
              .maintenance-icon { font-size: 55px; }
            }
          `}</style>
          
          <div className="maintenance-card">
            <div className="maintenance-icon">🏗️</div>
            <h1 className="maintenance-title">Sitio en<br/>Mantenimiento</h1>
            <div className="maintenance-line"></div>
            <p className="maintenance-text">
              Estamos trabajando para mejorar tu experiencia. El acceso estará restablecido en breve.
            </p>
            
            <Link href="/login" className="maintenance-btn">
              🔒 Acceso Staff
            </Link>
          </div>
          
          <div className="maintenance-footer">
            &copy; {new Date().getFullYear()} ARIFA | Seguridad e Higiene Laboral
          </div>
        </div>
      )}
    </>
  );
}
