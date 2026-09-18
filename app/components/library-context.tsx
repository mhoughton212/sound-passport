"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { clearLibraryTracks, getLibraryTracks, replaceLibraryTracks } from "../lib/library-db";
import { applyGenreReview, type GenreReview, type ImportedTrack, type LibraryTrack, toImportedTrack } from "../lib/library";
import { scanLocalFolder } from "../lib/local-files";
import bundledReviewData from "../data/publicReviews.json";

type ImportProgress = {
  phase: "idle" | "importing" | "complete" | "error";
  current: number;
  total: number;
  message: string;
  details: string[];
};

type LibraryContextValue = {
  tracks: LibraryTrack[];
  connected: boolean;
  loading: boolean;
  reviewsReady: boolean;
  progress: ImportProgress;
  connect: () => void;
  disconnect: () => Promise<void>;
  sync: () => Promise<void>;
  refreshReviews: () => Promise<void>;
  requestReview: (trackId: string) => Promise<void>;
  cancelReview: (trackId: string) => Promise<void>;
  importLocalFolder: () => Promise<void>;
  clear: () => Promise<void>;
};

type LocalLibraryFile = { tracks?: ImportedTrack[] };
type ReviewedGenreFile = { reviews?: Record<string, GenreReview> };
type ImportDiagnostics = {
  savedTracks: number;
  playlistsFound: number;
  readablePlaylists: number;
  playlistsImported: number;
  playlistsFailed: number;
  playlistTracks: number;
  uniqueTracks: number;
  failedPlaylistNames: string[];
  failedPlaylists: Array<{ playlist: string; id: string; ownerId: string | null; collaborative: boolean; status: number | null; error: string; endpoint: string }>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);
const idleProgress: ImportProgress = { phase: "idle", current: 0, total: 0, message: "", details: [] };
const RESTORE_SKIP_KEY = "sound-passport:skip-local-library-restore";
const bundledReviews = bundledReviewData.reviews as Record<string, GenreReview>;

async function getCachedOrLocalTracks() {
  const cached = (await getLibraryTracks()).map(toImportedTrack);
  if (cached.length || localStorage.getItem(RESTORE_SKIP_KEY) === "true") return cached;
  try {
    const response = await fetch("/api/library/seed");
    if (!response.ok) return [];
    const data = await response.json() as LocalLibraryFile;
    const restored = Array.isArray(data.tracks) ? data.tracks.map(toImportedTrack) : [];
    if (restored.length) await replaceLibraryTracks(restored);
    return restored;
  } catch {
    return [];
  }
}

