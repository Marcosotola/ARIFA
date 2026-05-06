"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, query, orderBy, where,
  doc, getDoc, deleteDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateRemitoPDF } from "@/lib/pdfGenerator";
import { Plus, Eye, Edit, Scroll, Trash2, ArrowLeft, Search, Package } from "lucide-react";

interface RemitoDoc {
  id: string;
  numero: number;
  fecha: string;
  clienteNombre: string;
  clienteApellido?: string;
  clienteEmpresa?: string;
  clienteId?: string;
  sedeNombre?: string;
  descripcionGeneral?: string;
  createdAt: any;
  items: { cantidad: number; descripcion: string }[];
}

export default function RemitosPage() {
  const [remitos, setRemitos] = useState<RemitoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const r = userData.rol || "cliente";
      if (r === "tecnico") { router.push("/admin"); return; }
      setRole(r);
      await fetchRemitos(r, u.uid);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const isStaff = (r: string) => ["admin", "superadmin", "secretaria"].includes(r);

  const fetchRemitos = async (r: string, uid: string) => {
    try {
      let snap;
      const baseQuery = isStaff(r)
        ? query(collection(db, "remitos_doc"), orderBy("createdAt", "desc"))
        : query(collection(db, "remitos_doc"), where("clienteId", "==", uid), orderBy("createdAt", "desc"));
      try { snap = await getDocs(baseQuery); } catch {
        snap = await getDocs(isStaff(r)
          ? collection(db, "remitos_doc")
          : query(collection(db, "remitos_doc"), where("clienteId", "==", uid)));
      }
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as RemitoDoc));
      if (!isStaff(r)) docs = docs.filter(p => p.clienteId === uid);
      docs.sort((a, b) => ((b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
      setRemitos(docs);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDoc(doc(db, "remitos_doc", deleteConfirm));
      setRemitos(prev => prev.filter(p => p.id !== deleteConfirm));
    } catch { alert("Error al eliminar."); }
    finally { setDeleteConfirm(null); }
  };

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const snap = await getDoc(doc(db, "remitos_doc", id));
      if (!snap.exists()) { alert("Remito no encontrado."); return; }
      await generateRemitoPDF({ id: snap.id, ...snap.data() });
    } catch (e) { console.error(e); alert("Error al generar el PDF."); }
    finally { setDownloadingId(null); }
  };

  const filtered = remitos.filter(p => {
    const q = search.toLowerCase();
    return (
      String(p.numero).includes(q) ||
      p.clienteNombre?.toLowerCase().includes(q) ||
      p.clienteEmpresa?.toLowerCase().includes(q) ||
      (p.clienteApellido || "").toLowerCase().includes(q) ||
      (p.descripcionGeneral || "").toLowerCase().includes(q)
    );
  });

  const isReadOnly = role === "cliente";
  const isAdmin = role === "admin" || role === "superadmin";

  if (loading) return <div style={{ padding: "100px", textAlign: "center", color: "var(--text-muted)" }}>Cargando remitos...</div>;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <header style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <button onClick={() => router.push("/admin/documentos")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#888", fontWeight: 600, cursor: "pointer", marginBottom: "8px", padding: 0, fontSize: "0.85rem" }}>
            <ArrowLeft size={16} /> Documentos
          </button>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>
            {isReadOnly ? "Mis Remitos" : "Remitos"}
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Comprobantes de entrega de materiales y equipos.</p>
        </div>
        {!isReadOnly && (
          <Link href="/admin/documentos/remitos/nuevo" className="btn-red" style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px", textTransform: "uppercase", fontSize: "0.8rem", textDecoration: "none" }}>
            <Plus size={18} strokeWidth={3} /> Nuevo Remito
          </Link>
        )}
      </header>

      {/* Filtros */}
      <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #eee" }}>
        <div style={{ flex: 1, minWidth: "220px" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Buscar</label>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
            <input type="text" placeholder="N°, cliente, empresa o descripción..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "10px 14px 10px 34px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.9rem" }} />
          </div>
        </div>
        <button onClick={() => setSearch("")} style={{ padding: "10px 15px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#666" }}>Limpiar</button>
      </div>

      {/* Tabla */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#999" }}>
            <Package size={40} style={{ marginBottom: "12px", opacity: 0.3, display: "block", margin: "0 auto 12px" }} />
            <div>{remitos.length === 0 ? "Aún no hay remitos cargados." : "No se encontraron resultados."}</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
              <thead>
                <tr style={{ background: "#f8f9fc", borderBottom: "2px solid #eef0f3" }}>
                  {["N° REMITO", "FECHA", "CLIENTE / EMPRESA", "DESCRIPCIÓN", "ITEMS", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const totalItems = (p.items || []).reduce((acc, i) => acc + (Number(i.cantidad) || 0), 0);
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f2f5f9" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: "var(--primary-blue)", whiteSpace: "nowrap" }}>
                        RM-{String(p.numero || "?").padStart(5, "0")}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                        {p.fecha ? new Date(p.fecha + "T12:00:00").toLocaleDateString("es-AR") : "-"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{p.clienteNombre}{p.clienteApellido ? ` ${p.clienteApellido}` : ""}</div>
                        {p.clienteEmpresa && <div style={{ fontSize: "0.75rem", color: "#888" }}>{p.clienteEmpresa}</div>}
                        {p.sedeNombre && <div style={{ fontSize: "0.7rem", color: "#aaa" }}>Sede: {p.sedeNombre}</div>}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.85rem", maxWidth: "200px" }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.descripcionGeneral || "-"}</div>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ background: "#f0f7ff", color: "#0061ff", borderRadius: "8px", padding: "4px 10px", fontSize: "0.8rem", fontWeight: 700 }}>{totalItems} u.</span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <Link title="Ver" href={`/admin/documentos/remitos/${p.id}`} style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                            <Eye size={18} strokeWidth={2.5} />
                          </Link>
                          {!isReadOnly && (
                            <Link title="Editar" href={`/admin/documentos/remitos/nuevo?edit=${p.id}`} style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0f7ff", color: "#0061ff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                              <Edit size={18} strokeWidth={2.5} />
                            </Link>
                          )}
                          <button title="Descargar PDF" onClick={() => handleDownload(p.id)} disabled={downloadingId === p.id} style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", opacity: downloadingId === p.id ? 0.5 : 1 }}>
                            <Scroll size={18} strokeWidth={2.5} />
                          </button>
                          {isAdmin && (
                            <button title="Eliminar" onClick={() => setDeleteConfirm(p.id)} style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", background: "#fef2f2", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Trash2 size={18} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "30px", maxWidth: "400px", width: "100%", textAlign: "center" }}>
            <h3 style={{ fontWeight: 800, marginBottom: "12px" }}>¿Eliminar este remito?</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.9rem" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleDelete} className="btn-red" style={{ flex: 1, padding: "12px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
