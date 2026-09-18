import { readFile, writeFile } from "node:fs/promises";
import type { ImportedTrack } from "../app/lib/library";
import { buildAuthorityOutput, type CatalogState, type Review } from "./genre-review-index";
import { privateDataFile } from "./private-data.mjs";

type Snapshot = { tracks?: ImportedTrack[] };
type Authority = { reviews?: Record<string, Review> };
type ReviewPacket = { tracks?: Array<{ id: string; title: string; artist: string; album?: string; isrc?: string | null; sources?: string[]; source?: "spotify" | "local" | "youtube"; localFileName?: string | null }> };

const snapshot = JSON.parse(await readFile(privateDataFile("imported-library.json"), "utf8")) as Snapshot;
const authority = JSON.parse(await readFile(privateDataFile("ai-reviewed-genres.json"), "utf8")) as Authority;
const privateCatalogState = JSON.parse(await readFile(privateDataFile("catalog-state.json"), "utf8")) as CatalogState;
let packet: ReviewPacket | null = null;
try {
  packet = JSON.parse(await readFile(privateDataFile("genre-review/pending-tracks.json"), "utf8")) as ReviewPacket;
} catch {
  packet = null;
}
const packetTracks = (packet?.tracks ?? []).map((track) => ({ id: track.id, title: track.title, artist: track.artist, album: track.album ?? "", artwork: null, spotifyUrl: "", source: track.source, localFileName: track.localFileName ?? undefined, isrc: track.isrc ?? null, sources: track.sources ?? [] } satisfies ImportedTrack));
const tracks = [...new Map([...(snapshot.tracks ?? []), ...packetTracks].map((track) => [track.id, track])).values()];
const output = buildAuthorityOutput(authority.reviews ?? {}, tracks, new Date().toISOString(), privateCatalogState);
await writeFile(privateDataFile("ai-reviewed-genres.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ reviews: output.trackCount, missingGenreCandidates: output.missingGenreCandidates.length }));
