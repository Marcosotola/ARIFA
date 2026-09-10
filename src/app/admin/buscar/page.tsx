"use client";
import { Suspense, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, X as CloseIcon, SearchX } from "lucide-react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { SEARCH_TYPES, SearchTipo } from "@/lib/searchIndex";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/admin/ViewToggle";

const PAGE_SIZE = 20;

const QUICK_RANGES: { label: string; days: number | null }[] = [
  { label: "Todo", days: null },
  { label: "Hoy", days: 0 },
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
];

function fmtDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function BuscarContent() {
  const [role, setRole] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { query, setQuery, tipos, setTipos, dateFrom, setDateFrom, dateTo, setDateTo, results, loading, ensureIndex } = useGlobalSearch(role, uid);
  const [viewMode, setViewMode] = useViewMode("buscar");
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Reset de paginación cuando cambian los criterios de búsqueda (patrón "ajustar
  // estado durante el render" en vez de useEffect, para no disparar un render extra).
  const filtersKey = `${query}|${tipos.join(",")}|${dateFrom}|${dateTo}`;
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (filtersKey !== prevFiltersKey) {
    setPrevFiltersKey(filtersKey);
    setDisplayCount(PAGE_SIZE);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "usuarios", u.uid));
      setRole(snap.exists() ? (snap.data().rol || "cliente") : "cliente");
      setUid(u.uid);
      setAuthReady(true);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams, setQuery]);

  useEffect(() => {
    if (role) ensureIndex();
  }, [role, ensureIndex]);

  const toggleTipo = (t: SearchTipo) => {
    setTipos(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const applyQuickRange = (days: number | null) => {
    if (days === null) { setDateFrom(""); setDateTo(""); return; }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateFrom(fmtDateInput(from));
    setDateTo(fmtDateInput(to));
  };

  const clearFilters = () => { setTipos([]); setDateFrom(""); setDateTo(""); };

  const visible = results.slice(0, displayCount);
  const hayMas = results.length > displayCount;

  if (!authReady) return <div style={{ padding: "100px", textAlign: "center", color: "var(--text-muted)" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary-blue)", margin: 0 }}>Buscador General</h1>
        <p style={{ color: "var(--text-muted)", marginTop: "5px" }}>Clientes, sedes y documentos en un solo lugar.</p>
      </header>

      <div style={{ background: "#fff", padding: "18px 20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", marginBottom: "20px", border: "1px solid #eee" }}>
        <div style={{ position: "relative", marginBottom: "16px" }}>
          <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar cliente, sede, número de documento..."
            style={{ width: "100%", padding: "12px 36px 12px 38px", borderRadius: "8px", border: "1px solid #ddd", outline: "none", fontSize: "0.95rem" }}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} title="Limpiar búsqueda"
              style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#aaa", cursor: "pointer", display: "flex" }}>
              <CloseIcon size={16} />
            </button>
          )}
        </div>

        <div style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>Tipo de documento</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(Object.keys(SEARCH_TYPES) as SearchTipo[]).map(t => {
              const active = tipos.includes(t);
              const cfg = SEARCH_TYPES[t];
              return (
                <button key={t} onClick={() => toggleTipo(t)}
                  style={{
                    padding: "6px 14px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
                    border: `1.5px solid ${active ? cfg.color : "#eee"}`,
                    background: active ? cfg.color : "#fff",
                    color: active ? "#fff" : "#666",
                    transition: "0.15s",
                  }}>
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ width: "160px" }}>
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }} />
          </div>
          <div style={{ width: "160px" }}>
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "5px", textTransform: "uppercase" }}>Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }} />
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {QUICK_RANGES.map(r => (
              <button key={r.label} onClick={() => applyQuickRange(r.days)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd", background: "#fff", fontSize: "0.75rem", fontWeight: 600, color: "#666", cursor: "pointer" }}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={clearFilters}
            style={{ padding: "9px 15px", background: "none", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#666" }}>
            Limpiar filtros
          </button>
        </div>
      </div>

      {query.trim().length < 2 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#bbb" }}>
          <SearchX size={40} style={{ marginBottom: "12px", opacity: 0.5 }} />
          <div>Escribí al menos 2 caracteres para buscar.</div>
        </div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: "80px", color: "var(--text-muted)" }}>Buscando...</div>
      ) : results.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#bbb" }}>
          <SearchX size={40} style={{ marginBottom: "12px", opacity: 0.5 }} />
          <div>No se encontraron resultados para &quot;{query}&quot;.</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>
              {results.length} resultado{results.length !== 1 ? "s" : ""} — mostrando {visible.length}
            </p>
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>

          {viewMode === "card" ? (
            <div className="doc-card-grid" style={{ padding: 0 }}>
              {visible.map(r => (
                <Link key={`${r.tipo}-${r.id}`} href={r.url} className="doc-card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 900, padding: "4px 10px", borderRadius: "20px", textTransform: "uppercase", background: `${SEARCH_TYPES[r.tipo].color}18`, color: SEARCH_TYPES[r.tipo].color }}>
                      {SEARCH_TYPES[r.tipo].label}
                    </span>
                    {r.fecha && <span style={{ fontSize: "0.72rem", color: "#999" }}>{r.fecha.toLocaleDateString("es-AR")}</span>}
                  </div>
                  <div style={{ fontWeight: 800, color: "var(--primary-blue)", fontSize: "1rem", marginBottom: "6px" }}>{r.titulo}</div>
                  {r.subtitulo && <div style={{ fontSize: "0.85rem", color: "#666" }}>{r.subtitulo}</div>}
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", overflow: "hidden", border: "1px solid #eee" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fc", borderBottom: "2px solid #eef0f3" }}>
                      {["Tipo", "Documento", "Cliente / Sede", "Fecha"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "14px 16px", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(r => (
                      <tr key={`${r.tipo}-${r.id}`} style={{ borderBottom: "1px solid #f2f5f9", cursor: "pointer" }}
                        onClick={() => router.push(r.url)}
                        onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontSize: "0.65rem", fontWeight: 900, padding: "4px 10px", borderRadius: "20px", textTransform: "uppercase", background: `${SEARCH_TYPES[r.tipo].color}18`, color: SEARCH_TYPES[r.tipo].color }}>
                            {SEARCH_TYPES[r.tipo].label}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 800, color: "var(--primary-blue)" }}>{r.titulo}</td>
                        <td style={{ padding: "14px 16px", fontSize: "0.85rem", color: "#555" }}>{r.subtitulo || "-"}</td>
                        <td style={{ padding: "14px 16px", fontSize: "0.85rem", color: "#666", whiteSpace: "nowrap" }}>{r.fecha ? r.fecha.toLocaleDateString("es-AR") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {hayMas && (
            <button
              onClick={() => setDisplayCount(c => c + PAGE_SIZE)}
              style={{ width: "100%", padding: "16px", marginTop: "12px", background: "#f8fafc", border: "1px solid #eee", borderRadius: "12px", cursor: "pointer", fontWeight: 700, color: "var(--primary-blue)", fontSize: "0.88rem" }}
            >
              Ver más — mostrando {visible.length} de {results.length}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function BuscarPage() {
  return (
    <Suspense fallback={<div style={{ padding: "100px", textAlign: "center" }}>Cargando buscador...</div>}>
      <BuscarContent />
    </Suspense>
  );
}
