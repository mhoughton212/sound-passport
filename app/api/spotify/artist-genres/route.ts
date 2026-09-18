import { getSpotifyToken } from "../../../lib/spotify";

type SpotifyArtist = { id: string; name: string; genres?: string[] } | null;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { artistIds?: unknown } | null;
  const artistIds = Array.isArray(body?.artistIds)
    ? [...new Set(body.artistIds.filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9]{22}$/.test(id)))].slice(0, 50)
    : [];
  if (artistIds.length === 0) return Response.json({ artists: [] });

  try {
    const token = await getSpotifyToken();
    if (!token) return Response.json({ error: "Spotify artist data is unavailable." }, { status: 503 });
    const response = await fetch(`https://api.spotify.com/v1/artists?ids=${encodeURIComponent(artistIds.join(","))}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return Response.json({ error: "Spotify artist data is unavailable." }, { status: 502 });
    const data = await response.json() as { artists?: SpotifyArtist[] };
    return Response.json({ artists: (data.artists ?? []).filter((artist): artist is Exclude<SpotifyArtist, null> => Boolean(artist)) });
  } catch {
    return Response.json({ error: "Spotify artist data is unavailable." }, { status: 502 });
  }
}
