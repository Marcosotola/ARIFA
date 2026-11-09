import { TIPO_META, type ArchivoTema } from "@/lib/capacitaciones";

// Visor de un archivo de capacitación: lo usan la página pública del tema y el circuito del examen.
export default function MaterialCapacitacion({ archivo, pie }: { archivo: ArchivoTema; pie?: React.ReactNode }) {
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
      {pie && <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>{pie}</div>}
    </div>
  );
}
