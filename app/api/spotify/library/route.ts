import { appendCookies, getSpotifyUserToken } from "../../../lib/spotify-user";

type SpotifyArtist = { id?: string; name: string };
type SpotifyTrack = { id?: string; type?: string; name: string; artists: SpotifyArtist[]; album: { name: string; images?: Array<{ url: string }> }; external_urls?: { spotify?: string }; external_ids?: { isrc?: string } };
type Page<T> = { items: T[]; next: string | null; total?: number };
type Playlist = { id: string; name: string; owner?: { id?: string }; collaborative?: boolean };
type PlaylistEntry = { item?: SpotifyTrack; track?: SpotifyTrack };
type NormalizedTrack = NonNullable<ReturnType<typeof normalizeTrack>>;

class SpotifyRequestError extends Error {
  constructor(public status: number, public responseBody: string, public endpoint: string) { super(`Spotify request failed with status ${status}.`); }
}

async function spotifyFetch<T>(url: string, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new SpotifyRequestError(response.status, (await response.text()).slice(0, 500), url);
  return response.json() as Promise<T>;
}

async function fetchPages<T>(url: string, token: string) {
  const items: T[] = [];
  let next: string | null = url;
  while (next) {
    const page: Page<T> = await spotifyFetch<Page<T>>(next, token);
    items.push(...page.items);
    next = page.next;
  }
  return items;
}

function normalizeTrack(track: SpotifyTrack | null | undefined, source: string) {
  if (!track?.id || track.type && track.type !== "track") return null;
  return {
    id: track.id,
    title: track.name,
    artist: track.artists.map((artist) => artist.name).join(", "),
    artistIds: track.artists.flatMap((artist) => artist.id ? [artist.id] : []),
    album: track.album.name,
    artwork: track.album.images?.[1]?.url ?? track.album.images?.[0]?.url ?? null,
    spotifyUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
    isrc: track.external_ids?.isrc ?? null,
    sources: [source],
  };
}

function offsetFrom(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("offset") ?? "0");
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function failureResponse(error: unknown, message: string) {
  const status = error instanceof SpotifyRequestError ? error.status : 502;
  return Response.json({ error: message, code: "spotify_import_failed", failure: {
    status: error instanceof SpotifyRequestError ? error.status : null,
    error: error instanceof SpotifyRequestError ? error.message : error instanceof Error ? error.message : "Unknown Spotify import error",
    endpoint: null,
  } }, { status });
}

export async function GET(request: Request) {
  const session = await getSpotifyUserToken(request);
  if (!session) return Response.json({ error: "Connect Spotify to import your library.", code: "spotify_not_connected" }, { status: 401 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "metadata";
  const offset = offsetFrom(request);

  try {
    if (mode === "metadata") {
      const [profile, playlists] = await Promise.all([
        spotifyFetch<{ id?: string }>("https://api.spotify.com/v1/me", session.token),
        fetchPages<Playlist>("https://api.spotify.com/v1/me/playlists?limit=50", session.token),
      ]);
      const readablePlaylists = playlists.filter((playlist) => playlist.owner?.id === profile.id || playlist.collaborative);
      const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "private, no-store" });
      appendCookies(headers, session.cookies);
      return new Response(JSON.stringify({ playlists: readablePlaylists.map((playlist) => ({ id: playlist.id, name: playlist.name, ownerId: playlist.owner?.id ?? null, collaborative: Boolean(playlist.collaborative) })), playlistsFound: playlists.length, readablePlaylists: readablePlaylists.length }), { headers });
    }

    if (mode === "saved") {
      const endpoint = `https://api.spotify.com/v1/me/tracks?limit=50&offset=${offset}`;
      const page = await spotifyFetch<Page<{ track?: SpotifyTrack; item?: SpotifyTrack }>>(endpoint, session.token);
      const tracks = page.items.map((entry) => normalizeTrack(entry.track ?? entry.item, "Liked Songs")).filter(Boolean) as NormalizedTrack[];
      return Response.json({ tracks, sourceCount: tracks.length, total: page.total ?? null, nextOffset: page.next ? offset + page.items.length : null }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (mode === "playlist") {
      const playlistId = url.searchParams.get("playlistId");
      const playlistName = url.searchParams.get("playlistName") ?? "Spotify playlist";
      if (!playlistId || !/^[A-Za-z0-9]+$/.test(playlistId)) return Response.json({ error: "A valid Spotify playlist is required.", code: "invalid_playlist" }, { status: 400 });
      const endpoint = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?limit=50&offset=${offset}`;
      try {
        const page = await spotifyFetch<Page<PlaylistEntry>>(endpoint, session.token);
        const tracks = page.items.map((entry) => normalizeTrack(entry.item ?? entry.track, playlistName)).filter(Boolean) as NormalizedTrack[];
        return Response.json({ tracks, sourceCount: tracks.length, total: page.total ?? null, nextOffset: page.next ? offset + page.items.length : null }, { headers: { "Cache-Control": "private, no-store" } });
      } catch (error) {
        console.error(`Could not import Spotify playlist page ${playlistId}.`, error);
        return failureResponse(error, `Could not import the Spotify playlist “${playlistName}”.`);
      }
    }

    return Response.json({ error: "Unknown Spotify library import mode.", code: "invalid_import_mode" }, { status: 400 });
  } catch (error) {
    console.error("Spotify library import failed.", error);
    return failureResponse(error, "Your Spotify library could not be imported right now.");
  }
}
