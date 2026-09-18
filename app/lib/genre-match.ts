export function normalizeGenre(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

export function genreTagMatches(targetGenre: string, candidateGenre: string) {
  const target = normalizeGenre(targetGenre);
  const candidate = normalizeGenre(candidateGenre);
  if (!target || !candidate) return false;
  return candidate === target || ` ${candidate} `.includes(` ${target} `);
}

export function genreMatches(targetGenre: string, artistGenres: string[]) {
  return artistGenres.some((item) => genreTagMatches(targetGenre, item));
}
