import { getSpotifyToken } from "../../../lib/spotify";
import { genreMatches } from "../../../lib/genre-match";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const genre = params.get("genre")?.trim();
  const artistIds = (params.get("artistIds") ?? "").split(",").map((id) => id.trim()).filter((id) => /^[A-Za-z0-9]{22}$/.test(id)).slice(0, 5);
  if (!genre || artistIds.length === 0) return Response.json({ match: false, dataAvailable: false, artistGenres: [] });

  try {
    const token = await getSpotifyToken();
    if (!token) {
      console.error("Spotify genre check is unavailable: server credentials are missing.");
      return Response.json({ error: "Artist genre data is temporarily unavailable.", code: "spotify_unavailable" }, { status: 503 });
    }
    const response = await fetch(`https://api.spotify.com/v1/artists?ids=${encodeURIComponent(artistIds.join(","))}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      console.error(`Spotify genre check failed with status ${response.status}.`);
      return Response.json({ error: "Artist genre data is temporarily unavailable.", code: "spotify_unavailable" }, { status: 503 });
    }
    const data = await response.json() as { artists: Array<{ genres?: string[] } | null> };
    const artistGenres = [...new Set(data.artists.flatMap((artist) => artist?.genres ?? []))];
    const match = genreMatches(genre, artistGenres);
    return Response.json({ match, dataAvailable: artistGenres.length > 0, artistGenres: artistGenres.slice(0, 12) });
  } catch (error) {
    console.error("Spotify genre check request failed.", error);
    return Response.json({ error: "Artist genre data is temporarily unavailable.", code: "spotify_unavailable" }, { status: 503 });
  }
}
