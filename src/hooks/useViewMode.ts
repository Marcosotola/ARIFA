"use client";
import { useState } from "react";

export type ViewMode = "table" | "card";

function getInitialMode(key: string): ViewMode {
  if (typeof window === "undefined") return "table";
  try {
    const saved = localStorage.getItem(`arifa_view_${key}`);
    if (saved === "table" || saved === "card") return saved;
  } catch {}
  return window.innerWidth < 768 ? "card" : "table";
}

export function useViewMode(key: string): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setModeState] = useState<ViewMode>(() => getInitialMode(key));

  const setMode = (m: ViewMode) => {
    setModeState(m);
    try { localStorage.setItem(`arifa_view_${key}`, m); } catch {}
  };

  return [mode, setMode];
}
