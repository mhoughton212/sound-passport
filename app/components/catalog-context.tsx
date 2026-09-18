"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { genreFamilies as baseGenreFamilies, genres as baseGenres } from "../data/genres";
import type { Genre } from "../lib/music";

type CatalogValue = { genres: Genre[]; genreFamilies: string[]; refreshCatalog: () => Promise<void> };
const CatalogContext = createContext<CatalogValue | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [genres, setGenres] = useState(baseGenres);
  const refreshCatalog = useCallback(async () => {
    const response = await fetch(`/api/catalog?refresh=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { genres?: Genre[] };
    if (Array.isArray(data.genres)) setGenres(data.genres);
  }, []);
  // Loading server state on mount is the synchronization this effect owns.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refreshCatalog(); }, [refreshCatalog]);
  const value = useMemo(() => ({ genres, genreFamilies: ["All genres", ...[...new Set(genres.flatMap((genre) => genre.families))]], refreshCatalog }), [genres, refreshCatalog]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  return useContext(CatalogContext) ?? { genres: baseGenres, genreFamilies: baseGenreFamilies, refreshCatalog: async () => undefined };
}
