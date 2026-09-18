import { readFile } from "node:fs/promises";
import catalogState from "../../../data/catalog-state.json";
import { genres as baseGenres } from "../../data/genres";
import type { Genre } from "../../lib/music";
import { privateDataPath } from "../../lib/private-data";

type CatalogState = { additions?: Genre[] };

export async function GET() {
  let state: CatalogState = catalogState as CatalogState;
  if (process.env.NODE_ENV !== "production") {
    try { state = JSON.parse(await readFile(privateDataPath("catalog-state.json"), "utf8")) as CatalogState; } catch { /* use public fixture */ }
  }
  const genres = [...baseGenres, ...(state.additions ?? [])];
  return Response.json({ genres, genreFamilies: ["All genres", ...new Set(genres.flatMap((genre) => genre.families))] }, { headers: { "Cache-Control": "no-store" } });
}
