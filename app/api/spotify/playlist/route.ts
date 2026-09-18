import { appendCookies, getSpotifyUserToken } from "../../../lib/spotify-user";

type SpotifyProfile = { id?: string };
type SpotifyPlaylist = { id?: string; external_urls?: { spotify?: string } };

function trackId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
  const uriMatch = trimmed.match(/^spotify:track:([A-Za-z0-9]{22})$/);
  if (uriMatch) return uriMatch[1];
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/track\/([A-Za-z0-9]{22})/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function spotifyRequest<T>(url: string, token: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  }) as Promise<Response & { json(): Promise<T> }>;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { trackIds?: unknown } | null;
  const ids = Array.isArray(body?.trackIds)
    ? [...new Set(body.trackIds.map(trackId).filter((id): id is string => Boolean(id)))].slice(0, 1000)
    : [];
  if (ids.length === 0) return Response.json({ error: "Choose at least one track before exporting." }, { status: 400 });

  const session = await getSpotifyUserToken(request);
  if (!session) return Response.json({ error: "Connect Spotify to export this playlist.", code: "spotify_not_connected" }, { status: 401 });

  try {
    const profileResponse = await spotifyRequest<SpotifyProfile>("https://api.spotify.com/v1/me", session.token);
    if (!profileResponse.ok) return Response.json({ error: "Reconnect Spotify to grant playlist access.", code: "spotify_reconnect_required" }, { status: profileResponse.status === 403 ? 403 : 401 });

    const playlistResponse = await spotifyRequest<SpotifyPlaylist>("https://api.spotify.com/v1/me/playlists", session.token, {
      method: "POST",
      body: JSON.stringify({
        name: "Sound Passport",
        public: false,
        collaborative: false,
        description: `Your Sound Passport. Generated ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date())}.`,
      }),
    });
    if (!playlistResponse.ok) {
      const status = playlistResponse.status === 401 || playlistResponse.status === 403 ? playlistResponse.status : 502;
      return Response.json({ error: "Reconnect Spotify to grant playlist access.", code: "spotify_reconnect_required" }, { status });
    }

    const playlist = await playlistResponse.json();
    if (!playlist.id) throw new Error("Spotify did not return a playlist id.");
    for (let index = 0; index < ids.length; index += 100) {
      const itemsResponse = await spotifyRequest(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlist.id)}/items`, session.token, {
        method: "POST",
        body: JSON.stringify({ uris: ids.slice(index, index + 100).map((id) => `spotify:track:${id}`) }),
      });
      if (!itemsResponse.ok) throw new Error(`Spotify rejected playlist tracks with status ${itemsResponse.status}.`);
    }

    const response = Response.json({ playlistUrl: playlist.external_urls?.spotify ?? null, trackCount: ids.length });
    appendCookies(response.headers, session.cookies);
    return response;
  } catch (error) {
    console.error("Spotify playlist export failed.", error);
    return Response.json({ error: "Spotify could not create the playlist right now.", code: "spotify_playlist_failed" }, { status: 502 });
  }
}
