import type { Track } from "./music";

declare global {
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
  }
  interface Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
  }
}

const AUDIO_EXTENSIONS = /\.(aac|flac|m4a|mp3|ogg|opus|wav|webm)$/i;

export type LocalScanResult = {
  tracks: Track[];
  totalFiles: number;
  supportedFiles: number;
  metadataRead: number;
  metadataFailed: number;
  skippedFiles: number;
  failures: string[];
};

function value(value: unknown, fallback: string) {
  if (Array.isArray(value)) return value.find((item): item is string => typeof item === "string" && item.trim().length > 0)?.trim() ?? fallback;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function readLocalFile(file: File): Promise<{ track: Track; metadataRead: boolean; error?: string } | null> {
  if (!AUDIO_EXTENSIONS.test(file.name)) return null;
  try {
    const { parseBlob, selectCover } = await import("music-metadata");
    const metadata = await parseBlob(file, { duration: false, skipPostHeaders: true });
    const native = Object.values(metadata.native ?? {}).flat();
    const nativeValue = (keys: string[]) => value(native.find((tag) => typeof tag.id === "string" && keys.includes(tag.id.toLowerCase()))?.value, "");
    const title = value(metadata.common.title, nativeValue(["title", "tit2", "©nam"]) || "Untitled");
    const artist = value(metadata.common.artist, nativeValue(["artist", "tpe1", "©art"]) || "Unknown artist");
    const album = value(metadata.common.album, "Local files");
    const cover = selectCover(metadata.common.picture);
    const artwork = cover ? `data:${cover.format};base64,${bytesToBase64(cover.data)}` : null;
    return { track: {
      id: `local:${file.name}:${file.size}:${file.lastModified}`,
      title,
      artist,
      album,
      artwork,
      spotifyUrl: "",
      source: "local",
      sources: ["Local files"],
      localFileName: file.name,
      localFile: file,
    }, metadataRead: true };
  } catch (error) {
    return { track: {
      id: `local:${file.name}:${file.size}:${file.lastModified}`,
      title: "Untitled",
      artist: "Unknown artist",
      album: "Local files",
      artwork: null,
      spotifyUrl: "",
      source: "local",
      sources: ["Local files"],
      localFileName: file.name,
      localFile: file,
    }, metadataRead: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export async function scanLocalFolder() {
  if (!window.showDirectoryPicker) throw new Error("Folder access requires Chrome or Edge.");
  let directory: FileSystemDirectoryHandle;
  try {
    directory = await window.showDirectoryPicker({ mode: "read" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return emptyScanResult();
    throw new Error(`Could not open the selected folder: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result: LocalScanResult = { tracks: [], totalFiles: 0, supportedFiles: 0, metadataRead: 0, metadataFailed: 0, skippedFiles: 0, failures: [] };
  await scanDirectory(directory, result);
  return result;
}

function emptyScanResult(): LocalScanResult {
  return { tracks: [], totalFiles: 0, supportedFiles: 0, metadataRead: 0, metadataFailed: 0, skippedFiles: 0, failures: [] };
}

async function scanDirectory(directory: FileSystemDirectoryHandle, result: LocalScanResult) {
  try {
    for await (const entry of directory.values()) {
      if (entry.kind === "directory") {
        await scanDirectory(entry, result);
        continue;
      }
      result.totalFiles += 1;
      try {
        const parsed = await readLocalFile(await entry.getFile());
        if (!parsed) {
          result.skippedFiles += 1;
          continue;
        }
        result.supportedFiles += 1;
        result.tracks.push(parsed.track);
        if (parsed.metadataRead) result.metadataRead += 1;
        else {
          result.metadataFailed += 1;
          result.failures.push(`${entry.name}: ${parsed.error ?? "metadata could not be read"}`);
        }
      } catch (error) {
        result.skippedFiles += 1;
        result.failures.push(`${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    throw new Error(`Could not read the selected folder: ${error instanceof Error ? error.message : String(error)}`);
  }
}
