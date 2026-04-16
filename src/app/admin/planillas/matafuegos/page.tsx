"use client";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, where, doc, getDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Remito {
  id: string;
  numero: number;
  tipo: "retiro" | "entrega";
  fecha: string;
  clienteNombre: string;
  clienteEmpresa: string;
  cantidadEquipos: number;
  tecnicoNombre: string;
  createdAt: any;
}

export default function MatafuegosPage() {
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      const r = userDoc.exists() ? userDoc.data().rol : "cliente";
      setRole(r);
      fetchRemitos(r, u.uid);
    });
    return () => unsub();
  }, [router]);

  const fetchRemitos = async (r: string, uid: string) => {
    setLoading(true);
    try {
      let q;
      if (r === "admin" || r === "tecnico") {
        q = query(collection(db, "remitos_matafuegos"), orderBy("createdAt", "desc"));
      } else {
        q = query(collection(db, "remitos_matafuegos"), where("clienteId", "==", uid), orderBy("createdAt", "desc"));
      }
      const snap = await getDocs(q);
      setRemitos(snap.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data,
          cantidadEquipos: data.equipos?.length || 0 
        } as Remito;
      }));
    } catch (e) { 
      console.error("Error fetching remitos:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  const filteredRemitos = remitos.filter(r => 
    String(r.numero).includes(search) || 
    r.clienteNombre?.toLowerCase().includes(search.toLowerCase()) ||
    r.clienteEmpresa?.toLowerCase().includes(search.toLowerCase())
  );

  const isStaff = role === "admin" || role === "tecnico";

  return (
    <div style={{ maxWidth: "1100px" }}>
      <header style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.8rem", background: "#fee2e2", color: "#b91c1c", padding: "3px 10px", borderRadius: "20px", fontWeight: 700 }}>
              🧯 Planillas / Matafuegos
            </span>
          </div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Movimientos de Extintores</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Registro de retiros para recarga y entregas a clientes.</p>
        </div>
        {isStaff && (
          <Link href="/admin/planillas/matafuegos/nuevo" className="btn-red" style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            ➕ Nuevo Remito
          </Link>
        )}
      </header>

      {/* FILTERS */}
      <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", border: "1px solid #eee" }}>
        <input 
          type="text" 
          placeholder="Buscar por N°, cliente o empresa..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid #ddd", outline: "none", fontSize: "0.95rem" }}
        />
      </div>

      {/* TABLE */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>Cargando movimientos...</div>
        ) : filteredRemitos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "15px", filter: "grayscale(1)", opacity: 0.3 }}>🧯</div>
            <h3 style={{ fontWeight: 800, color: "#999", marginBottom: "8px" }}>No hay remitos registrados</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Todavía no se han realizado retiros o entregas.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
              <thead>
                <tr style={{ background: "#f8f9fc", borderBottom: "2px solid #eef0f3" }}>
                  {["N° Remito", "Tipo", "Fecha", "Cliente / Empresa", "Equipos", "Técnico", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRemitos.map(remito => (
                  <tr key={remito.id} style={{ borderBottom: "1px solid #f2f5f9" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontWeight: 800, color: "var(--primary-blue)" }}>R-{String(remito.numero || 0).padStart(5, "0")}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ 
                        fontSize: "0.7rem", padding: "4px 10px", borderRadius: "20px", fontWeight: 800, textTransform: "uppercase",
                        background: remito.tipo === "retiro" ? "#fff1f2" : "#f0fdf4",
                        color: remito.tipo === "retiro" ? "#e11d48" : "#16a34a"
                      }}>
                        {remito.tipo}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "0.88rem" }}>
                      {remito.fecha ? new Date(remito.fecha).toLocaleDateString("es-AR") : "-"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{remito.clienteNombre}</div>
                      <div style={{ fontSize: "0.75rem", color: "#888" }}>{remito.clienteEmpresa}</div>
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: 700 }}>
                      {remito.cantidadEquipos} unidades
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "0.85rem", color: "#666" }}>
                      {remito.tecnicoNombre}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <Link href={`/admin/planillas/matafuegos/${remito.id}`} style={{ padding: "7px 12px", borderRadius: "6px", border: "1px solid #ddd", background: "#f8f9fa", fontSize: "0.82rem", fontWeight: 600, color: "var(--primary-blue)" }}>
                        Ver Detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
