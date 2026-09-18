import type { ImportedTrack } from "./library";

const DATABASE_NAME = "sound-passport-library";
const STORE_NAME = "tracks";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function complete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getLibraryTracks() {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const request = transaction.objectStore(STORE_NAME).getAll();
  const tracks = await new Promise<ImportedTrack[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as ImportedTrack[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return tracks;
}

export async function replaceLibraryTracks(tracks: ImportedTrack[]) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  store.clear();
  for (const track of tracks) store.put(track);
  await complete(transaction);
  database.close();
}

export async function clearLibraryTracks() {
  return replaceLibraryTracks([]);
}
