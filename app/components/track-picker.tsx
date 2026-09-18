"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCatalog } from "./catalog-context";
import { Genre, Track } from "../lib/music";
import { expandLibraryGenreHierarchy } from "../lib/library";
import { EditableContent, EditableExampleNote, EditableGenre, useContentEditor } from "./content-editor";
import { useLibrary } from "./library-context";
import TrackGenreDetails from "./track-genre-details";
import SpotifyTrackPlayer from "./spotify-track-player";

type Navigation = {
  direction: -1 | 0 | 1;
  position: number;
  total: number;
  previous?: Genre;
  next?: Genre;
};

type SearchState =
  | { query: string; status: "idle"; results: Track[] }
  | { query: string; status: "searching"; results: Track[] }
  | { query: string; status: "results"; results: Track[] }
  | { query: string; status: "error"; results: Track[] };

type SelectionState =
  | { status: "idle" }
  | { status: "checking"; trackId: string }
  | { status: "warning"; track: Track; kind: "unavailable" | "not-confirmed" | "no-data"; artistGenres: string[] };

type TrackPickerProps = {
  genre: Genre;
  current?: Track;
  navigation: Navigation;
  onNavigate: (offset: -1 | 1) => void;
  onChoose: (track: Track) => void;
  onRemove: () => void;
  onClose: () => void;
};

