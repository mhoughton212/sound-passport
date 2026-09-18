"use client";

import type { LibraryTrack } from "../lib/library";
import { useCatalog } from "./catalog-context";

function genreNames(ids: string[], genres: ReturnType<typeof useCatalog>["genres"]) {
  return ids.flatMap((id) => {
    const genre = genres.find((item) => item.id === id);
    return genre ? [genre.name] : [];
  });
}

export default function TrackGenreDetails({ track, onRequestReview, onCancelReview }: { track: LibraryTrack; onRequestReview?: () => void | Promise<void>; onCancelReview?: () => void | Promise<void> }) {
  const { genres } = useCatalog();
  if (track.reviewedGenreIds.length === 0) {
    return (
      <div className="genre-details">
        <section>
          <strong>Needs review</strong>
          <p>This track is in the imported library but not in the reviewed genre file yet. Save the library file, prepare the review queue, and ask Codex to classify the new tracks.</p>
        </section>
      </div>
    );
  }

  const direct = genreNames(track.reviewedGenreIds, genres);
  const inherited = genreNames(track.genreIds.filter((id) => !track.reviewedGenreIds.includes(id)), genres);
  return (
    <div className={`genre-details ${track.reviewRequested ? "has-review-request" : ""}`}>
      {track.reviewRequested && <section className="review-status-section"><strong>Re-review requested</strong><p>Current tags stay until the re-review is complete.</p></section>}
      <section className="reviewed-genres-section">
        <strong>Reviewed genres</strong>
        <div className="mapped-genre-list">{direct.map((name) => <span key={name}>{name}</span>)}</div>
        {track.reviewedRationale && <p className="genre-review-rationale">{track.reviewedRationale}</p>}
      </section>
      {inherited.length > 0 && (
        <section className="parent-genres-section">
          <strong>Included parent genres</strong>
          <div className="mapped-genre-list inherited">{inherited.map((name) => <span key={name}>{name}</span>)}</div>
          <p className="genre-review-note">These broader genres come from the catalog hierarchy, not a second tagging system.</p>
        </section>
      )}
      {(onRequestReview || onCancelReview) && <div className="genre-review-request-wrap"><button className={`genre-review-request ${track.reviewRequested ? "cancel" : ""}`} type="button" onClick={() => void (track.reviewRequested ? onCancelReview?.() : onRequestReview?.())}>{track.reviewRequested ? "Cancel re-review" : "Re-review"}</button></div>}
    </div>
  );
}
