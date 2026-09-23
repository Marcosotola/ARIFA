import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/firebase-admin";
import CopyLinkButton from "@/components/CopyLinkButton";
import { TIPO_META, type ArchivoTema } from "@/lib/capacitaciones";
import { GraduationCap, XCircle } from "lucide-react";

const SITE_URL = "https://arifa.com.ar";

interface TemaDetalle {
  id: string;
  nombre: string;
  descripcion: string;
  archivos: ArchivoTema[];
}

async function getTema(temaId: string): Promise<TemaDetalle | null> {
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

function MaterialBlock({ archivo }: { archivo: ArchivoTema }) {
  const meta = TIPO_META[archivo.tipo] || TIPO_META.otro;
  const Icon = meta.icon;
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "14px", overflow: "hidden", marginBottom: "20px" }}>
      <div style={{ padding: "12px 16px", background: "#f8fafc", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #e2e8f0" }}>
        <Icon size={18} color={meta.color} />
        <span style={{ fontWeight: 700, fontSize: "0.88rem", flex: 1, color: "#1e293b" }}>{archivo.nombre}</span>
        <a
          href={archivo.url}
          target="_blank"
          rel="noopener noreferrer"
          download={archivo.nombre}
          style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary-blue)" }}
        >
          Descargar
        </a>
      </div>
      <div style={{ padding: archivo.tipo === "imagen" || archivo.tipo === "video" ? 0 : "24px" }}>
        {archivo.tipo === "imagen" && (
          <a href={archivo.url} target="_blank" rel="noopener noreferrer">
            <img src={archivo.url} alt={archivo.nombre} style={{ width: "100%", maxHeight: "500px", objectFit: "contain", background: "#000", display: "block" }} />
          </a>
        )}
        {archivo.tipo === "pdf" && (
          <iframe src={archivo.url} title={archivo.nombre} style={{ width: "100%", height: "600px", border: "none", display: "block" }} />
        )}
        {archivo.tipo === "video" && (
          <video src={archivo.url} controls style={{ width: "100%", maxHeight: "500px", background: "#000", display: "block" }} />
        )}
        {(archivo.tipo === "ppt" || archivo.tipo === "otro") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
            <Icon size={40} color={meta.color} />
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Vista previa no disponible para archivos de tipo {meta.label}. Descargalo para verlo.</p>
            <a href={archivo.url} target="_blank" rel="noopener noreferrer" download={archivo.nombre} className="btn-blue" style={{ padding: "10px 20px" }}>
              Descargar {meta.label}
            </a>
          </div>
        )}
      </div>
    </div>
  );
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
            <CopyLinkButton url={`${SITE_URL}/capacitaciones/${tema.id}`} label="Copiar enlace de este tema" />
          </div>

          {tema.archivos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <GraduationCap size={40} style={{ marginBottom: "12px" }} />
              <p>Este tema todavía no tiene material cargado.</p>
            </div>
          ) : (
            tema.archivos.map((a, i) => <MaterialBlock key={i} archivo={a} />)
          )}
        </div>
      </section>
    </>
  );
}
