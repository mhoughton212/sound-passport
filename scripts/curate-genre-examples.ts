import { readFile, writeFile } from "node:fs/promises";
import type { ImportedTrack } from "../app/lib/library";
import type { ExampleTrack } from "../app/lib/music";
import { privateDataFile } from "./private-data.mjs";

type Snapshot = { tracks?: ImportedTrack[] };
type Examples = Record<string, ExampleTrack[]>;

const projectUrl = new URL("../", import.meta.url);
const snapshot = JSON.parse(await readFile(privateDataFile("imported-library.json"), "utf8")) as Snapshot;
const examples = JSON.parse(await readFile(new URL("app/data/genreExamples.json", projectUrl), "utf8")) as Examples;
const tracksById = new Map((snapshot.tracks ?? []).map((track) => [track.id, track]));

function local(id: string, note: string): ExampleTrack {
  const track = tracksById.get(id);
  if (!track) throw new Error(`Missing local track ${id}`);
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: track.artwork,
    spotifyUrl: track.spotifyUrl,
    note,
    index: 0,
  };
}

function external(track: Omit<ExampleTrack, "index">): ExampleTrack {
  return { ...track, index: 0 };
}

const curated: Record<string, ExampleTrack[]> = {
  "east-coast-hip-hop": [
    local("00JErUuTZnBA8eugXCWGuB", "A foundational New York posse cut with the raw, sample-heavy attack associated with East Coast rap."),
    local("0IVAlb0cFCH1cQ974iR1TU", "A durable New York underground classic that represents the scene's jazz-inflected lyricism."),
  ],
  "west-coast-hip-hop": [
    external({ id: "0bwgpGqkx6NKdMOZfZ4F9R", title: "Nuthin' But a 'G' Thang", artist: "Dr. Dre, Snoop Dogg", album: "The Chronic", artwork: null, spotifyUrl: "https://open.spotify.com/track/0bwgpGqkx6NKdMOZfZ4F9R", note: "A canonical G-funk recording repeatedly identified with the West Coast sound." }),
    external({ id: "2eU63GLRBeMOszGRTCEE9E", title: "California Love", artist: "2Pac, Roger Troutman, Dr. Dre", album: "All Eyez on Me", artwork: null, spotifyUrl: "https://open.spotify.com/track/2eU63GLRBeMOszGRTCEE9E", note: "A widely recognized West Coast anthem with California setting, G-funk production, and regional identity." }),
  ],
  "instrumental-hip-hop": [
    local("0Q1nTiEPnoQSqM0qrY9TMY", "Nujabes' warm, sample-led beatmaking is one of the clearest entry points into instrumental hip-hop."),
    local("0uLd31lmkKv0hYPg3Tnk1c", "A melodic Nujabes instrumental that shows the genre's balance of dusty drums, jazz harmony, and atmosphere."),
  ],
  "pop-rap": [
    local("2dxjKgT0li4qBI3QwuN9Ih", "A huge melodic hook and polished crossover production make this a clear pop-rap reference."),
    local("0LzrhCZFXW94Y8nwtTuRlw", "A hook-first pop record with rap-adjacent cadence and an unmistakable mainstream crossover design."),
  ],
  "japanese-hip-hop": [
    external({ id: "3GoKVu4XCvNbWg51XuGxX0", title: "Hachi To Chou (2024 Remix)", artist: "SOUL SCREAM", album: "Hachi To Chou (2024 Remix)", artwork: null, spotifyUrl: "https://open.spotify.com/track/3GoKVu4XCvNbWg51XuGxX0", note: "A scene-rooted SOUL SCREAM classic repeatedly singled out as an essential Japanese rap touchstone." }),
    external({ id: "1VLdR9j5zUYDpmY7Bdl3YD", title: "Luv(sic) pt3", artist: "Nujabes, Shing02", album: "Modal Soul", artwork: null, spotifyUrl: "https://open.spotify.com/track/1VLdR9j5zUYDpmY7Bdl3YD", note: "A globally recognized Japanese hip-hop/jazz-rap touchstone, chosen for its influence rather than library presence." }),
  ],
  disco: [
    external({
      id: "7CuPbY77ujwIQQyvPoSxFl",
      title: "Good Times",
      artist: "CHIC",
      album: "C'est Chic (2018 Remaster)",
      artwork: null,
      spotifyUrl: "https://open.spotify.com/track/7CuPbY77ujwIQQyvPoSxFl",
      note: "The Chic bass line and string-driven groove are among disco's most recognizable foundations.",
    }),
    external({
      id: "7awlAiVkw1csNaUZjab1n4",
      title: "I Feel Love",
      artist: "Donna Summer",
      album: "I Remember Yesterday",
      artwork: null,
      spotifyUrl: "https://open.spotify.com/track/7awlAiVkw1csNaUZjab1n4",
      note: "A landmark electronic-disco recording that shows the genre's futuristic, machine-driven side.",
    }),
  ],
  "pop-rock": [
    external({ id: "7cx6hiNiJIcSNfFZYW5fsQ", title: "Don't Stop Me Now", artist: "Queen", album: "Jazz", artwork: null, spotifyUrl: "https://open.spotify.com/track/7cx6hiNiJIcSNfFZYW5fsQ", note: "A durable, chorus-forward rock song whose accessibility and band attack make it a pop-rock touchstone." }),
    external({ id: "2rZBJFnAnQWXO7JQiAIz3i", title: "Mr. Brightside", artist: "The Killers", album: "Hot Fuss", artwork: null, spotifyUrl: "https://open.spotify.com/track/2rZBJFnAnQWXO7JQiAIz3i", note: "A defining 2000s guitar-pop crossover with an enormous singalong chorus." }),
  ],
  "k-ballad": [
    external({ id: "3P3UA61WRQqwCXaoFOTENd", title: "Through the Night", artist: "IU", album: "Palette", artwork: null, spotifyUrl: "https://open.spotify.com/track/3P3UA61WRQqwCXaoFOTENd", note: "A widely recognized modern K-ballad whose restrained vocal and intimate arrangement are central to the style." }),
    external({ id: "2BPXILn0MqOe5WroVXlvN1", title: "I Will Go to You Like the First Snow", artist: "AILEE", album: "Guardian (Original Television Soundtrack)", artwork: null, spotifyUrl: "https://open.spotify.com/track/2BPXILn0MqOe5WroVXlvN1", note: "A major Korean drama-ballad touchstone, selected for broad cultural recognition and genre fit." }),
  ],
  "anime-song": [
    local("3x4378ztiLvFmm2nuzEI0C", "An iconic anime opening and one of the most widely recognized songs in the anime-music canon."),
    local("2BlDX1yfT0ea5wo0vjCKKa", "A beloved anime opening that represents the melodic, emotionally direct side of anisong."),
  ],
  "bedroom-pop": [
    external({ id: "0KyAGiNGUytG5JLxJu4F6l", title: "Pretty Girl", artist: "Clairo", album: "diary 001", artwork: null, spotifyUrl: "https://open.spotify.com/track/0KyAGiNGUytG5JLxJu4F6l", note: "A defining bedroom-pop breakthrough whose home-recorded intimacy helped establish the modern reference point." }),
    external({ id: "75IQVo8hqI1iwVZyvkN2VT", title: "Show Me How", artist: "Men I Trust", album: "Oncle Jazz", artwork: null, spotifyUrl: "https://open.spotify.com/track/75IQVo8hqI1iwVZyvkN2VT", note: "A frequently surfaced bedroom/chill touchstone with close vocals and understated, DIY-adjacent production." }),
  ],
  "big-band": [
    external({ id: "61znp1Iy11bdJ2YAbwaqw7", title: "Sing, Sing, Sing", artist: "Benny Goodman", album: "The Essential Benny Goodman", artwork: null, spotifyUrl: "https://open.spotify.com/track/61znp1Iy11bdJ2YAbwaqw7", note: "A standard big-band reference for its famous drum feature, riff-based arrangement, and large-ensemble swing." }),
    external({ id: "3vE31QWfAQ3i9x1BjAVXqW", title: "In the Mood", artist: "Glenn Miller", album: "The Essential Glenn Miller", artwork: null, spotifyUrl: "https://open.spotify.com/track/3vE31QWfAQ3i9x1BjAVXqW", note: "One of the most broadly recognized big-band recordings and a staple of swing-era listening." }),
  ],
  "bubblegum-pop": [
    external({ id: "3M3SBRzq5mWfYPXZdOYPG4", title: "Sugar, Sugar", artist: "The Archies", album: "Everything's Archie", artwork: null, spotifyUrl: "https://open.spotify.com/track/3M3SBRzq5mWfYPXZdOYPG4", note: "A representative bubblegum-pop single: instantly catchy, lightweight, and central to the late-1960s craze." }),
    external({ id: "1s1RcqY9wVBCiRtazOUqpi", title: "Yummy Yummy Yummy", artist: "Ohio Express", album: "Ohio Express", artwork: null, spotifyUrl: "https://open.spotify.com/track/1s1RcqY9wVBCiRtazOUqpi", note: "A second Western bubblegum classic, chosen to avoid reducing the genre to one regional pop scene." }),
  ],
  hyperpop: [
    external({ id: "3egwpvStqkUtXwVZDlKl01", title: "money machine", artist: "100 gecs", album: "1000 gecs", artwork: null, spotifyUrl: "https://open.spotify.com/track/3egwpvStqkUtXwVZDlKl01", note: "A scene-defining 100 gecs track frequently used as an entry point to hyperpop's maximalist digital sound." }),
    external({ id: "6GoLARmR2OZl2EldehFrsA", title: "Immaterial", artist: "SOPHIE", album: "OIL OF EVERY PEARL'S UN-INSIDES", artwork: null, spotifyUrl: "https://open.spotify.com/track/6GoLARmR2OZl2EldehFrsA", note: "SOPHIE's synthetic pop production is foundational context for the hyperpop lineage." }),
  ],
  "jazz-ballad": [
    external({ id: "1cCyrkMFwJVGneDaZj4WPJ", title: "Misty", artist: "Ella Fitzgerald", album: "Clap Hands, Here Comes Charlie!", artwork: null, spotifyUrl: "https://open.spotify.com/track/1cCyrkMFwJVGneDaZj4WPJ", note: "A standard jazz-ballad choice, widely cited for its slow harmonic movement and intimate vocal phrasing." }),
    external({ id: "25ajcQN4gqQ8gLwB4zwS7a", title: "Naima", artist: "John Coltrane", album: "Giant Steps", artwork: null, spotifyUrl: "https://open.spotify.com/track/25ajcQN4gqQ8gLwB4zwS7a", note: "A canonical instrumental ballad whose spacious melody represents the form's other major tradition." }),
  ],
  swing: [
    external({ id: "61znp1Iy11bdJ2YAbwaqw7", title: "Sing, Sing, Sing", artist: "Benny Goodman", album: "The Essential Benny Goodman", artwork: null, spotifyUrl: "https://open.spotify.com/track/61znp1Iy11bdJ2YAbwaqw7", note: "A canonical swing-era recording with a driving big-band pulse and instantly recognizable arrangement." }),
    external({ id: "3vE31QWfAQ3i9x1BjAVXqW", title: "In the Mood", artist: "Glenn Miller", album: "The Essential Glenn Miller", artwork: null, spotifyUrl: "https://open.spotify.com/track/3vE31QWfAQ3i9x1BjAVXqW", note: "A universally recognizable swing standard and a fair second reference for the genre." }),
  ],
  "soft-rock": [
    external({ id: "2DgnRw7Fpocvj8iavjCvaf", title: "More Than a Feeling", artist: "Boston", album: "Boston", artwork: null, spotifyUrl: "https://open.spotify.com/track/2DgnRw7Fpocvj8iavjCvaf", note: "A durable soft-rock radio touchstone built around melodic guitar, polished production, and a large chorus." }),
    external({ id: "0ofHAoxe9vBkTCp2UQIavz", title: "Dreams", artist: "Fleetwood Mac", album: "Rumours", artwork: null, spotifyUrl: "https://open.spotify.com/track/0ofHAoxe9vBkTCp2UQIavz", note: "A widely recognized softer rock classic whose restrained groove and vocal melody fit the category's core." }),
  ],
  digicore: [
    external({ id: "2VNM40GnccbNGyzYIvVeRH", title: "astrid", artist: "glaive", album: "New Money", artwork: null, spotifyUrl: "https://open.spotify.com/track/2VNM40GnccbNGyzYIvVeRH", note: "A scene-associated glaive track representing digicore's compressed songwriting and internet-native vocal production." }),
    external({ id: "1yCZyiJlxQSt0DFB9mVTCS", title: "Trying", artist: "midwxst", album: "Trying", artwork: null, spotifyUrl: "https://open.spotify.com/track/1yCZyiJlxQSt0DFB9mVTCS", note: "midwxst is regularly discussed as a central digicore-era voice; this is a research-based scene pick." }),
  ],
  "teen-pop": [
    external({ id: "7EFVJfuaqhIIvzNHZpEpth", title: "...Baby One More Time", artist: "Britney Spears", album: "...Baby One More Time", artwork: null, spotifyUrl: "https://open.spotify.com/track/7EFVJfuaqhIIvzNHZpEpth", note: "A defining late-1990s teen-pop single and one of the clearest genre touchstones." }),
    external({ id: "5whWSsKs8TvXHAB8RUbxFY", title: "I Want It That Way", artist: "Backstreet Boys", album: "Millennium", artwork: null, spotifyUrl: "https://open.spotify.com/track/5whWSsKs8TvXHAB8RUbxFY", note: "A canonical boy-band teen-pop hit representing the genre's vocal-group and crossover-pop center." }),
  ],
  "a-cappella": [
    external({ id: "4NwVMYo8hc5ORX5Jj5ZLq0", title: "Daft Punk", artist: "Pentatonix", album: "Pentatonix", artwork: null, spotifyUrl: "https://open.spotify.com/track/4NwVMYo8hc5ORX5Jj5ZLq0", note: "A prominent modern a cappella showcase whose vocal arrangement became a major public reference for the form." }),
    external({ id: "50uSx890O0zPwJumbjBQkA", title: "The Longest Time", artist: "Billy Joel", album: "An Innocent Man", artwork: null, spotifyUrl: "https://open.spotify.com/track/50uSx890O0zPwJumbjBQkA", note: "A famous vocal-only pop arrangement that demonstrates the tradition beyond contemporary vocal groups." }),
  ],
  punjabi: [
    external({ id: "42OYT1BLobBto3eIhLr5qp", title: "Dil Da Mamla Hai", artist: "Gurdas Maan", album: "Dil Da Mamla Hai", artwork: null, spotifyUrl: "https://open.spotify.com/track/42OYT1BLobBto3eIhLr5qp", note: "A foundational Gurdas Maan recording: a widely recognized Punjabi song rooted in the language, melodic phrasing, and cultural tradition of the region." }),
    external({ id: "04F3WxD0QdAecHjclEzFt2", title: "Bol Punjab De", artist: "Skillz Inc., Surinder Shinda", album: "Bol Punjab De", artwork: null, spotifyUrl: "https://open.spotify.com/track/04F3WxD0QdAecHjclEzFt2", note: "A Punjabi folk/pop touchstone connecting Surinder Shinda's traditional vocal lineage with a contemporary production frame." }),
  ],
  "video-game-music": [
    local("4NsPgRYUdHu2Q5JRNgXYU5", "A modern game-music touchstone whose spacious piano writing has become inseparable from Minecraft's world."),
    local("2OSFhiIBYXIBiVOyLnDQ2b", "A memorable game theme that demonstrates how video-game music can function as character, atmosphere, and song."),
  ],
  "city-pop": [
    external({
      id: "7rU6Iebxzlvqy5t857bKFq",
      title: "Plastic Love",
      artist: "Mariya Takeuchi",
      album: "Variety",
      artwork: null,
      spotifyUrl: "https://open.spotify.com/track/7rU6Iebxzlvqy5t857bKFq",
      note: "One of the clearest international entry points to city pop's polished, nocturnal sophistication.",
    }),
    local("5ULmKQMAwbdVxHNvDtsUzm", "Taeko Onuki's elegant songwriting and studio palette represent the genre's sophisticated Japanese pop lineage."),
  ],
};

for (const [genreId, tracks] of Object.entries(curated)) {
  examples[genreId] = tracks.map((track, index) => ({ ...track, index }));
}
delete examples["punjabi-hip-hop"];

await writeFile(new URL("app/data/genreExamples.json", projectUrl), `${JSON.stringify(examples, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ curatedGenres: Object.keys(curated), examplesReplaced: Object.values(curated).flat().length }));
