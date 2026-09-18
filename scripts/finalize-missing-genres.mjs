import { readFile, writeFile } from "node:fs/promises";
import { privateDataFile } from "./private-data.mjs";

const authorityUrl = privateDataFile("ai-reviewed-genres.json");
const auditUrl = privateDataFile("genre-review/missing-genres-final-audit.json");
const backupUrl = privateDataFile("genre-review/pre-final-missing-genres.json");
const authority = JSON.parse(await readFile(authorityUrl, "utf8"));
const audit = JSON.parse(await readFile(auditUrl, "utf8"));

const activeCandidateIds = authority.missingGenreCandidateIds ?? [];
if (activeCandidateIds.length === 0) {
  console.log(JSON.stringify({ consolidatedMentions: 0, rejectedMentions: 0, remainingCandidates: 0 }));
  process.exit(0);
}

const auditedCandidateIds = Object.keys(audit.decisions).sort();
const expectedCandidateIds = [...activeCandidateIds].sort();
if (JSON.stringify(auditedCandidateIds) !== JSON.stringify(expectedCandidateIds)) {
  throw new Error("The final audit must contain exactly one decision for every active missing-genre candidate.");
}

const backup = {
  version: 1,
  backedUpAt: new Date().toISOString(),
  missingGenreCandidates: authority.missingGenreCandidates,
  missingGenreCandidateIds: authority.missingGenreCandidateIds,
  reviewCandidates: Object.fromEntries(Object.entries(authority.reviews)
    .filter(([, review]) => review.missingGenreCandidates?.length)
    .map(([trackId, review]) => [trackId, review.missingGenreCandidates])),
};
await writeFile(backupUrl, `${JSON.stringify(backup, null, 2)}\n`, { encoding: "utf8", flag: "wx" }).catch((error) => {
  if (error?.code !== "EEXIST") throw error;
});

let consolidatedMentions = 0;
let rejectedMentions = 0;
const reviews = Object.fromEntries(Object.entries(authority.reviews).map(([trackId, review]) => {
  const candidates = review.missingGenreCandidates ?? [];
  const mappedGenreIds = candidates.flatMap((candidate) => {
    const target = audit.decisions[candidate].target;
    if (target) {
      consolidatedMentions += 1;
      return [target];
    }
    rejectedMentions += 1;
    return [];
  });
  const next = { ...review, genreIds: [...new Set([...review.genreIds, ...mappedGenreIds])] };
  delete next.missingGenreCandidates;
  return [trackId, next];
}));

const output = {
  ...authority,
  generatedAt: new Date().toISOString(),
  missingGenreCandidates: [],
  missingGenreCandidateIds: [],
  reviews,
};

await writeFile(authorityUrl, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ consolidatedMentions, rejectedMentions, remainingCandidates: 0 }));
