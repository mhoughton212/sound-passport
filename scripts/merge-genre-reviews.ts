import { mkdir, readFile, writeFile } from "node:fs/promises";
import { genres } from "../app/data/genres";
import type { ImportedTrack } from "../app/lib/library";
import { buildAuthorityOutput, type CatalogState, type Review } from "./genre-review-index";
import { privateDataFile } from "./private-data.mjs";

type Snapshot = { tracks?: ImportedTrack[] };
type Authority = { reviews?: Record<string, Review & { reviewedAt?: string }> };
type PendingReviews = { reviews?: Record<string, Review> };
type ReviewPacket = {
  tracks?: Array<{
    id: string;
    title: string;
    artist: string;
    album?: string;
    isrc?: string | null;
    sources?: string[];
    source?: "spotify" | "local" | "youtube";
    localFileName?: string | null;
    reviewRequested?: boolean;
  }>;
};

const authorityUrl = privateDataFile("ai-reviewed-genres.json");
const pendingReviewsUrl = privateDataFile("genre-review/pending-reviews.json");
const pendingPacketUrl = privateDataFile("genre-review/pending-tracks.json");
const snapshot = JSON.parse(await readFile(privateDataFile("imported-library.json"), "utf8")) as Snapshot;
const authority = JSON.parse(await readFile(authorityUrl, "utf8")) as Authority;
const privateCatalogState = JSON.parse(await readFile(privateDataFile("catalog-state.json"), "utf8")) as CatalogState;
const incoming = JSON.parse(await readFile(pendingReviewsUrl, "utf8")) as PendingReviews;
let packet: ReviewPacket | null = null;
try {
  packet = JSON.parse(await readFile(pendingPacketUrl, "utf8")) as ReviewPacket;
} catch {
  packet = null;
}
const existing = authority.reviews ?? {};
const reviews = incoming.reviews ?? {};
const packetTracks = (packet?.tracks ?? []).map((track) => ({
  id: track.id,
  title: track.title,
  artist: track.artist,
  album: track.album ?? "",
  artwork: null,
  spotifyUrl: "",
  source: track.source,
  localFileName: track.localFileName ?? undefined,
  isrc: track.isrc ?? null,
  sources: track.sources ?? [],
  reviewRequested: Boolean(track.reviewRequested),
} satisfies ImportedTrack));
const allTracks = [...new Map([...(snapshot.tracks ?? []), ...packetTracks].map((track) => [track.id, track])).values()];
const importedTracks = packetTracks.length ? packetTracks : snapshot.tracks ?? [];
const importedIds = new Set(importedTracks.map((track) => track.id));
const requestedIds = new Set(importedTracks.filter((track) => track.reviewRequested).map((track) => track.id));
const expectedIds = [...importedIds].filter((trackId) => !existing[trackId] || requestedIds.has(trackId)).sort();
const incomingIds = Object.keys(reviews).sort();
const validGenreIds = new Set([...genres, ...(privateCatalogState.additions ?? [])].map((genre) => genre.id));
const errors: string[] = [];

if (expectedIds.length === 0) errors.push("There are no new imported tracks to review.");
if (expectedIds.join("\n") !== incomingIds.join("\n")) errors.push(`Pending reviews must cover exactly the ${expectedIds.length} new imported tracks.`);
for (const [trackId, review] of Object.entries(reviews)) {
  if (!importedIds.has(trackId)) errors.push(`${trackId} is not in the imported library.`);
  if (existing[trackId] && !requestedIds.has(trackId)) errors.push(`${trackId} is already reviewed and was not explicitly requested for re-review.`);
  if (!Array.isArray(review.genreIds) || review.genreIds.length === 0) errors.push(`${trackId} has no genres.`);
  for (const genreId of review.genreIds ?? []) if (!validGenreIds.has(genreId)) errors.push(`${trackId} uses unknown genre ${genreId}.`);
  if (!review.rationale?.trim()) errors.push(`${trackId} has no rationale.`);
  if (!["track", "release", "artist", "work"].includes(review.basis)) errors.push(`${trackId} has invalid basis.`);
  for (const [candidate, justification] of Object.entries(review.missingGenreCandidateJustifications ?? {})) {
    if (!review.missingGenreCandidates?.includes(candidate)) errors.push(`${trackId} has a justification for an unlisted missing genre candidate ${candidate}.`);
    if (!justification.trim()) errors.push(`${trackId} has an empty justification for ${candidate}.`);
  }
}
if (errors.length) throw new Error(errors.join("\n"));

const reviewedAt = new Date().toISOString();
const merged = { ...existing };
for (const [trackId, review] of Object.entries(reviews)) merged[trackId] = { ...review, reviewedAt };
const output = buildAuthorityOutput(merged, allTracks, reviewedAt, privateCatalogState);
await writeFile(authorityUrl, `${JSON.stringify(output, null, 2)}\n`, "utf8");
const archiveUrl = privateDataFile(`genre-review/reviews/merged-${reviewedAt.replace(/[:.]/g, "-")}.json`);
await mkdir(privateDataFile("genre-review/reviews/"), { recursive: true });
await writeFile(archiveUrl, `${JSON.stringify({ version: 1, mergedAt: reviewedAt, reviews }, null, 2)}\n`, "utf8");
await writeFile(pendingReviewsUrl, `${JSON.stringify({ version: 1, reviews: {} }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ merged: incomingIds.length, authorityReviews: Object.keys(merged).length, metadataSource: packetTracks.length ? "pending-tracks.json plus existing snapshot" : "imported-library.json", archive: archiveUrl.pathname }));
