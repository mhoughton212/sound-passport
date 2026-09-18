import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: path === "/" ? "text/html" : "application/json" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Sound Passport catalog", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Sound Passport<\/title>/i);
  assert.match(html, /Sound Passport genre collection/i);
  assert.match(html, /Select track/i);
  assert.match(html, /146 genres assigned/i);
});

test("serves the preloaded library and reviewed genres", async () => {
  const seedResponse = await render("/api/library/seed");
  assert.equal(seedResponse.status, 200);
  const seed = await seedResponse.json();
  assert.equal(seed.trackCount, 0);
  assert.equal(seed.tracks.length, 0);

  const reviewResponse = await render("/api/library/reviews");
  assert.equal(reviewResponse.status, 200);
  const reviewFile = await reviewResponse.json();
  assert.equal(seed.tracks.every((track) => reviewFile.reviews[track.id]), true);
});

test("does not ship starter or development-editor UI", async () => {
  const html = await (await render()).text();
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  assert.doesNotMatch(html, /Edit text|__smart-music/i);
});
