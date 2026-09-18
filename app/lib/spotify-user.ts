const ACCESS_COOKIE = "sound_passport_spotify_access";
const REFRESH_COOKIE = "sound_passport_spotify_refresh";
export const STATE_COOKIE = "sound_passport_spotify_state";

type SpotifyTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

export function spotifyCredentials() {
  const clientId = process.env.SPOTIPY_CLIENT_ID;
  const clientSecret = process.env.SPOTIPY_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function spotifyRedirectUri() {
  const configured = process.env.SPOTIPY_REDIRECT_URI;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "http://127.0.0.1:3000/api/spotify/callback";
  throw new Error("SPOTIPY_REDIRECT_URI is required in production.");
}

export function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function cookie(name: string, value: string, maxAge: number, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function stateCookie(value: string, request: Request) {
  return cookie(STATE_COOKIE, value, 600, request);
}

export function clearStateCookie(request: Request) {
  return cookie(STATE_COOKIE, "", 0, request);
}

export function clearSpotifyCookies(request: Request) {
  return [cookie(ACCESS_COOKIE, "", 0, request), cookie(REFRESH_COOKIE, "", 0, request)];
}

function tokenCookies(tokens: SpotifyTokenResponse, request: Request) {
  const values = [cookie(ACCESS_COOKIE, tokens.access_token, Math.max(60, tokens.expires_in - 60), request)];
  if (tokens.refresh_token) values.push(cookie(REFRESH_COOKIE, tokens.refresh_token, 60 * 60 * 24 * 180, request));
  return values;
}

async function requestTokens(body: URLSearchParams, request: Request) {
  const credentials = spotifyCredentials();
  if (!credentials) throw new Error("Spotify server credentials are missing.");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) throw new Error(`Spotify token exchange failed with status ${response.status}.`);
  const tokens = await response.json() as SpotifyTokenResponse;
  return { token: tokens.access_token, cookies: tokenCookies(tokens, request) };
}

export async function exchangeSpotifyCode(code: string, request: Request) {
  return requestTokens(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: spotifyRedirectUri(),
  }), request);
}

export async function getSpotifyUserToken(request: Request) {
  const accessToken = readCookie(request, ACCESS_COOKIE);
  if (accessToken) return { token: accessToken, cookies: [] as string[] };
  const refreshToken = readCookie(request, REFRESH_COOKIE);
  if (!refreshToken) return null;
  return requestTokens(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }), request);
}

export function appendCookies(headers: Headers, cookies: string[]) {
  for (const value of cookies) headers.append("Set-Cookie", value);
}
