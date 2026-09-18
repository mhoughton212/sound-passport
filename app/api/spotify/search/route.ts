import type { Track } from "../../../lib/music";
import { getSpotifyToken } from "../../../lib/spotify";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) return Response.json({ tracks: [] });
  if (query.length > 100) return Response.json({ error: "Search queries must be 100 characters or fewer." }, { status: 400 });

  try {
    const token = await getSpotifyToken();
    if (!token) {
      console.error("Spotify search is unavailable: server credentials are missing.");
      return Response.json({ error: "Spotify search is temporarily unavailable.", code: "spotify_unavailable" }, { status: 503 });
    }
    const response = await fetch(`https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      console.error(`Spotify search failed with status ${response.status}.`);
      return Response.json({ error: "Spotify search is temporarily unavailable.", code: "spotify_unavailable" }, { status: 503 });
    }
    const data = await response.json() as { tracks: { items: Array<{ id: string; name: string; artists: Array<{ id: string; name: string }>; album: { name: string; images: Array<{ url: string }> }; external_urls: { spotify: string } }> } };
    const tracks: Track[] = data.tracks.items.map((item) => ({ id: item.id, title: item.name, artist: item.artists.map((artist) => artist.name).join(", "), artistIds: item.artists.map((artist) => artist.id), album: item.album.name, artwork: item.album.images[1]?.url ?? item.album.images[0]?.url ?? null, spotifyUrl: item.external_urls.spotify }));
    return Response.json({ tracks });
  } catch (error) {
    console.error("Spotify search request failed.", error);
    return Response.json({ error: "Spotify search is temporarily unavailable.", code: "spotify_unavailable" }, { status: 503 });
  }
}
