"use client";
import { List, LayoutGrid } from "lucide-react";
import type { ViewMode } from "@/hooks/useViewMode";

export default function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const btnStyle = (active: boolean): React.CSSProperties => ({
    width: "38px",
    height: "38px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: active ? "var(--primary-blue)" : "transparent",
    color: active ? "#fff" : "#888",
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", borderRadius: "8px", border: "1px solid #ddd", overflow: "hidden", height: "39px" }}>
      <button type="button" title="Vista Tabla" onClick={() => onChange("table")} style={btnStyle(mode === "table")}>
        <List size={17} strokeWidth={2.5} />
      </button>
      <button type="button" title="Vista Tarjetas" onClick={() => onChange("card")} style={btnStyle(mode === "card")}>
        <LayoutGrid size={17} strokeWidth={2.5} />
      </button>
    </div>
  );
}
