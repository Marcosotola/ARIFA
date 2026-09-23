import type { Metadata } from "next";
import Link from "next/link";
import { adminDb } from "@/lib/firebase-admin";
import { GraduationCap } from "lucide-react";
import CopyLinkButton from "@/components/CopyLinkButton";

export const metadata: Metadata = {
  title: "Capacitaciones | ARIFA",
  description: "Material de capacitación en seguridad e higiene laboral: trabajo en altura, espacios confinados y más, disponible para consulta libre.",
};

const SITE_URL = "https://arifa.com.ar";

interface TemaResumen {
  id: string;
  nombre: string;
  descripcion: string;
  archivosCount: number;
  thumbUrl: string | null;
}

async function getTemas(): Promise<TemaResumen[]> {
  const snap = await adminDb.collection("capacitaciones_temas").where("activo", "==", true).get();
  return snap.docs
    .map(d => {
      const data = d.data();
      const archivos = data.archivos || [];
      return {
        id: d.id,
        nombre: data.nombre || "",
        descripcion: data.descripcion || "",
        archivosCount: archivos.length,
        thumbUrl: archivos.find((a: any) => a.tipo === "imagen")?.url || null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export default async function CapacitacionesPage() {
  const temas = await getTemas();

  return (
    <>
      <div className="page-banner">
        <div className="container">
          <h1>Capacitaciones</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Capacitaciones</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container">
          <div className="section-title-wrap">
            <h2>Material de Capacitación</h2>
            <div className="section-line"></div>
            <p style={{ marginTop: "15px" }}>
              Recursos disponibles para la formación del personal en seguridad e higiene laboral. Elegí un tema para ver el material.
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap", marginBottom: "40px" }}>
            <CopyLinkButton url={`${SITE_URL}/capacitaciones`} label="Copiar enlace de esta biblioteca" />
            <Link href="/capacitaciones/examen" className="btn-red" style={{ padding: "8px 14px", fontWeight: 700, fontSize: "0.82rem" }}>
              Rendir examen de capacitación
            </Link>
          </div>

          {temas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <GraduationCap size={40} style={{ marginBottom: "12px" }} />
              <p>Todavía no hay material de capacitación publicado.</p>
            </div>
          ) : (
            <div className="grid-3">
              {temas.map(t => (
                <Link
                  key={t.id}
                  href={`/capacitaciones/${t.id}`}
                  style={{
                    background: "#fff",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ height: "160px", background: t.thumbUrl ? "#000" : "linear-gradient(135deg, #00224415, #A31F1D15)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {t.thumbUrl ? (
                      <img src={t.thumbUrl} alt={t.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <GraduationCap size={40} color="var(--primary-blue)" />
                    )}
                  </div>
                  <div style={{ padding: "20px" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--primary-blue)", marginBottom: "8px" }}>{t.nombre}</h3>
                    {t.descripcion && (
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "10px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}>
                        {t.descripcion}
                      </p>
                    )}
                    <div style={{ fontSize: "0.75rem", color: "var(--primary-red)", fontWeight: 700 }}>
                      {t.archivosCount} material{t.archivosCount !== 1 ? "es" : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
