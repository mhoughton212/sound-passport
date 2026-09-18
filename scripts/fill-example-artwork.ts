import { readFile, writeFile } from "node:fs/promises";
import type { ExampleTrack } from "../app/lib/music";

const projectUrl = new URL("../", import.meta.url);
const fileUrl = new URL("app/data/genreExamples.json", projectUrl);
const examples = JSON.parse(await readFile(fileUrl, "utf8")) as Record<string, ExampleTrack[]>;

function spotifyTrackId(url: string) {
  return url.match(/spotify\.com\/track\/([A-Za-z0-9]+)/)?.[1] ?? null;
}

async function findArtwork(trackId: string) {
  const response = await fetch(`https://open.spotify.com/track/${trackId}`);
  if (!response.ok) return null;
  const html = await response.text();
  return html.match(/https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+/)?.[0] ?? null;
}

let filled = 0;
for (const tracks of Object.values(examples)) {
  for (const track of tracks) {
    const id = track.artwork ? null : spotifyTrackId(track.spotifyUrl);
    if (!id) continue;
    const artwork = await findArtwork(id);
    if (artwork) {
      track.artwork = artwork;
      filled += 1;
    }
  }
}

await writeFile(fileUrl, `${JSON.stringify(examples, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ filled }));
