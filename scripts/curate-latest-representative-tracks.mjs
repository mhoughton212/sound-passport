import fs from "node:fs/promises";

const dataPath = new URL("../app/data/genreExamples.json", import.meta.url);
const envText = await fs.readFile(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.match(/^([^#=]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1].trim(), match[2].trim()]),
);

const selections = {
  "lo-fi-hip-hop": [
    ["4sUTagdmyuyAxd7RvbygpQ", "Warm jazz guitar sample, dusty drums, mellow groove, and hazy analog texture."],
    ["0HSwIZSDeOQX8Cu9pCGkjS", "Dusty soul sampling, soft boom-bap drums, vinyl haze, and a relaxed looping groove."],
  ],
  phonk: [
    [
      "0nRldjut6xoNAC6sg4Z0ri",
      "Murky Memphis samples, tape hiss, crawling drums, ominous vocals, and druggy lo-fi atmosphere. Note: The exact SpaceGhostPurrp recording was not available on Spotify, so this Spotify-listed version was substituted.",
    ],
    ["1gIWfKuP8dtKdnhksBCmWW", "Chopped Memphis vocals, booming 808s, screwed pacing, and smoky sample-heavy production."],
  ],
  "new-jack-swing": [
    ["7t4rA2AxpG7yAhgRwopfn2", "Hard syncopated drum-machine swing, synth-funk hooks, sampling, and powerful R&B vocals."],
    ["6m59VvDUi0UQsB2eZ9wVbH", "Rapid-fire snares, punchy hip-hop drums, funky bass, rap phrasing, and slick R&B harmonies."],
  ],
  christmas: [
    ["4Zwt04D6mzQ9B91PqJ50ZD", "Warm crooning, lush orchestration, gentle bells, and nostalgic mid-century holiday-pop atmosphere."],
    ["0bYg9bo50gSsH3LtXe2SQn", "Sleigh bells, jubilant piano, dense Wall-of-Sound production, and soaring gospel-pop vocals."],
  ],
};

const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${env.SPOTIPY_CLIENT_ID}:${env.SPOTIPY_CLIENT_SECRET}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
if (!tokenResponse.ok) throw new Error(`Spotify token request failed: ${tokenResponse.status}`);
const { access_token: token } = await tokenResponse.json();

async function fetchTrack(id) {
  const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Spotify track lookup failed for ${id}: ${response.status}`);
  const track = await response.json();
  return {
    id: track.id,
    title: track.name,
    artist: track.artists.map((artist) => artist.name).join(", "),
    album: track.album.name,
    artwork: track.album.images?.[track.album.images.length - 1]?.url ?? null,
    spotifyUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
  };
}

const examples = JSON.parse(await fs.readFile(dataPath, "utf8"));
for (const [genreId, tracks] of Object.entries(selections)) {
  examples[genreId] = [];
  for (const [[id, note], index] of tracks.map((track, index) => [track, index])) {
    examples[genreId].push({ ...(await fetchTrack(id)), note, index });
  }
}

await fs.writeFile(dataPath, `${JSON.stringify(examples, null, 2)}\n`);
console.log(`Updated representative tracks for ${Object.keys(selections).length} genres.`);
