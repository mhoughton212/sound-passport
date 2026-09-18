import { readFile, writeFile } from "node:fs/promises";
import type { ImportedTrack } from "../app/lib/library";
import type { ExampleTrack } from "../app/lib/music";
import { buildAuthorityOutput, type CatalogState, type Review } from "./genre-review-index";
import { privateDataFile } from "./private-data.mjs";

type Snapshot = { tracks?: ImportedTrack[] };
type Authority = { reviews?: Record<string, Review> };
type Examples = Record<string, ExampleTrack[]>;

const promotedGenreIds = [
  "east-coast-hip-hop",
  "west-coast-hip-hop",
  "instrumental-hip-hop",
  "pop-rap",
  "japanese-hip-hop",
  "disco",
  "pop-rock",
  "k-ballad",
  "anime-song",
  "bedroom-pop",
  "big-band",
  "video-game-music",
  "city-pop",
  "hyperpop",
  "bubblegum-pop",
  "digicore",
  "swing",
  "jazz-ballad",
  "concert-band",
  "soft-rock",
  "teen-pop",
  "industrial-hip-hop",
  "lo-fi-hip-hop",
  "new-jack-swing",
  "a-cappella",
  "film-score",
  "jersey-club",
  "punjabi",
  "christmas",
  "phonk",
] as const;

const consolidatedGenreIds: Record<string, string> = {
  "anime-score": "anime-song",
  afrobeats: "afrobeat",
  soundtrack: "film-score",
  "wind-ensemble": "concert-band",
  "punjabi-hip-hop": "punjabi",
  "korean-ballad": "k-ballad",
  "christmas-music": "christmas",
};
const removedGenreIds = new Set(["underground-hip-hop"]);

const projectUrl = new URL("../", import.meta.url);
const snapshot = JSON.parse(await readFile(privateDataFile("imported-library.json"), "utf8")) as Snapshot;
const authority = JSON.parse(await readFile(privateDataFile("ai-reviewed-genres.json"), "utf8")) as Authority;
const privateCatalogState = JSON.parse(await readFile(privateDataFile("catalog-state.json"), "utf8")) as CatalogState;
const examples = JSON.parse(await readFile(new URL("app/data/genreExamples.json", projectUrl), "utf8")) as Examples;
const tracksById = new Map((snapshot.tracks ?? []).map((track) => [track.id, track]));
const promoted = new Set<string>(promotedGenreIds);
const associatedTrackIds = new Map<string, string[]>();
const migratedReviews: Record<string, Review> = {};

for (const [trackId, review] of Object.entries(authority.reviews ?? {})) {
  const promotedFromCandidates = (review.missingGenreCandidates ?? []).filter((candidate) => promoted.has(candidate));
  const consolidatedFromCandidates = (review.missingGenreCandidates ?? [])
    .map((candidate) => consolidatedGenreIds[candidate])
    .filter((candidate): candidate is string => Boolean(candidate));
  const genreIds = [...new Set([...review.genreIds, ...promotedFromCandidates, ...consolidatedFromCandidates]
    .map((genreId) => consolidatedGenreIds[genreId] ?? genreId)
    .filter((genreId) => !removedGenreIds.has(genreId)))];
  const missingGenreCandidates = (review.missingGenreCandidates ?? []).filter((candidate) => !promoted.has(candidate) && !consolidatedGenreIds[candidate]);
  migratedReviews[trackId] = { ...review, genreIds, missingGenreCandidates };
  for (const genreId of [...promotedFromCandidates, ...consolidatedFromCandidates]) {
    associatedTrackIds.set(genreId, [...(associatedTrackIds.get(genreId) ?? []), trackId]);
  }
}

for (const genreId of [...promotedGenreIds, ...new Set(Object.values(consolidatedGenreIds))]) {
  const existing = examples[genreId] ?? [];
  const existingIds = new Set(existing.map((example) => example.id));
  const candidates = (associatedTrackIds.get(genreId) ?? [])
    .map((trackId) => tracksById.get(trackId))
    .filter((track): track is ImportedTrack => Boolean(track))
    .sort((left, right) => left.artist.localeCompare(right.artist) || left.title.localeCompare(right.title));
  const selected: ImportedTrack[] = [];
  const artists = new Set<string>();
  for (const track of candidates) {
    if (existingIds.has(track.id) || artists.has(track.artist)) continue;
    selected.push(track);
    artists.add(track.artist);
    if (selected.length === 2) break;
  }
  for (const track of candidates) {
    if (selected.length === 2 || existingIds.has(track.id) || selected.some((item) => item.id === track.id)) continue;
    selected.push(track);
  }
  examples[genreId] = [
    ...existing,
    ...selected.map((track, index) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.artwork,
      spotifyUrl: track.spotifyUrl,
      note: "Selected from the AI-reviewed tracks that surfaced this genre candidate.",
      index: existing.length + index,
    })),
  ].slice(0, 2);
}

for (const genreId of removedGenreIds) delete examples[genreId];
for (const genreId of Object.keys(consolidatedGenreIds)) delete examples[genreId];

const generatedAt = new Date().toISOString();
const output = buildAuthorityOutput(migratedReviews, snapshot.tracks ?? [], generatedAt, privateCatalogState);
await writeFile(privateDataFile("ai-reviewed-genres.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(new URL("app/data/genreExamples.json", projectUrl), `${JSON.stringify(examples, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ promotedGenreIds, promotedReviews: [...associatedTrackIds.values()].flat().length, remainingMissingGenreCandidates: output.missingGenreCandidates.length }));
