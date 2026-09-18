import type { ImportedTrack } from "../app/lib/library";
import type { Genre } from "../app/lib/music";
import { genres } from "../app/data/genres";
import catalogState from "../data/catalog-state.json";

export type CatalogState = {
  version: number;
  additions: Genre[];
  rejectedCandidates: string[];
  aliases: Record<string, string>;
};

export type Review = {
  genreIds: string[];
  basis: "track" | "release" | "artist" | "work";
  rationale: string;
  researchSources?: string[];
  missingGenreCandidates?: string[];
  missingGenreCandidateJustifications?: Record<string, string>;
  reviewedAt?: string;
  title?: string;
  artist?: string;
};

export type CandidateClassification = "same-as-existing" | "near-existing" | "candidate-alias" | "distinct";

export type MissingGenreCandidate = {
  id: string;
  count: number;
  classification: CandidateClassification;
  relatedGenreIds: string[];
  justifications: Array<{ trackId: string; title: string; artist: string; justification: string }>;
};

const candidateRelations: Record<string, { classification: CandidateClassification; relatedGenreIds: string[] }> = {
  "east-coast-hip-hop": { classification: "same-as-existing", relatedGenreIds: ["east-coast-hip-hop"] },
  "west-coast-hip-hop": { classification: "same-as-existing", relatedGenreIds: ["west-coast-hip-hop"] },
  "instrumental-hip-hop": { classification: "same-as-existing", relatedGenreIds: ["instrumental-hip-hop"] },
  "pop-rap": { classification: "same-as-existing", relatedGenreIds: ["pop-rap"] },
  "japanese-hip-hop": { classification: "same-as-existing", relatedGenreIds: ["japanese-hip-hop"] },
  "disco": { classification: "same-as-existing", relatedGenreIds: ["disco"] },
  "pop-rock": { classification: "same-as-existing", relatedGenreIds: ["pop-rock"] },
  "k-ballad": { classification: "same-as-existing", relatedGenreIds: ["k-ballad"] },
  "anime-song": { classification: "same-as-existing", relatedGenreIds: ["anime-song"] },
  "bedroom-pop": { classification: "same-as-existing", relatedGenreIds: ["bedroom-pop"] },
  "big-band": { classification: "same-as-existing", relatedGenreIds: ["big-band"] },
  "video-game-music": { classification: "same-as-existing", relatedGenreIds: ["video-game-music"] },
  "city-pop": { classification: "same-as-existing", relatedGenreIds: ["city-pop"] },
  "afrobeats": { classification: "same-as-existing", relatedGenreIds: ["afrobeat"] },
  "gothic-rock": { classification: "same-as-existing", relatedGenreIds: ["gothic-rock"] },
  "soundtrack": { classification: "same-as-existing", relatedGenreIds: ["soundtrack"] },
  "southern-hip-hop": { classification: "same-as-existing", relatedGenreIds: ["southern-hip-hop"] },
  "spiritual-jazz": { classification: "same-as-existing", relatedGenreIds: ["spiritual-jazz"] },
  "korean-ballad": { classification: "candidate-alias", relatedGenreIds: [] },
  "alternative-hip-hop": { classification: "near-existing", relatedGenreIds: ["abstract-hip-hop", "experimental-hip-hop"] },
  "atlanta-hip-hop": { classification: "near-existing", relatedGenreIds: ["hip-hop", "trap"] },
  "detroit-hip-hop": { classification: "near-existing", relatedGenreIds: ["hip-hop"] },
  "midwest-hip-hop": { classification: "near-existing", relatedGenreIds: ["hip-hop"] },
  "uk-hip-hop": { classification: "near-existing", relatedGenreIds: ["hip-hop"] },
  "k-rap": { classification: "near-existing", relatedGenreIds: ["hip-hop", "k-pop"] },
  "g-funk": { classification: "near-existing", relatedGenreIds: ["funk", "gangsta-rap"] },
  "mafioso-rap": { classification: "near-existing", relatedGenreIds: ["gangsta-rap"] },
  "industrial-hip-hop": { classification: "near-existing", relatedGenreIds: ["industrial", "experimental-hip-hop"] },
  "jazz-ballad": { classification: "near-existing", relatedGenreIds: ["jazz"] },
  "nu-jazz": { classification: "near-existing", relatedGenreIds: ["jazz", "jazz-fusion"] },
  "acid-jazz": { classification: "near-existing", relatedGenreIds: ["jazz", "funk"] },
  "jazz-funk": { classification: "near-existing", relatedGenreIds: ["jazz", "funk"] },
  "modal-jazz": { classification: "near-existing", relatedGenreIds: ["jazz"] },
  "smooth-jazz": { classification: "near-existing", relatedGenreIds: ["jazz"] },
  "soul-jazz": { classification: "near-existing", relatedGenreIds: ["jazz", "soul"] },
  "traditional-jazz": { classification: "near-existing", relatedGenreIds: ["jazz"] },
  "vocal-jazz": { classification: "near-existing", relatedGenreIds: ["jazz"] },
  "film-score": { classification: "near-existing", relatedGenreIds: ["soundtrack"] },
  "television-score": { classification: "near-existing", relatedGenreIds: ["soundtrack"] },
  "j-drama-ost": { classification: "near-existing", relatedGenreIds: ["soundtrack"] },
  "k-drama-ost": { classification: "near-existing", relatedGenreIds: ["soundtrack"] },
  "k-randb": { classification: "near-existing", relatedGenreIds: ["k-pop", "contemporary-randb"] },
  "j-rock": { classification: "near-existing", relatedGenreIds: ["j-pop", "rock"] },
  "k-rock": { classification: "near-existing", relatedGenreIds: ["k-pop", "rock"] },
  "bubblegum-pop": { classification: "near-existing", relatedGenreIds: ["pop"] },
  "hyperpop": { classification: "near-existing", relatedGenreIds: ["electropop", "art-pop"] },
  "progressive-pop": { classification: "near-existing", relatedGenreIds: ["pop", "art-pop"] },
  "teen-pop": { classification: "near-existing", relatedGenreIds: ["pop"] },
  "traditional-pop": { classification: "near-existing", relatedGenreIds: ["pop"] },
  "pop-ballad": { classification: "near-existing", relatedGenreIds: ["pop"] },
  "pop-soul": { classification: "near-existing", relatedGenreIds: ["pop", "soul"] },
  "new-wave": { classification: "near-existing", relatedGenreIds: ["synthpop", "post-punk"] },
  "darkwave": { classification: "near-existing", relatedGenreIds: ["synthpop", "post-punk"] },
  "synthwave": { classification: "near-existing", relatedGenreIds: ["synthpop"] },
  "drift-phonk": { classification: "near-existing", relatedGenreIds: ["phonk"] },
  "phonk-house": { classification: "near-existing", relatedGenreIds: ["phonk", "deep-house"] },
  "electro-house": { classification: "near-existing", relatedGenreIds: ["tech-house"] },
};

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function buildAuthorityOutput(reviews: Record<string, Review>, tracks: ImportedTrack[], generatedAt: string, state: CatalogState = catalogState as CatalogState) {
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  const enrichedReviews: Record<string, Review> = Object.fromEntries(
    Object.entries(reviews)
      .map(([trackId, review]) => {
        const track = trackById.get(trackId);
        if (!track) throw new Error(`Cannot enrich review ${trackId}: track is not in the imported library.`);
        return [trackId, { ...review, title: track.title, artist: track.artist }] as const;
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const catalogIds = new Set([...genres, ...(state.additions ?? [])].map((genre) => genre.id));
  const rejectedCandidates = new Set<string>(state.rejectedCandidates ?? []);
  const missingGenreCandidates = uniqueSorted(
    Object.values(enrichedReviews).flatMap((review) => (review.missingGenreCandidates ?? []).filter((candidate) => !catalogIds.has(candidate) && !rejectedCandidates.has(candidate))),
  );
  const candidateCounts = new Map<string, number>();
  const candidateJustifications = new Map<string, MissingGenreCandidate["justifications"]>();
  for (const [trackId, review] of Object.entries(enrichedReviews)) {
    for (const candidate of (review.missingGenreCandidates ?? []).filter((id) => !catalogIds.has(id) && !rejectedCandidates.has(id))) {
      const normalized = candidate.trim();
      if (!normalized) continue;
      candidateCounts.set(normalized, (candidateCounts.get(normalized) ?? 0) + 1);
      const justification = review.missingGenreCandidateJustifications?.[normalized]?.trim();
      if (justification) {
        const entries = candidateJustifications.get(normalized) ?? [];
        entries.push({ trackId, title: review.title ?? "Untitled track", artist: review.artist ?? "Unknown artist", justification });
        candidateJustifications.set(normalized, entries);
      }
    }
  }
  const missingGenreCandidateSummary: MissingGenreCandidate[] = [...candidateCounts.entries()]
    .map(([id, count]) => {
      const relation = candidateRelations[id] ?? (catalogIds.has(id)
        ? { classification: "same-as-existing" as const, relatedGenreIds: [id] }
        : { classification: "distinct" as const, relatedGenreIds: [] });
      return { id, count, ...relation, justifications: candidateJustifications.get(id) ?? [] };
    })
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));

  return {
    version: 2,
    generatedAt,
    trackCount: Object.keys(enrichedReviews).length,
    missingGenreCandidates: missingGenreCandidateSummary,
    missingGenreCandidateIds: missingGenreCandidates,
    reviews: enrichedReviews,
  };
}
