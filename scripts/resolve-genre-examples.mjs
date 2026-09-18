import { readFile, writeFile } from "node:fs/promises";

const candidates = JSON.parse(await readFile(new URL("./genre-example-candidates.json", import.meta.url), "utf8"));
const envText = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(envText.split(/\r?\n/).map((line) => line.match(/^([^#=]+)=(.*)$/)).filter(Boolean).map((match) => [match[1].trim(), match[2].trim()]));
const clientId = env.SPOTIPY_CLIENT_ID ?? env.SPOTIFY_CLIENT_ID;
const clientSecret = env.SPOTIPY_CLIENT_SECRET ?? env.SPOTIFY_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error("Spotify credentials are missing.");

const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
if (!tokenResponse.ok) throw new Error(`Spotify authentication failed: ${tokenResponse.status}`);
const { access_token: token } = await tokenResponse.json();

const normalized = (value) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const score = (item, artist, title) => {
  const wantedTitle = normalized(title);
  const actualTitle = normalized(item.name);
  const wantedArtist = normalized(artist);
  const actualArtists = normalized(item.artists.map((entry) => entry.name).join(" "));
  return (actualTitle === wantedTitle ? 20 : actualTitle.startsWith(wantedTitle) || wantedTitle.startsWith(actualTitle) ? 12 : actualTitle.includes(wantedTitle) ? 7 : 0)
    + (actualArtists.includes(wantedArtist) || wantedArtist.includes(actualArtists) ? 15 : actualArtists.split(" ").some((word) => wantedArtist.includes(word) && word.length > 3) ? 4 : 0);
};

async function search(artist, title) {
  const queries = [`track:${title} artist:${artist}`, `"${title}" ${artist}`, `${title} ${artist}`];
  for (const query of queries) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await fetch(`https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 429) {
        const delay = Math.max(1000, Number(response.headers.get("retry-after") ?? 2) * 1000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (!response.ok) throw new Error(`Spotify search failed (${response.status}) for ${artist} — ${title}`);
      const data = await response.json();
      const ranked = data.tracks.items.map((item) => ({ item, score: score(item, artist, title) })).sort((left, right) => right.score - left.score);
      if (ranked[0]) return ranked[0];
      break;
    }
  }
  throw new Error(`No Spotify result for ${artist} — ${title}`);
}

const output = {};
const warnings = [];
let completed = 0;
for (const [genreId, entries] of Object.entries(candidates)) {
  output[genreId] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const [wantedArtist, wantedTitle, note] = entries[index];
    const { item, score: matchScore } = await search(wantedArtist, wantedTitle);
    if (matchScore < 20) warnings.push(`${genreId}[${index}] score=${matchScore}: ${wantedArtist} — ${wantedTitle} -> ${item.artists.map((artist) => artist.name).join(", ")} — ${item.name}`);
    output[genreId].push({
      id: item.id,
      title: item.name,
      artist: item.artists.map((artist) => artist.name).join(", "),
      album: item.album.name,
      artwork: item.album.images[1]?.url ?? item.album.images[0]?.url ?? null,
      spotifyUrl: item.external_urls.spotify,
      note,
      index,
    });
    completed += 1;
    if (completed % 20 === 0) console.log(`Resolved ${completed}/210`);
    await new Promise((resolve) => setTimeout(resolve, 175));
  }
}

await writeFile(new URL("../app/data/genreExamples.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Resolved ${completed}/210; warnings=${warnings.length}`);
if (warnings.length) console.log(warnings.join("\n"));
