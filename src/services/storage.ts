/**
 * Persists metadata of added photos (name, coordinates, capture time) in
 * localStorage so the map survives a reload. Image data is NOT stored —
 * thumbnails would blow the ~5 MB quota — so restored photos show a
 * placeholder icon.
 */

export interface StoredPhoto {
  /** Stable key linking the metadata to thumbnails in IndexedDB. */
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  takenAt: number | null;
  /** Reverse-geocoded city, stored to avoid repeated lookups. */
  city: string | null;
}

const STORAGE_KEY = "photo-map:photos";

export function sanitizeStoredPhotos(value: unknown): StoredPhoto[] {
  if (!Array.isArray(value)) return [];
  const out: StoredPhoto[] = [];
  for (const entry of value) {
    if (!(entry instanceof Object)) continue;
    const name: unknown = Reflect.get(entry, "name");
    if (typeof name !== "string" || name === "") continue;
    const lat = numberOrNull(Reflect.get(entry, "lat"));
    const lon = numberOrNull(Reflect.get(entry, "lon"));
    const city: unknown = Reflect.get(entry, "city");
    const id: unknown = Reflect.get(entry, "id");
    if (typeof id !== "string" || id === "") continue;
    out.push({
      id,
      name,
      lat,
      lon: lat === null ? null : lon,
      takenAt: numberOrNull(Reflect.get(entry, "takenAt")),
      city: typeof city === "string" && city !== "" ? city : null,
    });
  }
  return out;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function loadStoredPhotos(): StoredPhoto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitizeStoredPhotos(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveStoredPhotos(photos: StoredPhoto[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  } catch {
    // storage unavailable or full — photos just won't survive a reload
  }
}

export function clearStoredPhotos(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clean up if storage is unavailable
  }
}

// ---------- Thumbnails in IndexedDB (too big for localStorage) ----------

const DB_NAME = "photo-map";
const THUMBS_STORE = "thumbnails";

export interface StoredThumbnails {
  thumb: Blob | null;
  preview: Blob | null;
  /** The untouched original file — keeps the popup magnifier working
   * after a reload. Null when saving it failed (e.g. quota). */
  original: Blob | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(THUMBS_STORE)) {
        request.result.createObjectStore(THUMBS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveThumbnails(
  id: string,
  thumbs: StoredThumbnails,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(THUMBS_STORE, "readwrite");
      tx.objectStore(THUMBS_STORE).put({ id, ...thumbs });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // quota/unavailable — thumbnails just won't survive a reload
  }
}

export async function loadThumbnails(
  id: string,
): Promise<StoredThumbnails | null> {
  try {
    const db = await openDb();
    const result = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(THUMBS_STORE, "readonly");
      const request = tx.objectStore(THUMBS_STORE).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!(result instanceof Object)) return null;
    const thumb: unknown = Reflect.get(result, "thumb");
    const preview: unknown = Reflect.get(result, "preview");
    const original: unknown = Reflect.get(result, "original");
    return {
      thumb: thumb instanceof Blob ? thumb : null,
      preview: preview instanceof Blob ? preview : null,
      original: original instanceof Blob ? original : null,
    };
  } catch {
    return null;
  }
}

export async function deleteThumbnails(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(THUMBS_STORE, "readwrite");
      tx.objectStore(THUMBS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // nothing to clean up if IndexedDB is unavailable
  }
}

export async function clearThumbnails(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(THUMBS_STORE, "readwrite");
      tx.objectStore(THUMBS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // nothing to clean up if IndexedDB is unavailable
  }
}