function connectUrl() {
  const url = new URL("/api/spotify/connect", window.location.origin);
  if (url.hostname === "localhost") url.hostname = "127.0.0.1";
  return url.toString();
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewsReady, setReviewsReady] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>(idleProgress);
  const reviewsRef = useRef<Record<string, GenreReview>>({});
  const syncingRef = useRef(false);
  const reviewRequestWritesRef = useRef(Promise.resolve());

  const joinReviews = useCallback((imported: ImportedTrack[]) => imported.map((track) => applyGenreReview(track, reviewsRef.current[track.id])), []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setProgress({ phase: "importing", current: 0, total: 0, message: "Importing your Spotify library…", details: [] });
    try {
      const requestPage = async (params: URLSearchParams) => {
        const response = await fetch(`/api/spotify/library?${params.toString()}`);
        const data = await response.json() as { tracks?: ImportedTrack[]; error?: string; failure?: { status: number | null; error: string; endpoint: string | null }; nextOffset?: number | null; sourceCount?: number; total?: number | null };
        if (response.status === 401) {
          setConnected(false);
          throw new Error("Connect Spotify before importing your library.");
        }
        if (!response.ok) {
          const detail = data.failure?.error ? ` ${data.failure.error}` : "";
          const error = new Error(`${data.error || "Your Spotify library could not be imported."}${detail}`);
          (error as Error & { failure?: typeof data.failure }).failure = data.failure;
          throw error;
        }
        return data;
      };

      const metadataResponse = await fetch("/api/spotify/library?mode=metadata");
      const metadata = await metadataResponse.json() as { playlists?: Array<{ id: string; name: string; ownerId: string | null; collaborative: boolean }>; playlistsFound?: number; readablePlaylists?: number; error?: string };
      if (metadataResponse.status === 401) {
        setConnected(false);
        throw new Error("Connect Spotify before importing your library.");
      }
      if (!metadataResponse.ok) throw new Error(metadata.error || "Your Spotify library could not be imported.");

      const tracksById = new Map<string, ImportedTrack>();
      const addTrack = (track: ImportedTrack) => {
        const existing = tracksById.get(track.id);
        if (existing) existing.sources = [...new Set([...(existing.sources ?? []), ...(track.sources ?? [])])];
        else tracksById.set(track.id, track);
      };
      let savedTracks = 0;
      let playlistTracks = 0;
      let savedOffset: number | null = 0;
      while (savedOffset !== null) {
        const data = await requestPage(new URLSearchParams({ mode: "saved", offset: String(savedOffset) }));
        for (const track of data.tracks ?? []) addTrack(toImportedTrack(track));
        savedTracks += data.sourceCount ?? 0;
        savedOffset = data.nextOffset ?? null;
        setProgress({ phase: "importing", current: tracksById.size, total: 0, message: `Importing saved tracks… ${tracksById.size} found`, details: [] });
      }

      const failedPlaylists: ImportDiagnostics["failedPlaylists"] = [];
      let playlistsImported = 0;
      for (const [playlistIndex, playlist] of (metadata.playlists ?? []).entries()) {
        let playlistOffset: number | null = 0;
        let playlistFailed = false;
        while (playlistOffset !== null) {
          try {
            const data = await requestPage(new URLSearchParams({ mode: "playlist", playlistId: playlist.id, playlistName: playlist.name, offset: String(playlistOffset) }));
            for (const track of data.tracks ?? []) addTrack(toImportedTrack(track));
            playlistTracks += data.sourceCount ?? 0;
            playlistOffset = data.nextOffset ?? null;
            setProgress({ phase: "importing", current: playlistIndex + 1, total: metadata.playlists?.length ?? 0, message: `Importing ${playlist.name}…`, details: [] });
          } catch (error) {
            const failure = (error as Error & { failure?: ImportDiagnostics["failedPlaylists"][number] }).failure;
            failedPlaylists.push({ playlist: playlist.name, id: playlist.id, ownerId: playlist.ownerId, collaborative: playlist.collaborative, status: failure?.status ?? null, error: failure?.error ?? (error instanceof Error ? error.message : "Unknown playlist import error"), endpoint: failure?.endpoint ?? `/api/spotify/library?mode=playlist&playlistId=${playlist.id}` });
            playlistFailed = true;
            playlistOffset = null;
          }
        }
        if (!playlistFailed) playlistsImported += 1;
      }

      const existingLocal = (await getLibraryTracks()).filter((track) => track.source === "local");
      const imported = [...existingLocal, ...tracksById.values()];
      await replaceLibraryTracks(imported);
      const reviewed = joinReviews(imported);
      setTracks(reviewed);
      setConnected(true);
      localStorage.removeItem(RESTORE_SKIP_KEY);
       const pending = reviewed.filter((track) => track.reviewedGenreIds.length === 0 || track.reviewRequested).length;
      const diagnostics: ImportDiagnostics = {
        savedTracks,
        playlistsFound: metadata.playlistsFound ?? 0,
        readablePlaylists: metadata.readablePlaylists ?? 0,
        playlistsImported,
        playlistsFailed: failedPlaylists.length,
        playlistTracks,
        uniqueTracks: imported.length,
        failedPlaylistNames: failedPlaylists.map((failure) => failure.playlist),
        failedPlaylists,
      };
      const diagnosticMessage = diagnostics.playlistsFailed
        ? `${imported.length} tracks imported. ${diagnostics.playlistsFailed} playlist${diagnostics.playlistsFailed === 1 ? "" : "s"} failed (${diagnostics.failedPlaylistNames.slice(0, 5).join(", ")}).`
        : `${imported.length} tracks imported.`;
      const diagnosticDetails = diagnostics.failedPlaylists.map((failure) => `${failure.playlist} — HTTP ${failure.status ?? "unknown"}; owner=${failure.ownerId ?? "none"}; collaborative=${failure.collaborative}; ${failure.error}`);
      setProgress({
        phase: "complete",
        current: imported.length - pending,
        total: imported.length,
        message: `${diagnosticMessage}${pending ? ` ${pending} ${pending === 1 ? "track needs" : "tracks need"} review.` : ""}`,
        details: diagnosticDetails,
      });
    } catch (error) {
      setProgress({ phase: "error", current: 0, total: 0, message: error instanceof Error ? error.message : "Library import failed.", details: [] });
    } finally {
      syncingRef.current = false;
    }
  }, [joinReviews]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [cached, accountResponse, reviewedResponse] = await Promise.all([
          getCachedOrLocalTracks(),
          fetch("/api/spotify/account"),
          fetch("/api/library/reviews").catch(() => null),
        ]);
        if (!active) return;
        const reviewedFile = reviewedResponse?.ok ? await reviewedResponse.json() as ReviewedGenreFile : { reviews: bundledReviews };
        reviewsRef.current = Object.keys(reviewedFile.reviews ?? {}).length ? reviewedFile.reviews ?? {} : bundledReviews;
        const joined = joinReviews(cached);
        setTracks(joined);
        await replaceLibraryTracks(cached.map(toImportedTrack));

        const account = await accountResponse.json() as { connected?: boolean };
        const isConnected = Boolean(account.connected);
        setConnected(isConnected);
        const params = new URLSearchParams(window.location.search);
        const justConnected = params.get("spotify") === "connected";
        if (params.has("spotify")) {
          params.delete("spotify");
          const query = params.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
        }
        if (justConnected && isConnected) await sync();
        else if (joined.length) {
           const pending = joined.filter((track) => track.reviewedGenreIds.length === 0 || track.reviewRequested).length;
          setProgress({ phase: "complete", current: joined.length - pending, total: joined.length, message: pending ? `${pending} ${pending === 1 ? "track needs" : "tracks need"} review.` : `${joined.length} tracks are reviewed and ready.`, details: [] });
        }
      } finally {
        if (active) {
          setReviewsReady(true);
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [joinReviews, sync]);

  const connect = useCallback(() => { window.location.assign(connectUrl()); }, []);
  const refreshReviews = useCallback(async () => {
    setReviewsReady(false);
    try {
      let reviewedFile: ReviewedGenreFile = { reviews: bundledReviews };
      try {
        const response = await fetch(`/api/library/reviews?refresh=${Date.now()}`, { cache: "no-store" });
        if (response.ok) reviewedFile = await response.json() as ReviewedGenreFile;
      } catch { /* use the bundled authority below */ }
      reviewsRef.current = Object.keys(reviewedFile.reviews ?? {}).length ? reviewedFile.reviews ?? {} : bundledReviews;
      const normalized = (await getLibraryTracks()).map(toImportedTrack);
      const joined = joinReviews(normalized);
      setTracks(joined);
      await replaceLibraryTracks(normalized);
      const pending = joined.filter((track) => track.reviewedGenreIds.length === 0 || track.reviewRequested).length;
      setProgress({
        phase: "complete",
        current: joined.length - pending,
        total: joined.length,
        message: pending ? `${pending} ${pending === 1 ? "track needs" : "tracks need"} review.` : `${joined.length} tracks are reviewed and ready.`,
        details: [],
      });
    } finally {
      setReviewsReady(true);
    }
  }, [joinReviews]);
  const requestReview = useCallback(async (trackId: string) => {
    const requestedAt = new Date().toISOString();
    setTracks((current) => current.map((track) => track.id === trackId ? { ...track, reviewRequested: true, reviewRequestedAt: requestedAt } : track));
    reviewRequestWritesRef.current = reviewRequestWritesRef.current.catch(() => undefined).then(async () => {
      const normalized = (await getLibraryTracks()).map(toImportedTrack).map((track) => track.id === trackId ? { ...track, reviewRequested: true, reviewRequestedAt: requestedAt } : track);
      await replaceLibraryTracks(normalized);
    });
    await reviewRequestWritesRef.current;
  }, []);
  const cancelReview = useCallback(async (trackId: string) => {
    setTracks((current) => current.map((track) => track.id === trackId ? { ...track, reviewRequested: false, reviewRequestedAt: undefined } : track));
    reviewRequestWritesRef.current = reviewRequestWritesRef.current.catch(() => undefined).then(async () => {
      const normalized = (await getLibraryTracks()).map(toImportedTrack).map((track) => track.id === trackId ? { ...track, reviewRequested: false, reviewRequestedAt: undefined } : track);
      await replaceLibraryTracks(normalized);
    });
    await reviewRequestWritesRef.current;
  }, []);
  const disconnect = useCallback(async () => {
    await fetch("/api/spotify/account", { method: "DELETE" });
    setConnected(false);
  }, []);
  const clear = useCallback(async () => {
    await clearLibraryTracks();
    localStorage.setItem(RESTORE_SKIP_KEY, "true");
    setTracks([]);
    setProgress(idleProgress);
  }, []);

  const importLocalFolder = useCallback(async () => {
    const scan = await scanLocalFolder();
    const localTracks = scan.tracks;
    const existing = tracks.filter((track) => track.source !== "local");
    const imported = [...existing, ...localTracks.map((track) => toImportedTrack({ ...track, isrc: null }))];
    await replaceLibraryTracks(imported);
    const reviewed = joinReviews(imported);
    setTracks(reviewed);
    const metadataMessage = scan.metadataFailed ? ` ${scan.metadataFailed} metadata ${scan.metadataFailed === 1 ? "record" : "records"} failed.` : " Metadata read successfully.";
    const skippedMessage = scan.skippedFiles ? ` ${scan.skippedFiles} unsupported file${scan.skippedFiles === 1 ? "" : "s"} skipped.` : "";
    setProgress({ phase: "complete", current: reviewed.filter((track) => track.reviewedGenreIds.length > 0).length, total: reviewed.length, message: `${localTracks.length} local ${localTracks.length === 1 ? "track" : "tracks"} indexed.${metadataMessage}${skippedMessage}`, details: scan.failures });
  }, [joinReviews, tracks]);

  const value = useMemo(() => ({ tracks, connected, loading, reviewsReady, progress, connect, disconnect, sync, refreshReviews, requestReview, cancelReview, importLocalFolder, clear }), [tracks, connected, loading, reviewsReady, progress, connect, disconnect, sync, refreshReviews, requestReview, cancelReview, importLocalFolder, clear]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("useLibrary must be used within LibraryProvider.");
  return value;
}
