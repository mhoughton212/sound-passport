"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCatalog } from "./catalog-context";
import { Track } from "../lib/music";
import { useAssignments } from "../lib/use-assignments";
import { EditableContent, EditableGenre, useContentEditor } from "./content-editor";
import { useLibrary } from "./library-context";
import LibraryManager from "./library-manager";
import SpotifyTrackPlayer from "./spotify-track-player";
import TrackPicker from "./track-picker";
import AppTabs from "./app-tabs";

export default function Passport() {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("All genres");
  const [completion, setCompletion] = useState<"all" | "unfilled" | "filled">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [navigationDirection, setNavigationDirection] = useState<-1 | 0 | 1>(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [playingCardGenreId, setPlayingCardGenreId] = useState<string | null>(null);
  const [exportState, setExportState] = useState<"idle" | "exporting" | "exported" | "error">("idle");
  const [exportMessage, setExportMessage] = useState("");
  const [exportNeedsReconnect, setExportNeedsReconnect] = useState(false);
  const { assignments, assign, remove } = useAssignments();
  const library = useLibrary();
  const { genres, genreFamilies } = useCatalog();
  const editor = useContentEditor();
  const catalog = useMemo(() => genres.map(editor.resolveGenre), [editor.resolveGenre, genres]);
  const closeLibrary = useCallback(() => setLibraryOpen(false), []);

  useEffect(() => {
    if (!exportMessage) return;
    const timeout = window.setTimeout(() => setExportMessage(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [exportMessage]);

  const filtered = useMemo(() => catalog.filter((genre) =>
    (family === "All genres" || genre.families.includes(family))
    && (completion === "all" || (completion === "filled" ? Boolean(assignments[genre.id]) : !assignments[genre.id]))
    && `${genre.name} ${genre.families.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())), [assignments, catalog, completion, family, query]);

  const assignedCount = Object.keys(assignments).length;
  const assignedTracks = useMemo(() => {
    const seen = new Set<string>();
    return catalog.map((genre) => assignments[genre.id]).filter((track): track is Track => {
      if (!track || seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    });
  }, [assignments, catalog]);
  const spotifyTracks = useMemo(() => assignedTracks.filter((track) => track.source !== "local" && track.source !== "youtube"), [assignedTracks]);
  const nonSpotifyCount = assignedTracks.length - spotifyTracks.length;
  const playingCardTrack = playingCardGenreId ? assignments[playingCardGenreId] : undefined;
  const selected = selectedId ? catalog.find((genre) => genre.id === selectedId) ?? null : null;
  const selectedIndex = selected ? filtered.findIndex((genre) => genre.id === selected.id) : -1;

  const navigateSelected = useCallback((offset: -1 | 1) => {
    const next = filtered[selectedIndex + offset];
    if (!next) return;
    setNavigationDirection(offset);
    setSelectedId(next.id);
  }, [filtered, selectedIndex]);

  const chooseTrack = useCallback((genreId: string, track: Track) => {
    assign(genreId, track);
  }, [assign]);

  const removeTrack = useCallback((genreId: string) => {
    remove(genreId);
    setPlayingCardGenreId((playingId) => playingId === genreId ? null : playingId);
    setSelectedId(null);
  }, [remove]);

  const exportPlaylist = useCallback(async () => {
    if (!assignedTracks.length) return;
    setExportState("exporting");
    setExportMessage("");
    setExportNeedsReconnect(false);
    try {
      if (!spotifyTracks.length) {
        setExportState("error");
        setExportMessage("Your selections are local or YouTube tracks; there are no Spotify tracks to export.");
        return;
      }
      const response = await fetch("/api/spotify/playlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trackIds: spotifyTracks.map((track) => track.id) }) });
      const data = await response.json() as { error?: string; code?: string; playlistUrl?: string | null; trackCount?: number };
      if (!response.ok) {
        setExportNeedsReconnect(data.code === "spotify_not_connected" || data.code === "spotify_reconnect_required");
        throw new Error(data.error || "Playlist export failed.");
      }
      setExportState("exported");
      setExportMessage(`${data.trackCount ?? spotifyTracks.length} tracks exported to Spotify${nonSpotifyCount ? ` · ${nonSpotifyCount} local/YouTube selections stayed in Sound Passport` : ""}.`);
      if (data.playlistUrl) window.open(data.playlistUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setExportState("error");
      setExportMessage(error instanceof Error ? error.message : "Playlist export failed.");
    }
  }, [assignedTracks, nonSpotifyCount, spotifyTracks]);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label={`${editor.copy["brand.name"]} home`}>
          <span className="brand-mark">S</span>
          <EditableContent contentKey="brand.name" />
        </a>
        <AppTabs current="passport" />
        <div className="header-actions">
          <div className="header-collection" aria-label={`${assignedCount} of ${catalog.length} genres assigned`}>
            <div className="header-collection-copy">
              <EditableContent contentKey="collection.label" className="header-collection-label" />
              <strong><span>{assignedCount}</span><small>/ {catalog.length}</small></strong>
            </div>
            <div className="header-progress"><i style={{ width: `${(assignedCount / catalog.length) * 100}%` }} /></div>
          </div>
          <button className={`export-playlist-button ${exportState === "exported" ? "success" : ""}`} onClick={exportNeedsReconnect || (!library.connected && spotifyTracks.length > 0) ? library.connect : () => void exportPlaylist()} disabled={!assignedTracks.length || exportState === "exporting"} title={!assignedTracks.length ? "Choose tracks for genre cards first" : undefined}>{exportState === "exporting" ? "Exporting…" : !assignedTracks.length ? "Add a track to export" : !spotifyTracks.length ? "No Spotify tracks to export" : exportNeedsReconnect || !library.connected ? "Connect Spotify to export" : "Export playlist to Spotify"}</button>
          <button className="library-toggle" onClick={() => setLibraryOpen(true)}><span>♫</span> Library{library.progress.phase === "importing" ? " · importing" : library.tracks.length > 0 ? ` · ${library.tracks.length}` : ""}</button>
          {editor.available && <button className={`edit-copy-toggle ${editor.editing ? "active" : ""}`} onClick={editor.toggleEditing}>{editor.editing ? "Done" : "Edit text"}</button>}
          <div className="collection-status"><span /> <EditableContent contentKey="header.savedLocally" /></div>
        </div>
        {exportMessage && <div className={`export-playlist-status ${exportState === "error" ? "error" : ""}`} role="status">{exportMessage}</div>}
      </header>

      <section className="library" id="top" aria-labelledby="library-title">
        <h1 id="library-title" className="sr-only">Sound Passport genre collection</h1>
        <div className="section-heading">
          <p>{filtered.length} genres</p>
          <div className="section-heading-tools">
            <label className={`search-field ${editor.editing ? "editable-field" : ""}`}>
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} onClick={editor.editing ? (event) => { event.preventDefault(); editor.editContent("library.searchPlaceholder"); } : undefined} placeholder={editor.copy["library.searchPlaceholder"]} aria-label={editor.copy["library.searchPlaceholder"]} readOnly={editor.editing} />
            </label>
            <label className="passport-view-filter">
              <span>Show</span>
              <select value={completion} onChange={(event) => setCompletion(event.target.value as typeof completion)} aria-label="Show genres by completion">
                <option value="all">All genres</option>
                <option value="unfilled">Unfilled</option>
                <option value="filled">Filled</option>
              </select>
            </label>
          </div>
        </div>

        <nav className="filters" aria-label="Genre families">
          {genreFamilies.map((item) => {
            const familyGenre = catalog.find((genre) => genre.spotifyName === item);
              return <button key={item} className={family === item ? "active" : ""} onClick={() => setFamily(item)}>{item === "All genres" ? <EditableContent contentKey="filters.allGenres" /> : familyGenre ? <EditableGenre genre={familyGenre} field="name" /> : item}</button>;
          })}
        </nav>

        {filtered.length ? (
          <div className="genre-grid" key={`${family}-${completion}`}>
            {filtered.map((genre, index) => {
              const track = assignments[genre.id];
              const hasLongWord = genre.name.split(/\s+/).some((word) => word.length >= 11);
              return (
                <div
                  className={`genre-card-shell ${track ? "filled" : ""} ${playingCardGenreId === genre.id ? "playing" : ""}`}
                  key={genre.id}
                  style={{ "--delay": `${Math.min(index, 16) * 28}ms` } as React.CSSProperties}
                >
                  <button
                    className={`genre-card ${track ? "filled" : ""}`}
                    onClick={() => { setPlayingCardGenreId(null); setNavigationDirection(0); setSelectedId(genre.id); }}
                    aria-label={`${genre.name}${track ? `: ${track.title} by ${track.artist}. Replace track` : ": select track"}`}
                  >
                    {track?.artwork && <img src={track.artwork} alt="" />}
                    <span className="card-shade" />
                    <span className="card-family">{genre.families.join(" · ")}</span>
                    <span className="card-number">{String(catalog.findIndex((item) => item.id === genre.id) + 1).padStart(2, "0")}</span>
                    <span className="card-copy">
                      <EditableGenre genre={genre} field="name" className={`card-name${hasLongWord ? " long-word" : ""}`} />
                      {track ? (
                        <span className="track-summary"><b>{track.title}</b><small>{track.artist}</small><i><EditableContent contentKey="card.replaceTrack" /> →</i></span>
                      ) : (
                        <span className="empty-state"><i>＋</i> <EditableContent contentKey="card.selectTrack" /></span>
                      )}
                    </span>
                  </button>
                  {track && <button className="card-play-overlay" type="button" aria-label={`${playingCardGenreId === genre.id ? "Close player for" : "Play"} ${track.title} by ${track.artist}`} onClick={() => setPlayingCardGenreId(playingCardGenreId === genre.id ? null : genre.id)}><span aria-hidden="true" className={playingCardGenreId === genre.id ? "close-icon" : "play-icon"} /></button>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-genres"><span>∅</span><h3><EditableContent contentKey="empty.title" /></h3><p><EditableContent contentKey="empty.help" /></p></div>
        )}
      </section>

      <footer><EditableContent contentKey="footer.name" /><a href="#top"><EditableContent contentKey="footer.top" /></a></footer>

      {playingCardTrack && (
        <aside className="card-player-dock" aria-label={`Playing ${playingCardTrack.title} by ${playingCardTrack.artist}`}>
          <SpotifyTrackPlayer track={playingCardTrack} />
        </aside>
      )}

      {libraryOpen && <LibraryManager onClose={closeLibrary} />}

      {selected && (
        <TrackPicker
          key={selected.id}
          genre={selected}
          current={assignments[selected.id]}
          navigation={{
            direction: navigationDirection,
            position: selectedIndex + 1,
            total: filtered.length,
            previous: filtered[selectedIndex - 1],
            next: filtered[selectedIndex + 1],
          }}
          onNavigate={navigateSelected}
          onChoose={(track) => chooseTrack(selected.id, track)}
          onRemove={() => removeTrack(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </main>
  );
}
