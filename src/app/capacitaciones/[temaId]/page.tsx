import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import CopyLinkButton from "@/components/CopyLinkButton";
import type { ArchivoTema } from "@/lib/capacitaciones";
import MaterialCapacitacion from "@/components/MaterialCapacitacion";
import { GraduationCap, XCircle } from "lucide-react";

const SITE_URL = "https://arifa.com.ar";

interface TemaDetalle {
  id: string;
  nombre: string;
  descripcion: string;
  archivos: ArchivoTema[];
}

async function getTema(temaId: string): Promise<TemaDetalle | null> {
  // Leer siempre de Firestore en cada visita: sin esto Next genera la página al publicar el sitio
  // y los temas creados o activados después no aparecen hasta el próximo deploy.
  await connection();
  const docSnap = await adminDb.collection("capacitaciones_temas").doc(temaId).get();
  if (!docSnap.exists) return null;
  const data = docSnap.data()!;
  if (data.activo !== true) return null;
  return {
    id: docSnap.id,
    nombre: data.nombre || "",
    descripcion: data.descripcion || "",
    archivos: data.archivos || [],
  };
}

export async function generateMetadata({ params }: { params: Promise<{ temaId: string }> }): Promise<Metadata> {
  const { temaId } = await params;
  const tema = await getTema(temaId);
  return {
    title: tema ? `${tema.nombre} | Capacitaciones ARIFA` : "Capacitaciones | ARIFA",
  };
}

export default async function CapacitacionTemaPage({ params }: { params: Promise<{ temaId: string }> }) {
  const { temaId } = await params;
  const tema = await getTema(temaId);

  if (!tema) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "20px", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <XCircle size={40} />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1e293b", marginBottom: "10px" }}>Tema no disponible</h1>
          <p style={{ color: "#64748b", lineHeight: 1.6, marginBottom: "24px" }}>Este material de capacitación no existe o ya no está disponible.</p>
          <Link href="/capacitaciones" className="btn-blue" style={{ padding: "10px 20px" }}>Ver todos los temas</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-banner">
        <div className="container">
          <h1>{tema.nombre}</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href="/capacitaciones">Capacitaciones</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{tema.nombre}</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container" style={{ maxWidth: "800px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "24px" }}>
            {tema.descripcion && (
              <p style={{ color: "var(--text-muted)", lineHeight: 1.6, flex: 1, minWidth: "200px" }}>{tema.descripcion}</p>
            )}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <CopyLinkButton url={`${SITE_URL}/capacitaciones/${tema.id}`} label="Copiar enlace de este tema" />
              <Link href={`/capacitaciones/examen?tema=${tema.id}&nombre=${encodeURIComponent(tema.nombre)}`} className="btn-red" style={{ padding: "8px 14px", fontWeight: 700, fontSize: "0.82rem" }}>
                Hacer la capacitación
              </Link>
            </div>
          </div>

          {tema.archivos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <GraduationCap size={40} style={{ marginBottom: "12px" }} />
              <p>Este tema todavía no tiene material cargado.</p>
            </div>
          ) : (
            tema.archivos.map((a, i) => <MaterialCapacitacion key={i} archivo={a} />)
          )}
        </div>
      </section>
    </>
  );
}