export default function TrackPicker({ genre, current, navigation, onNavigate, onChoose, onRemove, onClose }: TrackPickerProps) {
  const [search, setSearch] = useState("");
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [searchState, setSearchState] = useState<SearchState>({ query: "", status: "idle", results: [] });
  const [selection, setSelection] = useState<SelectionState>({ status: "idle" });
  const [resultSource, setResultSource] = useState<"spotify" | "library">("library");
  const [activeGenreTrackId, setActiveGenreTrackId] = useState<string | null>(null);
  const [playingTrackKey, setPlayingTrackKey] = useState<string | null>(null);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySort, setLibrarySort] = useState<"artist" | "track" | "album" | "imported">("artist");
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const resultButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pickerRef = useRef<HTMLElement>(null);
  const editor = useContentEditor();
  const library = useLibrary();
  const { genres } = useCatalog();
  const allLibraryMatches = useMemo(() => library.tracks.filter((track) => (track.source === "local" && track.reviewedGenreIds.length === 0) || expandLibraryGenreHierarchy(track.genreIds).includes(genre.id)), [genre.id, library.tracks]);
  const libraryMatches = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    const filtered = query ? allLibraryMatches.filter((track) => {
      const mappedGenres = track.genreIds.flatMap((id) => genres.find((item) => item.id === id)?.name ?? []);
      return [track.title, track.artist, track.album, ...(track.sources ?? []), ...mappedGenres].join(" ").toLowerCase().includes(query);
    }) : [...allLibraryMatches];
    if (librarySort === "imported") return filtered;
    return filtered.sort((left, right) => {
      const leftValue = librarySort === "track" ? left.title : librarySort === "album" ? left.album : left.artist;
      const rightValue = librarySort === "track" ? right.title : librarySort === "album" ? right.album : right.artist;
      return leftValue.localeCompare(rightValue) || left.artist.localeCompare(right.artist) || left.title.localeCompare(right.title);
    });
  }, [allLibraryMatches, genres, libraryQuery, librarySort]);

  const normalizedSearch = search.trim();
  const visibleSearch = searchState.query === normalizedSearch
    ? searchState
    : { query: normalizedSearch, status: "idle" as const, results: [] };
  const loading = visibleSearch.status === "searching";
  const displayedTracks = resultSource === "library" ? libraryMatches : visibleSearch.results;

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, []);

  useEffect(() => {
    if (normalizedSearch.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchState({ query: normalizedSearch, status: "searching", results: [] });
      try {
        const params = new URLSearchParams({ q: normalizedSearch });
        const response = await fetch(`/api/spotify/search?${params.toString()}`, { signal: controller.signal });
        const data = await response.json() as { tracks?: Track[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Search failed.");
        setSearchState({ query: normalizedSearch, status: "results", results: data.tracks ?? [] });
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") {
          setSearchState({ query: normalizedSearch, status: "error", results: [] });
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedSearch, searchAttempt]);

  function resetResultSelection() {
    setActiveResultIndex(-1);
    resultButtonRefs.current = [];
  }

  function updateSearch(value: string) {
    setSearch(value);
    setResultSource("spotify");
    setSelection({ status: "idle" });
    resetResultSelection();
  }

  const selectTrack = useCallback(async (track: Track) => {
    setSelection({ status: "checking", trackId: track.id });
    try {
      const params = new URLSearchParams({
        genre: genre.spotifyName,
        artistIds: (track.artistIds ?? []).join(","),
      });
      const response = await fetch(`/api/spotify/genre-check?${params.toString()}`);
      const data = await response.json() as { match?: boolean; dataAvailable?: boolean; artistGenres?: string[] };
      if (!response.ok) throw new Error("Genre check failed");
      if (data.match) {
        onChoose(track);
        return;
      }
      setSelection({
        status: "warning",
        track,
        kind: data.dataAvailable ? "not-confirmed" : "no-data",
        artistGenres: data.artistGenres ?? [],
      });
    } catch {
      setSelection({ status: "warning", track, kind: "unavailable", artistGenres: [] });
    }
  }, [genre.spotifyName, onChoose]);

  useEffect(() => {
    if (activeResultIndex < 0) return;
    resultButtonRefs.current[activeResultIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeResultIndex]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget = target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
      const isInput = target instanceof HTMLInputElement;

      if (event.key === "Escape") {
        onClose();
        return;
      }

      if ((event.key === "/" || event.key === "\\") && !event.altKey && !event.ctrlKey && !event.metaKey && !isInput && !isEditableTarget && !editor.editing) {
        event.preventDefault();
        (resultSource === "library" ? libraryInputRef.current : inputRef.current)?.focus();
        return;
      }

      const key = event.key.toLowerCase();
      const isPreviousResult = event.key === "ArrowUp" || key === "w";
      const isNextResult = event.key === "ArrowDown" || key === "s";
      const isSearchInput = target === inputRef.current || target === libraryInputRef.current;

      if (event.key === "Enter" && isSearchInput) {
        event.preventDefault();
        const track = displayedTracks[activeResultIndex];
        if (track && selection.status !== "checking") {
          if (resultSource === "library") onChoose(track);
          else void selectTrack(track);
        }
        pickerRef.current?.focus({ preventScroll: true });
        return;
      }

      if (event.key === "Enter" && target instanceof HTMLButtonElement && target.classList.contains("result-row")) {
        window.setTimeout(() => pickerRef.current?.focus({ preventScroll: true }), 0);
        return;
      }

      if ((isPreviousResult || isNextResult) && !isEditableTarget && !isInput && displayedTracks.length > 0 && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setActiveResultIndex((current) => {
          if (isNextResult) return current < displayedTracks.length - 1 ? current + 1 : displayedTracks.length - 1;
          return current < 0 ? displayedTracks.length - 1 : Math.max(0, current - 1);
        });
        return;
      }

      if (event.key === "Enter" && !isInput && !isEditableTarget && activeResultIndex >= 0 && selection.status !== "checking") {
        const track = displayedTracks[activeResultIndex];
        if (!track) return;
        event.preventDefault();
        if (resultSource === "library") onChoose(track);
        else void selectTrack(track);
        pickerRef.current?.focus({ preventScroll: true });
        return;
      }

      if (isEditableTarget) return;
      const isPreviousGenre = event.key === "ArrowLeft" || key === "q";
      const isNextGenre = event.key === "ArrowRight" || key === "e";
      if (!isPreviousGenre && !isNextGenre) return;
      if (isInput && !(event.key === "ArrowLeft" || event.key === "ArrowRight") ) return;
      if (isInput && target.value.length > 0) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const offset = isPreviousGenre ? -1 : 1;
      if ((offset === -1 && !navigation.previous) || (offset === 1 && !navigation.next)) return;
      event.preventDefault();
      onNavigate(offset);
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [activeResultIndex, displayedTracks, editor.editing, navigation.next, navigation.previous, onChoose, onClose, onNavigate, resultSource, selectTrack, selection.status]);

  const directionClass = navigation.direction === 1 ? "from-right" : navigation.direction === -1 ? "from-left" : "";

  return (
    <div className={`modal-backdrop ${navigation.direction ? "navigating" : ""}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <button className="side-navigation previous" onClick={() => onNavigate(-1)} disabled={!navigation.previous} aria-label={navigation.previous ? `Previous genre: ${navigation.previous.name}` : "No previous genre"} title={navigation.previous?.name}>←</button>
        <section ref={pickerRef} className={`picker ${directionClass}`} role="dialog" aria-modal="true" aria-labelledby="picker-title" tabIndex={-1}>
        <button className="close-button" onClick={onClose} aria-label="Close picker">×</button>
        <nav className="picker-navigation" aria-label="Browse genres">
          <button onClick={() => onNavigate(-1)} disabled={!navigation.previous} aria-label={navigation.previous ? `Previous genre: ${navigation.previous.name}` : "No previous genre"}>←</button>
          <span aria-label={`Genre ${navigation.position} of ${navigation.total}`}>{String(navigation.position).padStart(2, "0")} / {String(navigation.total).padStart(2, "0")}</span>
          <button onClick={() => onNavigate(1)} disabled={!navigation.next} aria-label={navigation.next ? `Next genre: ${navigation.next.name}` : "No next genre"}>→</button>
        </nav>

        <p className="eyebrow"><EditableContent contentKey="picker.heading" /> · {genre.families.join(" · ")}</p>
        <h2 id="picker-title"><EditableGenre genre={genre} field="name" /></h2>
        <p className="genre-description"><EditableGenre genre={genre} field="description" /></p>

        <section className="genre-examples" aria-labelledby="examples-title">
          <div className="examples-heading">
            <div><h3 id="examples-title"><EditableContent contentKey="picker.examplesHeading" /></h3><p><EditableContent contentKey="picker.examplesHelp" /></p></div>
          </div>
          <div className="example-list">
            {genre.examples.map((example) => (
              <div className={`example-row ${playingTrackKey === `example:${example.index}:${example.id}` ? "active" : ""}`} key={`${example.index}-${example.id}`}>
                <button className="example-main" onClick={() => setPlayingTrackKey(playingTrackKey === `example:${example.index}:${example.id}` ? null : `example:${example.index}:${example.id}`)} aria-label={`${editor.copy["picker.playExample"]}: ${example.title} by ${example.artist}`}>
                  <span className="track-artwork-action">
                    {example.artwork ? <img src={example.artwork} alt="" /> : <span className="art-placeholder">♪</span>}
                    <span aria-hidden="true" className={playingTrackKey === `example:${example.index}:${example.id}` ? "close-icon" : "play-icon"} />
                  </span>
                  <span><strong>{example.title}</strong><small>{example.artist}</small><EditableExampleNote genreId={genre.id} index={example.index} note={example.note} /></span>
                </button>
                {playingTrackKey === `example:${example.index}:${example.id}` && <SpotifyTrackPlayer track={example} />}
              </div>
            ))}
          </div>
        </section>

        {current && (
          <div className={`current-track-section ${playingTrackKey === `current:${current.id}` ? "playing" : ""}`}>
            <div className="current-track">
              <span className="current-track-art">
                {current.artwork ? <img src={current.artwork} alt="" /> : <span className="art-placeholder">♪</span>}
                <button className="track-play-overlay" type="button" aria-label={`${playingTrackKey === `current:${current.id}` ? "Close player for" : "Play"} ${current.title} by ${current.artist}`} onClick={() => setPlayingTrackKey(playingTrackKey === `current:${current.id}` ? null : `current:${current.id}`)}><span aria-hidden="true" className={playingTrackKey === `current:${current.id}` ? "close-icon" : "play-icon"} /></button>
              </span>
              <div><small><EditableContent contentKey="picker.currentSelection" /></small><strong>{current.title}</strong><p>{current.artist}</p></div>
              <button className="current-track-remove" onClick={editor.editing ? (event) => { event.preventDefault(); editor.editContent("picker.remove"); } : onRemove}><EditableContent contentKey="picker.remove" /></button>
            </div>
            {playingTrackKey === `current:${current.id}` && <SpotifyTrackPlayer track={current} />}
          </div>
        )}

        <div className="picker-source-tabs" role="tablist" aria-label="Track source">
          <button role="tab" aria-selected={resultSource === "library"} className={resultSource === "library" ? "active" : ""} onClick={() => { setResultSource("library"); resetResultSelection(); }}>Your library <span>{allLibraryMatches.length}</span></button>
          <button role="tab" aria-selected={resultSource === "spotify"} className={resultSource === "spotify" ? "active" : ""} onClick={() => { setResultSource("spotify"); resetResultSelection(); }}>Search Spotify</button>
        </div>

        {resultSource === "spotify" ? (
          <label className={`track-search ${editor.editing ? "editable-field" : ""}`}>
            <span>⌕</span>
            <input ref={inputRef} value={search} onChange={(event) => updateSearch(event.target.value)} onClick={editor.editing ? (event) => { event.preventDefault(); editor.editContent(current ? "picker.searchReplace" : "picker.search"); } : undefined} placeholder={current ? editor.copy["picker.searchReplace"] : editor.copy["picker.search"]} aria-label="Search Spotify tracks" readOnly={editor.editing} />
            {loading && <i />}
          </label>
        ) : (
          <div className="library-match-tools">
            <label className="library-match-search"><span>⌕</span><input ref={libraryInputRef} value={libraryQuery} onChange={(event) => { setLibraryQuery(event.target.value); resetResultSelection(); }} placeholder={`Search ${genre.name} tracks…`} aria-label={`Search your ${genre.name} library tracks`} /></label>
            <label className="library-sort"><span>Sort</span><select value={librarySort} onChange={(event) => { setLibrarySort(event.target.value as typeof librarySort); resetResultSelection(); }}><option value="artist">Artist A–Z</option><option value="track">Track A–Z</option><option value="album">Album A–Z</option><option value="imported">Import order</option></select></label>
            <div className="library-match-summary"><strong>{libraryMatches.length}{libraryMatches.length !== allLibraryMatches.length ? ` of ${allLibraryMatches.length}` : ""} matches</strong><span>Local files remain available while they wait for genre review.</span></div>
          </div>
        )}

        {selection.status === "warning" && (
          <div className="genre-warning" role="status">
            <strong><EditableContent contentKey={selection.kind === "unavailable" ? "picker.genreCheckUnavailable" : selection.kind === "not-confirmed" ? "picker.genreNotConfirmed" : "picker.noGenreData"} /></strong>
            <p>{selection.kind === "unavailable"
              ? "Spotify could not complete the artist genre check."
              : selection.kind === "not-confirmed"
                ? `Spotify lists ${selection.track.artist} under: ${selection.artistGenres.join(", ")}. ${genre.name} is not included.`
                : `Spotify does not provide artist genre data for ${selection.track.artist}.`}</p>
            <small><EditableContent contentKey="picker.genreCheckNote" /></small>
            <div>
              <button className="confirm" onClick={() => onChoose(selection.track)}><EditableContent contentKey="picker.addAnyway" /></button>
              <button onClick={() => setSelection({ status: "idle" })}><EditableContent contentKey="picker.cancel" /></button>
            </div>
          </div>
        )}

        <div className="results" aria-live="polite">
          {resultSource === "spotify" && !search && !current && <div className="picker-empty"><span>♪</span><p><EditableContent contentKey="picker.searchHelp" /></p></div>}
          {resultSource === "spotify" && visibleSearch.status === "error" && <div className="search-error"><strong><EditableContent contentKey="picker.spotifyErrorTitle" /></strong><p><EditableContent contentKey="picker.spotifyErrorHelp" /></p><button type="button" onClick={() => setSearchAttempt((attempt) => attempt + 1)}><EditableContent contentKey="picker.retrySearch" /></button></div>}
          {resultSource === "spotify" && visibleSearch.status === "results" && normalizedSearch.length >= 2 && visibleSearch.results.length === 0 && <div className="picker-empty"><span>∅</span><p><EditableContent contentKey="picker.noResults" /></p></div>}
          {resultSource === "library" && libraryMatches.length === 0 && <div className="picker-empty"><span>∅</span><p>{libraryQuery ? `No ${genre.name} tracks match “${libraryQuery}”.` : library.tracks.length ? "No imported tracks match this genre yet." : "Import your Spotify library from the Library button first."}</p></div>}
          {displayedTracks.map((track, index) => {
            const importedTrack = resultSource === "library" ? libraryMatches.find((item) => item.id === track.id) ?? null : null;
            if (!importedTrack) return (
              <div className={`track-result ${playingTrackKey === `result:${track.id}` ? "playing" : ""}`} key={track.id}>
                <div className="track-result-head">
                  <button ref={(node) => { resultButtonRefs.current[index] = node; }} className={`result-row ${activeResultIndex === index ? "keyboard-active" : ""}`} onClick={() => selectTrack(track)} disabled={selection.status === "checking"}>
                    {track.artwork ? <img src={track.artwork} alt="" /> : <span className="art-placeholder">♪</span>}
                    <span><strong>{track.title}</strong><small>{track.artist} · {track.album}</small></span>
                    <i><EditableContent contentKey={selection.status === "checking" && selection.trackId === track.id ? "picker.checking" : "picker.select"} /></i>
                  </button>
                  <button className="track-play-overlay" type="button" aria-label={`${playingTrackKey === `result:${track.id}` ? "Close player for" : "Play"} ${track.title} by ${track.artist}`} onClick={() => setPlayingTrackKey(playingTrackKey === `result:${track.id}` ? null : `result:${track.id}`)}><span aria-hidden="true" className={playingTrackKey === `result:${track.id}` ? "close-icon" : "play-icon"} /></button>
                </div>
                {playingTrackKey === `result:${track.id}` && <SpotifyTrackPlayer track={track} />}
              </div>
            );

            const detailsOpen = activeGenreTrackId === importedTrack.id;
            return (
              <div className={`library-result ${detailsOpen ? "details-open" : ""}`} key={track.id}>
                <div className="library-result-head">
                  <button ref={(node) => { resultButtonRefs.current[index] = node; }} className={`result-row ${activeResultIndex === index ? "keyboard-active" : ""}`} onClick={() => onChoose(track)}>
                    {track.artwork ? <img src={track.artwork} alt="" /> : <span className="art-placeholder">♪</span>}
                    <span><strong>{track.title}</strong><small>{track.artist} · {track.album}</small>{importedTrack.reviewRequested && <em className="track-review-status">Re-review queued</em>}</span>
                    <i><EditableContent contentKey="picker.select" /></i>
                  </button>
                  <button className="track-play-overlay" type="button" aria-label={`${playingTrackKey === `result:${track.id}` ? "Close player for" : "Play"} ${track.title} by ${track.artist}`} onClick={() => setPlayingTrackKey(playingTrackKey === `result:${track.id}` ? null : `result:${track.id}`)}><span aria-hidden="true" className={playingTrackKey === `result:${track.id}` ? "close-icon" : "play-icon"} /></button>
                  <button className="genre-details-toggle" type="button" aria-expanded={detailsOpen} aria-controls={`track-genres-${track.id}`} onClick={() => setActiveGenreTrackId(detailsOpen ? null : track.id)}>{detailsOpen ? "Close inspect" : "Inspect genres"}</button>
                </div>
                {playingTrackKey === `result:${track.id}` && <SpotifyTrackPlayer track={track} />}
                {detailsOpen && (
                  <div id={`track-genres-${track.id}`} role="region" aria-label={`Reviewed genres for ${track.title}`}><TrackGenreDetails track={importedTrack} onRequestReview={() => library.requestReview(importedTrack.id)} onCancelReview={() => library.cancelReview(importedTrack.id)} /></div>
                )}
              </div>
            );
          })}
        </div>

        <div className="spotify-note"><span className="spotify-dot">●</span> {resultSource === "library" ? <EditableContent contentKey="picker.libraryResultsSource" /> : <EditableContent contentKey="picker.resultsSource" />} <span>·</span> <EditableContent contentKey="picker.limitNote" /></div>
      </section>
      <button className="side-navigation next" onClick={() => onNavigate(1)} disabled={!navigation.next} aria-label={navigation.next ? `Next genre: ${navigation.next.name}` : "No next genre"} title={navigation.next?.name}>→</button>
    </div>
  );
}
