"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import initialReviewData from "../data/publicReviews.json";
import { useCatalog } from "./catalog-context";
import { useLibrary } from "./library-context";
import AppTabs from "./app-tabs";
import TrackGenreDetails from "./track-genre-details";

type Candidate = { id: string; count: number; classification: "same-as-existing" | "near-existing" | "candidate-alias" | "distinct"; relatedGenreIds: string[]; justifications?: Array<{ trackId: string; title: string; artist: string; justification: string }> };
type Review = { title?: string; artist?: string; rationale?: string; basis?: string; researchSources?: string[]; missingGenreCandidates?: string[] };
type ReviewData = { reviews: Record<string, Review>; missingGenreCandidates: Candidate[] };
const fallbackData = initialReviewData as unknown as ReviewData;

function displayName(id: string) { return id.split("-").map((word) => word ? word[0].toUpperCase() + word.slice(1) : word).join(" "); }
function classificationLabel(value: Candidate["classification"]) { return value === "same-as-existing" ? "Same as catalog" : value === "near-existing" ? "Near catalog" : value === "candidate-alias" ? "Candidate alias" : "Distinct candidate"; }

export default function MissingGenresDashboard() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(fallbackData.missingGenreCandidates[0]?.id ?? "");
  const [inspectedTrackId, setInspectedTrackId] = useState<string | null>(null);
  const [targetGenreId, setTargetGenreId] = useState("");
  const [data, setData] = useState<ReviewData>(fallbackData);
  const [actionStatus, setActionStatus] = useState("");
  const library = useLibrary();
  const { genres, refreshCatalog } = useCatalog();
  const selected = data.missingGenreCandidates.find((candidate) => candidate.id === selectedId) ?? data.missingGenreCandidates[0];

  async function refreshReviews() {
    const response = await fetch(`/api/library/reviews?refresh=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const next = await response.json() as { reviews?: Record<string, Review>; missingGenreCandidates?: Candidate[] };
    setData({ reviews: next.reviews ?? {}, missingGenreCandidates: next.missingGenreCandidates ?? [] });
  }

  // Loading server state on mount is the synchronization this effect owns.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refreshReviews(); }, []);

  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.missingGenreCandidates.filter((candidate) => `${candidate.id} ${candidate.classification} ${candidate.relatedGenreIds.join(" ")}`.toLowerCase().includes(normalized));
  }, [data.missingGenreCandidates, query]);

  const associatedTracks = useMemo(() => Object.entries(data.reviews)
    .filter(([, review]) => review.missingGenreCandidates?.includes(selected?.id ?? ""))
    .map(([id, review]) => {
      const track = library.tracks.find((item) => item.id === id);
      return { id, title: review.title ?? track?.title ?? "Untitled track", artist: review.artist ?? track?.artist ?? "Unknown artist", album: track?.album ?? "Unknown album", artwork: track?.artwork ?? null, track, rationale: review.rationale, basis: review.basis, researchSources: review.researchSources };
    })
    .sort((left, right) => left.artist.localeCompare(right.artist) || left.title.localeCompare(right.title)), [data.reviews, library.tracks, selected]);

  async function runAction(action: "add" | "reject" | "consolidate") {
    if (!selected) return;
    if (action === "reject" && !window.confirm(`Delete ${displayName(selected.id)} from the candidate list?`)) return;
    if (action === "consolidate" && !targetGenreId) return;
    const body: Record<string, string> = { action, candidateId: selected.id };
    if (action === "consolidate") body.targetGenreId = targetGenreId;
    if (action === "add") {
      body.name = window.prompt("Genre name", displayName(selected.id))?.trim() || displayName(selected.id);
      body.description = window.prompt("Genre description", `Music identified as ${displayName(selected.id)}.`)?.trim() || `Music identified as ${displayName(selected.id)}.`;
      body.family = window.prompt("Catalog family", "Other")?.trim() || "Other";
    }
    setActionStatus("Saving…");
    const response = await fetch("/api/library/genre-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      setActionStatus(result.error ?? "Could not save that catalog action.");
      return;
    }
    if (action === "consolidate") window.dispatchEvent(new CustomEvent("sound-passport:catalog-action", { detail: { action, candidateId: selected.id, targetGenreId } }));
    await Promise.all([refreshCatalog(), refreshReviews(), library.refreshReviews()]);
    setSelectedId("");
    setTargetGenreId("");
    setActionStatus(`${action === "add" ? "Added" : action === "reject" ? "Deleted" : "Consolidated"} ${displayName(selected.id)}.`);
  }

  return <main className="missing-genres-page">
    <header className="topbar"><Link className="brand" href="/?view=passport" aria-label="Sound Passport home"><span className="brand-mark">S</span>Sound Passport</Link><AppTabs current="missing-genres" /><div className="header-actions"><span className="collection-status"><span /> Catalog review dashboard</span></div></header>
    <section className="missing-genres-content" aria-labelledby="missing-genres-title">
      <div className="missing-genres-intro"><div><p className="eyebrow">Catalog audit</p><h1 id="missing-genres-title">Missing genre candidates</h1><p>Review styles suggested by the track pass. Add, delete, or consolidate a candidate and the review authority will be updated with it.</p></div><div className="missing-genre-stats" aria-label="Candidate summary"><div><strong>{data.missingGenreCandidates.length}</strong><span>Candidate styles</span></div><div><strong>{Object.keys(data.reviews).length}</strong><span>Reviewed tracks</span></div></div></div>
      {actionStatus && <p className="library-file-status">{actionStatus}</p>}
      <div className="missing-genres-layout">
        <section className="candidate-panel" aria-labelledby="candidate-list-title"><div className="candidate-panel-heading"><div><h2 id="candidate-list-title">Candidate list</h2><p>Sorted by mentions · highest first</p></div><span>{filteredCandidates.length} shown</span></div><label className="candidate-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates…" aria-label="Search missing genre candidates" /></label><div className="candidate-list">{filteredCandidates.map((candidate) => <button className={`candidate-row ${candidate.id === selected?.id ? "active" : ""}`} key={candidate.id} onClick={() => { setSelectedId(candidate.id); setInspectedTrackId(null); }} aria-pressed={candidate.id === selected?.id}><span><strong>{displayName(candidate.id)}</strong><small>{classificationLabel(candidate.classification)}</small></span><b>{candidate.count}</b></button>)}{!filteredCandidates.length && <div className="candidate-empty"><span>∅</span><p>No candidates match “{query}”.</p></div>}</div></section>
        {selected && <section className="candidate-detail" aria-labelledby="candidate-detail-title"><div className="candidate-detail-top"><p className="eyebrow">Candidate detail</p><span className={`classification ${selected.classification}`}>{classificationLabel(selected.classification)}</span></div><h2 id="candidate-detail-title">{displayName(selected.id)}</h2><div className="candidate-count"><strong>{selected.count}</strong><span>track mentions</span></div>
          <div className="candidate-actions"><button onClick={() => void runAction("add")}>Add genre</button><button onClick={() => void runAction("reject")}>Delete candidate</button><select value={targetGenreId} onChange={(event) => setTargetGenreId(event.target.value)} aria-label="Consolidate into genre"><option value="">Consolidate into…</option>{genres.filter((genre) => genre.id !== selected.id).map((genre) => <option value={genre.id} key={genre.id}>{genre.name}</option>)}</select><button onClick={() => void runAction("consolidate")} disabled={!targetGenreId}>Merge</button></div>
          {selected.justifications && selected.justifications.length > 0 && <div className="genre-details"><section><strong>Why it was suggested</strong>{selected.justifications.map((item) => <p key={item.trackId}><b>{item.title} · {item.artist}:</b> {item.justification}</p>)}</section></div>}
          {selected.relatedGenreIds.length > 0 && <div className="related-genres"><span>Related catalog genres</span><div>{selected.relatedGenreIds.map((id) => <b key={id}>{displayName(id)}</b>)}</div></div>}
          <div className="associated-tracks-heading"><div><h3>Associated tracks</h3><p>Tracks where this candidate was suggested during review.</p></div><span>{associatedTracks.length}</span></div><div className="associated-track-list">{associatedTracks.map((track) => <div key={track.id}><button className="associated-track" style={{ border: 0, borderBottom: "1px solid var(--line)", borderRadius: 0 }} type="button" onClick={() => setInspectedTrackId(inspectedTrackId === track.id ? null : track.id)} aria-expanded={inspectedTrackId === track.id}>{track.artwork ? <img src={track.artwork} alt="" /> : <span className="associated-track-art-placeholder">♪</span>}<span><strong>{track.title}</strong><small>{track.artist} · {track.album}</small></span><i>Inspect</i></button>{inspectedTrackId === track.id && <div className="genre-details">{track.rationale && <section><strong>Review rationale</strong><p>{track.rationale}</p></section>}{track.basis && <section><strong>Basis</strong><p>{track.basis}</p></section>}{track.researchSources && track.researchSources.length > 0 && <section><strong>Sources</strong><div className="mapped-genre-list">{track.researchSources.map((source) => <a href={source} target="_blank" rel="noreferrer" key={source}>{source}</a>)}</div></section>}{track.track && <TrackGenreDetails track={track.track} />}</div>}</div>)}{!associatedTracks.length && <div className="candidate-empty"><span>∅</span><p>No associated tracks.</p></div>}</div>
        </section>}
      </div>
    </section>
  </main>;
}
