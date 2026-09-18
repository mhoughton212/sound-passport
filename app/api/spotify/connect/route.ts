import { spotifyCredentials, spotifyRedirectUri, stateCookie } from "../../../lib/spotify-user";

export async function GET(request: Request) {
  const credentials = spotifyCredentials();
  if (!credentials) return Response.json({ error: "Spotify connection is temporarily unavailable." }, { status: 503 });

  const state = crypto.randomUUID();
  const authorize = new URL("https://accounts.spotify.com/authorize");
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: credentials.clientId,
    redirect_uri: spotifyRedirectUri(),
    scope: "user-library-read playlist-read-private playlist-read-collaborative playlist-modify-private",
    state,
  }).toString();

  const headers = new Headers({ Location: authorize.toString() });
  headers.append("Set-Cookie", stateCookie(state, request));
  return new Response(null, { status: 302, headers });
}
