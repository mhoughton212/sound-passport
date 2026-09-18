import { appendCookies, clearStateCookie, exchangeSpotifyCode, readCookie, STATE_COOKIE } from "../../../lib/spotify-user";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request, STATE_COOKIE);
  const destination = new URL("/", request.url);

  if (!code || !state || !expectedState || state !== expectedState) {
    destination.searchParams.set("spotify", "connection_failed");
    return Response.redirect(destination, 302);
  }

  try {
    const session = await exchangeSpotifyCode(code, request);
    destination.searchParams.set("spotify", "connected");
    const headers = new Headers({ Location: destination.toString() });
    appendCookies(headers, [...session.cookies, clearStateCookie(request)]);
    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error("Spotify account connection failed.", error);
    destination.searchParams.set("spotify", "connection_failed");
    return Response.redirect(destination, 302);
  }
}
