import { readFile } from "node:fs/promises";
import reviewData from "../../../data/publicReviews.json";
import catalogState from "../../../../data/catalog-state.json";
import { privateDataPath } from "../../../lib/private-data";

type Candidate = { id: string };
type ReviewData = {
  reviews?: Record<string, unknown>;
  missingGenreCandidates?: Candidate[];
};

export async function GET() {
  let reviews: ReviewData = reviewData;
  let state: { rejectedCandidates?: string[] } = catalogState;
  if (process.env.NODE_ENV !== "production") {
    try { reviews = JSON.parse(await readFile(privateDataPath("ai-reviewed-genres.json"), "utf8")) as ReviewData; } catch { /* use public fixture */ }
    try { state = JSON.parse(await readFile(privateDataPath("catalog-state.json"), "utf8")) as typeof state; } catch { /* use public fixture */ }
  }
  const rejected = new Set<string>(state.rejectedCandidates ?? []);
  const candidates = (reviews.missingGenreCandidates ?? []).filter((candidate) => !rejected.has(candidate.id));
  return Response.json({ reviews: reviews.reviews ?? {}, missingGenreCandidates: candidates, missingGenreCandidateIds: candidates.map((candidate) => candidate.id) }, {
    headers: { "Cache-Control": "no-store" },
  });
}
