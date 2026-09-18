export type Genre = {
  id: string;
  name: string;
  spotifyName: string;
  families: string[];
  parents?: string[];
  description: string;
  examples: ExampleTrack[];
};

export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string | null;
  spotifyUrl: string;
  source?: "spotify" | "local" | "youtube";
  localFile?: Blob;
  localFileName?: string;
  sources?: string[];
  artistIds?: string[];
  reviewRequested?: boolean;
  reviewRequestedAt?: string;
};

export type Assignments = Record<string, Track>;

export type ExampleTrack = Track & { note: string; index: number };

export const STORAGE_KEY = "smart-music:goats:v1";

export function isTrack(value: unknown): value is Track {
  if (!value || typeof value !== "object") return false;
  const track = value as Record<string, unknown>;
  return typeof track.id === "string"
    && typeof track.title === "string"
    && typeof track.artist === "string"
    && typeof track.album === "string"
    && (typeof track.artwork === "string" || track.artwork === null)
    && typeof track.spotifyUrl === "string"
    && (track.source === undefined || track.source === "spotify" || track.source === "local" || track.source === "youtube")
    && (track.artistIds === undefined || (Array.isArray(track.artistIds) && track.artistIds.every((id) => typeof id === "string")));
}

export function parseAssignments(value: string | null): Assignments {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, track]) => isTrack(track)));
  } catch {
    return {};
  }
}
