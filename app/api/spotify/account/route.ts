import { appendCookies, clearSpotifyCookies, getSpotifyUserToken } from "../../../lib/spotify-user";

export async function GET(request: Request) {
  try {
    const session = await getSpotifyUserToken(request);
    const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "private, no-store" });
    if (session) appendCookies(headers, session.cookies);
    return new Response(JSON.stringify({ connected: Boolean(session) }), { headers });
  } catch {
    return Response.json({ connected: false });
  }
}

export async function DELETE(request: Request) {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "private, no-store" });
  appendCookies(headers, clearSpotifyCookies(request));
  return new Response(JSON.stringify({ connected: false }), { headers });
}
