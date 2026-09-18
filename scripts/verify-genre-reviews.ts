import { readFile } from "node:fs/promises";
import { genres } from "../app/data/genres";
import type { ImportedTrack } from "../app/lib/library";
import type { CatalogState } from "./genre-review-index";
import { privateDataFile } from "./private-data.mjs";

type Snapshot = { trackCount?: number; tracks?: ImportedTrack[] };
type ReviewPacket = { tracks?: Array<{ id: string; title: string; artist: string; album?: string; isrc?: string | null; sources?: string[]; source?: "spotify" | "local" | "youtube"; localFileName?: string | null }> };
type Review = { genreIds?: string[]; basis?: string; rationale?: string; researchSources?: string[]; missingGenreCandidates?: string[]; missingGenreCandidateJustifications?: Record<string, string>; title?: string; artist?: string };
type CandidateSummary = { id: string; count: number; classification: string; relatedGenreIds: string[]; justifications?: Array<{ trackId: string; title: string; artist: string; justification: string }> };
type Authority = { trackCount?: number; missingGenreCandidates?: CandidateSummary[]; missingGenreCandidateIds?: string[]; reviews?: Record<string, Review> };

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
const reviews = authority.reviews ?? {};
const validGenreIds = new Set([...genres, ...(privateCatalogState.additions ?? [])].map((genre) => genre.id));
const rejectedCandidates = new Set<string>(privateCatalogState.rejectedCandidates ?? []);
const importedIds = new Set(tracks.map((track) => track.id));
const errors: string[] = [];

if (importedIds.size !== tracks.length) errors.push("Imported library contains duplicate track IDs.");
if (snapshot.trackCount !== undefined && snapshot.trackCount !== (snapshot.tracks ?? []).length) errors.push(`Snapshot count says ${snapshot.trackCount}, but contains ${(snapshot.tracks ?? []).length} tracks.`);
if (authority.trackCount !== undefined && authority.trackCount !== Object.keys(reviews).length) errors.push(`Review count says ${authority.trackCount}, but contains ${Object.keys(reviews).length} reviews.`);
const expectedMissingGenreCandidateIds = [...new Set(Object.values(reviews).flatMap((review) => (review.missingGenreCandidates ?? []).filter((candidate) => !validGenreIds.has(candidate) && !rejectedCandidates.has(candidate))))].sort((left, right) => left.localeCompare(right));
if (JSON.stringify(authority.missingGenreCandidateIds ?? []) !== JSON.stringify(expectedMissingGenreCandidateIds)) errors.push("Consolidated missing genre candidate IDs are out of sync with the reviews.");
if (new Set(authority.missingGenreCandidateIds ?? []).size !== (authority.missingGenreCandidateIds ?? []).length) errors.push("Consolidated missing genre candidate IDs contain duplicates.");
const expectedCandidateCounts = new Map<string, number>();
for (const review of Object.values(reviews)) for (const candidate of (review.missingGenreCandidates ?? []).filter((id) => !validGenreIds.has(id) && !rejectedCandidates.has(id))) expectedCandidateCounts.set(candidate, (expectedCandidateCounts.get(candidate) ?? 0) + 1);
const candidateSummary = authority.missingGenreCandidates ?? [];
if (candidateSummary.length !== expectedCandidateCounts.size) errors.push("Candidate summary is out of sync with the reviews.");
for (let index = 0; index < candidateSummary.length; index++) {
  const candidate = candidateSummary[index];
  if (candidate.count !== expectedCandidateCounts.get(candidate.id)) errors.push(`${candidate.id} has an incorrect candidate count.`);
  if (index > 0 && (candidateSummary[index - 1].count < candidate.count || (candidateSummary[index - 1].count === candidate.count && candidateSummary[index - 1].id.localeCompare(candidate.id) > 0))) errors.push("Candidate summary is not sorted by frequency.");
}
for (const [trackId, review] of Object.entries(reviews)) {
  if (!Array.isArray(review.genreIds) || review.genreIds.length === 0) errors.push(`${trackId} has no reviewed genres.`);
  if (new Set(review.genreIds ?? []).size !== (review.genreIds ?? []).length) errors.push(`${trackId} repeats a genre.`);
  for (const genreId of review.genreIds ?? []) if (!validGenreIds.has(genreId)) errors.push(`${trackId} uses unknown genre ${genreId}.`);
  if (!review.rationale?.trim()) errors.push(`${trackId} has no rationale.`);
  if (!review.basis || !["track", "release", "artist", "work"].includes(review.basis)) errors.push(`${trackId} has invalid review basis.`);
  if (!review.title?.trim() || !review.artist?.trim()) errors.push(`${trackId} is missing readable track metadata.`);
  for (const source of review.researchSources ?? []) if (!/^https?:\/\//.test(source)) errors.push(`${trackId} has invalid research source ${source}.`);
  for (const [candidate, justification] of Object.entries(review.missingGenreCandidateJustifications ?? {})) {
    if (!review.missingGenreCandidates?.includes(candidate)) errors.push(`${trackId} has a justification for an unlisted missing genre candidate ${candidate}.`);
    if (!justification.trim()) errors.push(`${trackId} has an empty justification for ${candidate}.`);
  }
}

const pending = tracks.filter((track) => !reviews[track.id]);
const orphaned = Object.keys(reviews).filter((trackId) => !importedIds.has(trackId));
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
console.log(JSON.stringify({ valid: errors.length === 0, imported: tracks.length, reviewed: tracks.length - pending.length, pending: pending.length, authorityReviews: Object.keys(reviews).length, orphanedReviews: orphaned.length }));
