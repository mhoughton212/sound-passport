import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentPath = resolve(projectRoot, "app/data/content.json");
const genreOverridesPath = resolve(projectRoot, "app/data/genreOverrides.json");
const genreExamplesPath = resolve(projectRoot, "app/data/genreExamples.json");

type Update =
  | { kind: "content"; key?: string; value?: string }
  | { kind: "genre"; id?: string; field?: "name" | "description"; value?: string }
  | { kind: "example-note"; genreId?: string; index?: number; value?: string };

function validText(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= limit;
}

export function localContentEditor(): Plugin {
  return {
    name: "sound-passport-local-content-editor",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__sound-passport/editor", async (request, response) => {
        response.setHeader("Content-Type", "application/json");
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          let rawBody = "";
          for await (const chunk of request) rawBody += chunk;
          const update = JSON.parse(rawBody) as Update;

          if (update.kind === "content") {
            const content = JSON.parse(await readFile(contentPath, "utf8")) as Record<string, string>;
            if (!update.key || !(update.key in content) || !validText(update.value, 240)) throw new Error("Invalid content update");
            content[update.key] = update.value.trim();
            await writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
          } else if (update.kind === "genre") {
            if (!update.id?.match(/^[a-z0-9-]+$/) || !update.field || !validText(update.value, 500)) throw new Error("Invalid genre update");
            const overrides = JSON.parse(await readFile(genreOverridesPath, "utf8")) as Record<string, { name?: string; description?: string }>;
            overrides[update.id] = { ...overrides[update.id], [update.field]: update.value.trim() };
            await writeFile(genreOverridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
          } else if (update.kind === "example-note") {
            if (!update.genreId?.match(/^[a-z0-9-]+$/) || !Number.isInteger(update.index) || !validText(update.value, 300)) throw new Error("Invalid example update");
            const examples = JSON.parse(await readFile(genreExamplesPath, "utf8")) as Record<string, Array<{ note: string }>>;
            const example = examples[update.genreId]?.[update.index as number];
            if (!example) throw new Error("Unknown example");
            example.note = update.value.trim();
            await writeFile(genreExamplesPath, `${JSON.stringify(examples, null, 2)}\n`, "utf8");
          } else {
            throw new Error("Unknown update kind");
          }

          response.end(JSON.stringify({ ok: true }));
        } catch {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: "Could not save text" }));
        }
      });
    },
  };
}
