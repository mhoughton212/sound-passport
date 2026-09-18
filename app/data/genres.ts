import type { Genre } from "../lib/music";
import { genreDescriptions } from "./genreDescriptions";
import rawGenreExamples from "./genreExamples.json";
import rawGenreOverrides from "./genreOverrides.json";

const familyGenres: Record<string, string[]> = {
  "Hip Hop": ["Hip Hop", "Abstract Hip Hop", "Boom Bap", "Cloud Rap", "Conscious Hip Hop", "Drill", "East Coast Hip Hop", "Experimental Hip Hop", "Gangsta Rap", "Hardcore Hip Hop", "Industrial Hip Hop", "Instrumental Hip Hop", "Japanese Hip Hop", "Jazz Rap", "Lo-Fi Hip Hop", "Pop Rap", "Rage", "Southern Hip Hop", "Trap", "West Coast Hip Hop"],
  Pop: ["Pop", "A Cappella", "Art Pop", "Baroque Pop", "Bedroom Pop", "Bubblegum Pop", "Chamber Pop", "Christmas", "City Pop", "Dance-Pop", "Electropop", "Hyperpop", "Hypnagogic Pop", "Indie Pop", "J-Pop", "K-Ballad", "K-Pop", "OPM", "Sophisti-Pop", "Synthpop", "Teen Pop"],
  Jazz: ["Jazz", "Avant-Garde Jazz", "Bebop", "Big Band", "Bossa Nova", "Cool Jazz", "Free Jazz", "Hard Bop", "Jazz Ballad", "Jazz Fusion", "Spiritual Jazz", "Swing"],
  Rock: ["Rock", "Alternative Rock", "Art Rock", "Blues Rock", "Dream Pop", "Emo", "Garage Rock", "Gothic Rock", "Indie Rock", "Krautrock", "Math Rock", "Noise Rock", "Pop Rock", "Post-Punk", "Post-Rock", "Progressive Rock", "Psychedelic Rock", "Shoegaze", "Soft Rock", "Slowcore"],
  Electronic: ["Electronic", "Ambient", "Breakbeat", "Deep House", "Digicore", "Disco", "Downtempo", "Drum and Bass", "Dub Techno", "Eurodance", "IDM", "Indietronica", "Industrial", "Jersey Club", "Phonk", "Tech House", "Techno", "UK Garage"],
  Metal: ["Metal", "Atmospheric Black Metal", "Black Metal", "Death Metal", "Doom Metal", "Drone Metal", "Folk Metal", "Post-Metal", "Sludge Metal", "Thrash Metal"],
  Country: ["Country", "Alt-Country", "Americana", "Bluegrass", "Country Rock", "Outlaw Country", "Progressive Country"],
  "R&B": ["R&B", "Alternative R&B", "Contemporary R&B", "Funk", "Neo-Soul", "New Jack Swing", "Quiet Storm", "Soul"],
  Folk: ["Folk", "Acid Folk", "Contemporary Folk", "Folk Rock", "Indie Folk", "Neofolk", "Singer-Songwriter"],
  Classical: ["Classical", "Baroque", "Chamber Music", "Concert Band", "Impressionism", "Minimalism", "Modern Classical", "Romanticism"],
  Global: ["Afrobeat", "Cumbia", "Dancehall", "Flamenco", "Highlife", "MPB", "Punjabi", "Reggae", "Salsa", "Samba"],
  "Stage & Screen": ["Anime Song", "Film Score", "TV Score", "Musical", "Video Game Music"],
};

const additionalFamilies: Record<string, string[]> = {
  "Baroque Pop": ["Classical"],
  "Bossa Nova": ["Global"],
  "Country Rock": ["Rock"],
  "Dance-Pop": ["Electronic"],
  "Disco": ["Pop"],
  "Dream Pop": ["Pop"],
  Electropop: ["Electronic"],
  Eurodance: ["Pop"],
  "Folk Rock": ["Rock"],
  "Japanese Hip Hop": ["Global"],
  Indietronica: ["Pop"],
  "J-Pop": ["Global"],
  "K-Pop": ["Global"],
  OPM: ["Global"],
  Synthpop: ["Electronic"],
  "Pop Rap": ["Pop"],
  "Pop Rock": ["Pop"],
};

const genreParents: Record<string, string[]> = {
  "Video Game Music": [],
  Dancehall: ["reggae"],
  Rage: ["trap"],
};

const slug = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const genreOverrides = rawGenreOverrides as Record<string, { name?: string; description?: string }>;
const genreExamples = rawGenreExamples as Record<string, Genre["examples"]>;

export const genres: Genre[] = Object.entries(familyGenres).flatMap(([family, names]) => names.map((spotifyName) => {
  const id = slug(spotifyName);
  return { id, spotifyName, name: genreOverrides[id]?.name ?? spotifyName, families: [family, ...(additionalFamilies[spotifyName] ?? [])], parents: genreParents[spotifyName] ?? [], description: genreOverrides[id]?.description ?? genreDescriptions[spotifyName], examples: genreExamples[id] ?? [] };
}));
export const genreFamilies = ["All genres", ...Object.keys(familyGenres)];
export const familyDisplayName = (family: string) => family === "All genres" ? family : genreOverrides[slug(family)]?.name ?? family;
