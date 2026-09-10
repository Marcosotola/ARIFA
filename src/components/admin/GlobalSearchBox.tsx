"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X as CloseIcon } from "lucide-react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { SEARCH_TYPES } from "@/lib/searchIndex";

export default function GlobalSearchBox({ role, uid }: { role: string | null; uid: string | null }) {
  const { query, setQuery, results, loading } = useGlobalSearch(role, uid);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const goToResult = (url: string) => {
    setOpen(false);
    setQuery("");
    router.push(url);
  };

  const goToFullResults = () => {
    setOpen(false);
    router.push(`/admin/buscar?q=${encodeURIComponent(query)}`);
  };

  const preview = results.slice(0, 6);

  return (
    <div ref={wrapRef} style={{ position: "relative", marginBottom: "16px" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Search size={16} style={{ position: "absolute", left: "12px", color: "rgba(255,255,255,0.5)" }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === "Enter" && query.trim().length >= 2) goToFullResults(); }}
          placeholder="Buscar cliente, sede, documento..."
          style={{
            width: "100%", padding: "9px 32px 9px 34px", borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)",
            color: "#fff", fontSize: "0.85rem", outline: "none",
          }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }} title="Limpiar"
            style={{ position: "absolute", right: "8px", background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex" }}>
            <CloseIcon size={14} />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff",
          borderRadius: "10px", boxShadow: "0 12px 30px rgba(0,0,0,0.25)", zIndex: 300, overflow: "hidden",
          maxHeight: "70vh", overflowY: "auto",
        }}>
          {loading ? (
            <div style={{ padding: "18px", textAlign: "center", color: "#999", fontSize: "0.85rem" }}>Buscando...</div>
          ) : preview.length === 0 ? (
            <div style={{ padding: "18px", textAlign: "center", color: "#999", fontSize: "0.85rem" }}>Sin resultados.</div>
          ) : (
            preview.map(r => (
              <button key={`${r.tipo}-${r.id}`} onClick={() => goToResult(r.url)}
                style={{
                  display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 14px",
                  background: "none", border: "none", borderBottom: "1px solid #f2f2f2", cursor: "pointer", textAlign: "left",
                }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: SEARCH_TYPES[r.tipo].color, flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.titulo}</div>
                  <div style={{ fontSize: "0.75rem", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subtitulo || SEARCH_TYPES[r.tipo].label}</div>
                </div>
                <span style={{ fontSize: "0.62rem", fontWeight: 800, color: SEARCH_TYPES[r.tipo].color, textTransform: "uppercase", flexShrink: 0 }}>
                  {SEARCH_TYPES[r.tipo].label}
                </span>
              </button>
            ))
          )}
          {!loading && results.length > 0 && (
            <button onClick={goToFullResults}
              style={{ width: "100%", padding: "12px", background: "#f8fafc", border: "none", cursor: "pointer", fontWeight: 800, fontSize: "0.8rem", color: "var(--primary-blue)" }}>
              Ver todos los resultados ({results.length}) →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
