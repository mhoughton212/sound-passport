import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = resolve(projectRoot, ".private-data", "data");
const assignmentsPath = resolve(dataDirectory, "assignments.json");

type ExportedTrack = {
  id?: unknown;
};

export function localLibraryFile(): Plugin {
  return {
    name: "sound-passport-local-library-file",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__sound-passport/assignments-file", async (request, response) => {
        response.setHeader("Content-Type", "application/json");
        if (request.method === "GET") {
          try {
            response.end(await readFile(assignmentsPath, "utf8"));
          } catch {
            response.statusCode = 404;
            response.end(JSON.stringify({ error: "No local assignments file exists yet" }));
          }
          return;
        }
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        try {
          let rawBody = "";
          for await (const chunk of request) {
            rawBody += chunk;
            if (rawBody.length > 5_000_000) throw new Error("Assignments are too large");
          }
          const assignments = JSON.parse(rawBody) as Record<string, ExportedTrack>;
          if (!assignments || typeof assignments !== "object" || Array.isArray(assignments) || Object.values(assignments).some((track) => !track || typeof track.id !== "string")) throw new Error("Invalid assignments");
          await mkdir(dataDirectory, { recursive: true });
          await writeFile(assignmentsPath, `${JSON.stringify({ version: 1, savedAt: new Date().toISOString(), assignments }, null, 2)}\n`, "utf8");
          response.end(JSON.stringify({ ok: true, assignmentCount: Object.keys(assignments).length }));
        } catch {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: "Could not save local assignments" }));
        }
      });
    },
  };
}
