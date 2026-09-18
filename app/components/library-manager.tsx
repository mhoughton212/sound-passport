"use client";

import { useEffect, useMemo, useState } from "react";
import { useCatalog } from "./catalog-context";
import { useLibrary } from "./library-context";
import TrackGenreDetails from "./track-genre-details";
import SpotifyTrackPlayer from "./spotify-track-player";

export default function LibraryManager({ onClose }: { onClose: () => void }) {
  const library = useLibrary();
  const refreshReviews = library.refreshReviews;
  const { genres } = useCatalog();
  const reviewed = library.reviewsReady ? library.tracks.filter((track) => track.reviewedGenreIds.length > 0).length : 0;
  const needsReview = library.reviewsReady ? library.tracks.filter((track) => track.reviewedGenreIds.length === 0 || track.reviewRequested).length : 0;
  const percent = library.progress.total ? Math.min(100, Math.max(0, Math.round((library.progress.current / library.progress.total) * 100))) : 0;
  const [query, setQuery] = useState("");
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [reviewFileStatus, setReviewFileStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [qualityFilter, setQualityFilter] = useState<"all" | "reviewed" | "needs-review">("all");
  const [localStatus, setLocalStatus] = useState<"idle" | "scanning" | string>("idle");
  const qualityCounts = useMemo(() => ({
    all: library.tracks.length,
    reviewed,
    "needs-review": needsReview,
  }), [library.tracks.length, needsReview, reviewed]);
  const filteredTracks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return library.tracks.filter((track) => {
      if (qualityFilter === "reviewed" && track.reviewedGenreIds.length === 0) return false;
      if (qualityFilter === "needs-review" && track.reviewedGenreIds.length > 0 && !track.reviewRequested) return false;
      if (!normalized) return true;
      const mappedGenres = track.genreIds.flatMap((id) => {
        const genre = genres.find((item) => item.id === id);
        return genre ? [genre.name] : [];
      });
      return [track.title, track.artist, track.album, ...(track.sources ?? []), ...mappedGenres].join(" ").toLowerCase().includes(normalized);
    }).sort((left, right) => left.artist.localeCompare(right.artist) || left.title.localeCompare(right.title));
  }, [genres, library.tracks, qualityFilter, query]);
  const visibleTracks = filteredTracks.slice(0, visibleCount);

  async function importLocalFolder() {
    setLocalStatus("scanning");
    try {
      await library.importLocalFolder();
      setLocalStatus("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Local music folder indexing failed.", error);
      setLocalStatus(message);
    }
  }

  function prepareCodexReview() {
    setReviewFileStatus("saving");
    try {
      const tracks = library.tracks
        .filter((track) => track.reviewedGenreIds.length === 0 || track.reviewRequested)
        .map((track) => ({
          id: track.id,
          source: track.source ?? "spotify",
          title: track.title,
          artist: track.artist,
          album: track.album,
          isrc: track.isrc,
          sources: track.sources ?? [],
          localFileName: track.localFileName ?? null,
          reviewRequested: Boolean(track.reviewRequested),
        }));
      const packet = {
        version: 1,
        generatedAt: new Date().toISOString(),
        purpose: "Sound Passport genre review",
        instructions: "Review each recording against the supplied catalog. Return direct catalog genre IDs, a concise track-specific rationale, basis (track, release, artist, or work), researchSources when useful, and missingGenreCandidates only for styles absent from the supplied catalog. For every missingGenreCandidates entry, also return missingGenreCandidateJustifications as an object mapping that candidate ID to a concise explanation of why the catalog should consider adding it. After producing the complete pending-reviews.json output, save it in the project, run npm run merge-genre-reviews, and run npm run verify-genre-review. Treat review, merge, and successful verification as one completed task.",
        catalog: genres.map((genre) => ({ id: genre.id, name: genre.name, families: genre.families, parents: genre.parents ?? [] })),
        pendingTrackCount: tracks.length,
        tracks,
      };
      const url = URL.createObjectURL(new Blob([`${JSON.stringify(packet, null, 2)}\n`], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "pending-tracks.json";
      link.click();
      URL.revokeObjectURL(url);
      setReviewFileStatus("saved");
    } catch {
      setReviewFileStatus("error");
    }
  }

  useEffect(() => {
    document.body.classList.add("modal-open");
    void refreshReviews().catch(() => undefined);
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose, refreshReviews]);

  return (
    <div className="modal-backdrop library-manager-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="library-manager" role="dialog" aria-modal="true" aria-labelledby="library-manager-title">
        <button className="close-button" onClick={onClose} aria-label="Close library manager">×</button>
        <p className="eyebrow">Your music</p>
        <h2 id="library-manager-title">Spotify library</h2>
        <p className="library-manager-intro">Import your Liked Songs and playlists you own or collaborate on. Existing tracks reuse their Codex-reviewed genres; new tracks wait in a clear review queue.</p>

        <div className="library-stats">
          <div><strong>{library.tracks.length}</strong><span>Imported tracks</span></div>
            <div><strong>{library.reviewsReady ? reviewed : "…"}</strong><span>{library.reviewsReady ? "Codex reviewed" : "Checking reviews"}</span></div>
        </div>

          {!library.reviewsReady && <div className="library-progress-panel importing" role="status"><strong>Checking Codex reviews…</strong></div>}
          {library.reviewsReady && library.progress.phase !== "idle" && (
          <div className={`library-progress-panel ${library.progress.phase}`} role="status">
            <div><strong>{library.progress.message}</strong>{library.progress.total > 0 && <span>{library.progress.current} / {library.progress.total}</span>}</div>
            {library.progress.total > 0 && <div className="library-progress-track"><i style={{ width: `${percent}%` }} /></div>}
            {library.progress.details.length > 0 && <details className="library-progress-details"><summary>Scan details</summary><ul>{library.progress.details.map((detail) => <li key={detail}>{detail}</li>)}</ul></details>}
          </div>
        )}

        <div className="library-manager-actions">
          {!library.connected ? (
            <button className="primary" onClick={library.connect} disabled={library.loading}>Connect Spotify</button>
          ) : (
            <button className="primary" onClick={() => void library.sync()} disabled={library.progress.phase === "importing"}>{library.tracks.length ? "Update library" : "Import library"}</button>
          )}
          {library.connected && <button onClick={() => void library.disconnect()}>Disconnect</button>}
          {library.tracks.length > 0 && <button onClick={prepareCodexReview} disabled={reviewFileStatus === "saving" || !library.reviewsReady}>{reviewFileStatus === "saving" ? "Preparing review…" : "Prepare Codex review"}</button>}
          <button onClick={() => void importLocalFolder()} disabled={localStatus === "scanning"}>{localStatus === "scanning" ? "Indexing local files…" : "Add local music folder"}</button>
          {library.tracks.length > 0 && <button className="danger" onClick={() => void library.clear()}>Clear imported library</button>}
        </div>
        {reviewFileStatus === "saved" && <small className="library-file-status">Downloaded pending-tracks.json.</small>}
        {reviewFileStatus === "error" && <small className="library-file-status error">The Codex review file could not be prepared.</small>}
        {localStatus !== "idle" && localStatus !== "scanning" && <small className="library-file-status error">{localStatus}</small>}
        <small className="library-privacy">Your Spotify connection can import your library and create a private playlist when you export. Library updates stay in this browser; Codex review packets contain only tracks that still need genre review.</small>

        {library.tracks.length > 0 && (
          <section className="library-catalog" aria-labelledby="library-catalog-title">
            <div className="library-catalog-heading">
              <div><h3 id="library-catalog-title">Imported tracks</h3><p>Search titles, artists, albums, playlists, or reviewed genres.</p></div>
              <span>{filteredTracks.length} tracks</span>
            </div>
            <label className="library-catalog-search">
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(50); setActiveTrackId(null); }} placeholder="Search your imported tracks…" aria-label="Search imported tracks" />
              {query && <button type="button" onClick={() => { setQuery(""); setVisibleCount(50); }}>Clear</button>}
            </label>
            <div className="library-catalog-filters" aria-label="Filter imported tracks">
              {([
                ["all", "All"],
                ["reviewed", "Codex reviewed"],
                ["needs-review", "Needs review"],
              ] as const).map(([value, label]) => <button className={qualityFilter === value ? "active" : ""} onClick={() => { setQualityFilter(value); setVisibleCount(50); setActiveTrackId(null); }} key={value}>{label}<span>{library.reviewsReady ? qualityCounts[value] : "…"}</span></button>)}
            </div>
            <div className="library-catalog-list">
              {visibleTracks.map((track) => {
                const detailsOpen = activeTrackId === track.id;
                return (
                  <article className={`library-catalog-track ${detailsOpen ? "details-open" : ""}`} key={track.id}>
                    <div className="library-catalog-track-head">
                      <button className="library-catalog-track-main" onClick={() => setActiveTrackId(detailsOpen ? null : track.id)} aria-expanded={detailsOpen}>
                        {track.artwork ? <img src={track.artwork} alt="" /> : <span className="art-placeholder">♪</span>}
                        <span><strong>{track.title}</strong><small>{track.artist} · {track.album}</small><em>{track.reviewRequested ? "Re-review requested" : track.reviewedGenreIds.length ? `${track.reviewedGenreIds.length} reviewed genres · ${track.genreIds.length} including parents` : "Needs review"}</em></span>
                        <i>{detailsOpen ? "Close" : "Inspect"}</i>
                      </button>
                      <button className="track-play-overlay" type="button" aria-label={`${playingTrackId === track.id ? "Close player for" : "Play"} ${track.title} by ${track.artist}`} onClick={() => setPlayingTrackId(playingTrackId === track.id ? null : track.id)}><span aria-hidden="true" className={playingTrackId === track.id ? "close-icon" : "play-icon"} /></button>
                    </div>
                    {playingTrackId === track.id && <SpotifyTrackPlayer track={track} />}
                    {detailsOpen && <TrackGenreDetails track={track} onRequestReview={() => library.requestReview(track.id)} onCancelReview={() => library.cancelReview(track.id)} />}
                  </article>
                );
              })}
              {filteredTracks.length === 0 && <div className="library-catalog-empty"><span>∅</span><p>No imported tracks match “{query}”.</p></div>}
            </div>
            {visibleCount < filteredTracks.length && <button className="library-show-more" onClick={() => setVisibleCount((count) => count + 50)}>Show 50 more</button>}
          </section>
        )}
      </section>
    </div>
  );
}
