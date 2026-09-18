import { readFile } from "node:fs/promises";
import snapshotData from "../../../data/publicLibrary.json";
import { privateDataPath } from "../../../lib/private-data";

export async function GET() {
  let data: unknown = snapshotData;
  if (process.env.NODE_ENV !== "production") {
    try {
      data = JSON.parse(await readFile(privateDataPath("imported-library.json"), "utf8"));
    } catch { /* A new clone has no private seed. */ }
  }
  return Response.json(data, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
