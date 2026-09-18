import { mkdir, readFile, writeFile } from "node:fs/promises";
import { genres } from "../app/data/genres";
import type { ImportedTrack } from "../app/lib/library";
import type { CatalogState } from "./genre-review-index";
import { privateDataFile } from "./private-data.mjs";

type Snapshot = { tracks?: ImportedTrack[] };
type ReviewFile = { reviews?: Record<string, unknown> };

const snapshot = JSON.parse(await readFile(privateDataFile("imported-library.json"), "utf8")) as Snapshot;
const authority = JSON.parse(await readFile(privateDataFile("ai-reviewed-genres.json"), "utf8")) as ReviewFile;
const privateCatalogState = JSON.parse(await readFile(privateDataFile("catalog-state.json"), "utf8")) as CatalogState;
const tracks = snapshot.tracks ?? [];
const reviewedIds = new Set(Object.keys(authority.reviews ?? {}));
const pending = tracks
  .filter((track) => !reviewedIds.has(track.id) || track.reviewRequested)
  .sort((left, right) => left.artist.localeCompare(right.artist) || left.album.localeCompare(right.album) || left.title.localeCompare(right.title));

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  importedTrackCount: tracks.length,
  alreadyReviewedCount: tracks.length - pending.length,
  pendingTrackCount: pending.length,
  catalog: [...genres, ...(privateCatalogState.additions ?? [])].map((genre) => ({ id: genre.id, name: genre.name, families: genre.families, parents: genre.parents ?? [] })),
  tracks: pending.map((track) => ({ id: track.id, title: track.title, artist: track.artist, album: track.album, isrc: track.isrc, playlists: track.sources, reviewRequested: Boolean(track.reviewRequested) })),
};

await mkdir(privateDataFile("genre-review/"), { recursive: true });
await writeFile(privateDataFile("genre-review/pending-tracks.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ imported: tracks.length, reviewed: tracks.length - pending.length, pending: pending.length }));
