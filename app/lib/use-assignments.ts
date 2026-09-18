"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { Assignments, parseAssignments, STORAGE_KEY, Track } from "./music";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const handleCatalogAction = (event: Event) => {
    const detail = (event as CustomEvent<{ action?: string; candidateId?: string; targetGenreId?: string }>).detail;
    if (detail?.action !== "consolidate" || !detail.candidateId || !detail.targetGenreId) return;
    const current = parseAssignments(localStorage.getItem(STORAGE_KEY));
    const source = current[detail.candidateId];
    if (!source) return;
    const next = { ...current, [detail.targetGenreId]: current[detail.targetGenreId] ?? source };
    delete next[detail.candidateId];
    writeAssignments(next);
  };
  window.addEventListener("storage", listener);
  window.addEventListener("sound-passport:catalog-action", handleCatalogAction);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener("sound-passport:catalog-action", handleCatalogAction);
  };
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

function getServerSnapshot() {
  return "";
}

function writeAssignments(assignments: Assignments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  listeners.forEach((listener) => listener());
  void fetch("/__sound-passport/assignments-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assignments),
  }).catch(() => undefined);
}

export function useAssignments() {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const assignments = useMemo(() => parseAssignments(stored), [stored]);

  useEffect(() => {
    let active = true;
    const current = parseAssignments(localStorage.getItem(STORAGE_KEY));
    if (Object.keys(current).length) {
      writeAssignments(current);
      return () => { active = false; };
    }
    void fetch("/__sound-passport/assignments-file").then(async (response) => {
      if (!response.ok || !active) return;
      const data = await response.json() as { assignments?: Assignments };
      if (active && data.assignments) writeAssignments(data.assignments);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const assign = useCallback((genreId: string, track: Track) => {
    const current = parseAssignments(localStorage.getItem(STORAGE_KEY));
    writeAssignments({ ...current, [genreId]: track });
  }, []);

  const remove = useCallback((genreId: string) => {
    const current = parseAssignments(localStorage.getItem(STORAGE_KEY));
    const next = { ...current };
    delete next[genreId];
    writeAssignments(next);
  }, []);

  return { assignments, assign, remove };
}
