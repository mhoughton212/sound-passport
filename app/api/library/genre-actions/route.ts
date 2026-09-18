import { mkdir, readFile, writeFile } from "node:fs/promises";
import { buildAuthorityOutput, type Review } from "../../../../scripts/genre-review-index";
import { genres as baseGenres } from "../../../data/genres";
import type { Genre } from "../../../lib/music";
import type { ImportedTrack } from "../../../lib/library";
import { privateDataPath } from "../../../lib/private-data";

type CatalogState = { version: number; additions: Genre[]; rejectedCandidates: string[]; aliases: Record<string, string> };
type Authority = { reviews?: Record<string, Review> };
type Snapshot = { tracks?: ImportedTrack[] };
type Packet = { tracks?: Array<ImportedTrack & { source?: "spotify" | "local" | "youtube" }> };

const dataDir = privateDataPath();
const statePath = privateDataPath("catalog-state.json");
const authorityPath = privateDataPath("ai-reviewed-genres.json");
const snapshotPath = privateDataPath("imported-library.json");
const packetPath = privateDataPath("genre-review", "pending-tracks.json");

async function readState(): Promise<CatalogState> {
  try {
    const state = JSON.parse(await readFile(statePath, "utf8")) as Partial<CatalogState>;
    return { version: 1, additions: state.additions ?? [], rejectedCandidates: state.rejectedCandidates ?? [], aliases: state.aliases ?? {} };
  } catch {
    return { version: 1, additions: [], rejectedCandidates: [], aliases: {} };
  }
}

async function readTracks() {
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as Snapshot;
  let packet: Packet = {};
  try { packet = JSON.parse(await readFile(packetPath, "utf8")) as Packet; } catch { /* packet is optional */ }
  return [...new Map([...(snapshot.tracks ?? []), ...(packet.tracks ?? [])].map((track) => [track.id, track])).values()];
}

async function writeAuthority(reviews: Record<string, Review>) {
  const output = buildAuthorityOutput(reviews, await readTracks(), new Date().toISOString(), await readState());
  await writeFile(authorityPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const body = await request.json() as { action?: "add" | "reject" | "consolidate"; candidateId?: string; targetGenreId?: string; name?: string; description?: string; family?: string };
  const candidateId = body.candidateId?.trim();
  if (!body.action || !candidateId) return Response.json({ error: "An action and candidate ID are required." }, { status: 400 });

  const state = await readState();
  const catalog = [...baseGenres, ...state.additions];
  const authority = JSON.parse(await readFile(authorityPath, "utf8")) as Authority;
  const reviews = authority.reviews ?? {};

  if (body.action === "reject") {
    state.rejectedCandidates = [...new Set([...state.rejectedCandidates, candidateId])];
  } else if (body.action === "consolidate") {
    const targetGenreId = body.targetGenreId?.trim();
    if (!targetGenreId || !catalog.some((genre) => genre.id === targetGenreId)) return Response.json({ error: "Choose an existing target genre." }, { status: 400 });
    if (targetGenreId === candidateId) return Response.json({ error: "A genre cannot consolidate into itself." }, { status: 400 });
    state.aliases[candidateId] = targetGenreId;
    for (const review of Object.values(reviews)) {
      review.genreIds = [...new Set(review.genreIds.map((id) => id === candidateId ? targetGenreId : id))];
      review.missingGenreCandidates = (review.missingGenreCandidates ?? []).filter((id) => id !== candidateId);
      if (review.missingGenreCandidateJustifications) delete review.missingGenreCandidateJustifications[candidateId];
    }
    await writeAuthority(reviews);
  } else if (body.action === "add") {
    if (catalog.some((genre) => genre.id === candidateId)) return Response.json({ error: "That genre already exists in the catalog." }, { status: 409 });
    const name = body.name?.trim() || candidateId.split("-").map((word) => word ? word[0].toUpperCase() + word.slice(1) : word).join(" ");
    const family = body.family?.trim() || "Other";
    const relatedTracks = Object.entries(reviews).filter(([, review]) => review.missingGenreCandidates?.includes(candidateId)).map(([id]) => id);
    const tracks = await readTracks();
    const examples = relatedTracks.map((id) => tracks.find((track) => track.id === id)).filter((track): track is ImportedTrack => Boolean(track)).slice(0, 2).map((track, index) => ({ id: track.id, title: track.title, artist: track.artist, album: track.album, artwork: track.artwork, spotifyUrl: track.spotifyUrl, source: track.source, note: "Selected from tracks that surfaced this catalog candidate.", index }));
    state.additions.push({ id: candidateId, name, spotifyName: name, families: [family], parents: [], description: body.description?.trim() || `Music identified as ${name}.`, examples });
    for (const review of Object.values(reviews)) {
      if (!review.missingGenreCandidates?.includes(candidateId)) continue;
      review.genreIds = [...new Set([...review.genreIds, candidateId])];
      review.missingGenreCandidates = review.missingGenreCandidates.filter((id) => id !== candidateId);
      if (review.missingGenreCandidateJustifications) delete review.missingGenreCandidateJustifications[candidateId];
    }
    await writeAuthority(reviews);
    state.rejectedCandidates = state.rejectedCandidates.filter((id) => id !== candidateId);
  }

  await mkdir(dataDir, { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return Response.json({ ok: true, action: body.action, candidateId });
}
