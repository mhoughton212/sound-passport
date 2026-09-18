import { genres } from "../data/genres";
import type { Track } from "./music";

export type ImportedTrack = Track & {
  isrc: string | null;
  sources?: string[];
  reviewRequested?: boolean;
  reviewRequestedAt?: string;
};

export type GenreReview = {
  genreIds: string[];
  rationale: string;
  reviewedAt: string;
};

export type LibraryTrack = ImportedTrack & {
  genreIds: string[];
  reviewedGenreIds: string[];
  reviewedRationale?: string;
  reviewedAt?: string;
};

function immediateParentGenreIds(genreId: string) {
  const genre = genres.find((item) => item.id === genreId);
  if (!genre) return [];
  const familyRoots = genre.families.flatMap((family) => {
    const root = genres.find((item) => item.spotifyName === family);
    return root ? [root.id] : [];
  });
  return [...new Set([...(genre.parents ?? []), ...familyRoots])];
}

export function expandLibraryGenreHierarchy(genreIds: string[]) {
  const expanded = new Set<string>();
  const pending = [...genreIds];
  while (pending.length) {
    const genreId = pending.shift();
    if (!genreId || expanded.has(genreId)) continue;
    expanded.add(genreId);
    pending.push(...immediateParentGenreIds(genreId));
  }
  return [...expanded];
}

export function toImportedTrack(track: ImportedTrack): ImportedTrack {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: track.artwork,
    spotifyUrl: track.spotifyUrl,
    source: track.source,
    localFileName: track.localFileName,
    localFile: track.localFile,
    artistIds: track.artistIds,
    isrc: track.isrc,
    sources: [...(track.sources ?? [])],
    reviewRequested: track.reviewRequested,
    reviewRequestedAt: track.reviewRequestedAt,
  };
}

export function applyGenreReview(track: ImportedTrack, review?: GenreReview): LibraryTrack {
  const reviewedGenreIds = review?.genreIds ?? [];
  const reviewStillPending = Boolean(review && track.reviewRequested && track.reviewRequestedAt && review.reviewedAt < track.reviewRequestedAt);
  return {
    ...toImportedTrack(track),
    reviewedGenreIds,
    genreIds: expandLibraryGenreHierarchy(reviewedGenreIds),
    reviewedRationale: review?.rationale,
    reviewedAt: review?.reviewedAt,
    reviewRequested: review ? reviewStillPending : track.reviewRequested,
    reviewRequestedAt: review && !reviewStillPending ? undefined : track.reviewRequestedAt,
  };
}
