"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSearchIndex, filterResults, SearchResult, SearchTipo } from "@/lib/searchIndex";

let cachedIndex: SearchResult[] | null = null;
let cachedForRoleUid: string | null = null;

export function useGlobalSearch(role: string | null, uid: string | null) {
  const [query, setQuery] = useState("");
  const [tipos, setTipos] = useState<SearchTipo[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [index, setIndex] = useState<SearchResult[]>(cachedIndex || []);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const ensureIndex = useCallback(async () => {
    const key = `${role || ""}:${uid || ""}`;
    if (cachedIndex && cachedForRoleUid === key) {
      setIndex(cachedIndex);
      return;
    }
    if (!role) return;
    setLoading(true);
    try {
      const built = await buildSearchIndex(role, uid);
      cachedIndex = built;
      cachedForRoleUid = key;
      setIndex(built);
    } finally {
      setLoading(false);
    }
  }, [role, uid]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      ensureIndex();
    }
  }, [debouncedQuery, ensureIndex]);

  const results = useMemo(() => {
    if (debouncedQuery.trim().length < 2) return [];
    return filterResults(index, { query: debouncedQuery, tipos, dateFrom, dateTo });
  }, [index, debouncedQuery, tipos, dateFrom, dateTo]);

  return {
    query, setQuery,
    tipos, setTipos,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    results,
    loading,
    ensureIndex,
  };
}
