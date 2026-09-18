import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { genreMatches, normalizeGenre } from "../app/lib/genre-match.ts";
import { isTrack, parseAssignments } from "../app/lib/music.ts";

const track = {
  id: "track-1",
  title: "A Track",
  artist: "An Artist",
  album: "An Album",
  artwork: null,
  spotifyUrl: "https://open.spotify.com/track/track-1",
  artistIds: ["artist-1"],
};

test("assignment parsing keeps valid tracks and rejects corrupt state", () => {
  assert.deepEqual(parseAssignments(null), {});
  assert.deepEqual(parseAssignments("not json"), {});
  assert.deepEqual(parseAssignments("[]"), {});
  assert.deepEqual(parseAssignments(JSON.stringify({ jazz: track, rock: { id: "broken" } })), { jazz: track });
});

test("track validation enforces the persisted shape", () => {
  assert.equal(isTrack(track), true);
  assert.equal(isTrack({ ...track, artwork: 42 }), false);
  assert.equal(isTrack({ ...track, artistIds: [null] }), false);
});

test("genre comparison handles punctuation and related labels", () => {
  assert.equal(normalizeGenre("R&B"), "randb");
  assert.equal(genreMatches("Hip Hop", ["alternative hip-hop"]), true);
  assert.equal(genreMatches("Abstract Hip Hop", ["hip hop"]), false);
  assert.equal(genreMatches("Techno", ["Detroit techno"]), true);
  assert.equal(genreMatches("Rage", ["rage rap"]), true);
  assert.equal(genreMatches("Rage", ["UK garage", "garage rock"]), false);
  assert.equal(genreMatches("Jazz", ["indie rock", "soul"]), false);
});

test("every catalog genre has two valid representative tracks", async () => {
  const examples = JSON.parse(await readFile(new URL("../app/data/genreExamples.json", import.meta.url), "utf8"));
  const entries = Object.entries(examples);
  assert.equal(entries.length, 146);
  for (const [genreId, tracks] of entries) {
    assert.equal(tracks.length, 2, `${genreId} should have two examples`);
    assert.equal(tracks.every((example) => isTrack(example) && typeof example.note === "string"), true, `${genreId} has an invalid example`);
  }
});

test("the reviewed authority keeps its missing-genre summary consistent", async () => {
  const authority = JSON.parse(await readFile(new URL("../app/data/publicReviews.json", import.meta.url), "utf8"));
  assert.deepEqual([...authority.missingGenreCandidateIds].sort(), authority.missingGenreCandidates.map((candidate) => candidate.id).sort());
  assert.equal(authority.missingGenreCandidates.every((candidate) => candidate.count > 0), true);
});
