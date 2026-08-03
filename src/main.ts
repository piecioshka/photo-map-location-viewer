import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./styles.css";

import { readGps, readTakenAt } from "./photo/exif";
import { reverseCity } from "./services/geocode";
import { createPhotoMap } from "./map/map";
import { isImageFile, type GpsCoords } from "./photo/photo";
import {
  loadAccentColor,
  loadDateLocale,
  loadFeatures,
  saveAccentColor,
  saveDateLocale,
  saveFeatures,
  type FeatureSettings,
} from "./services/settings";
import { setDateLocale } from "./photo/photo";
import { initMonitoring } from "./services/monitoring";
import { isFeatureEnabled } from "./services/feature-flags";
import {
  loadLanguage,
  sanitizeLanguage,
  saveLanguage,
  setLanguage,
  t,
} from "./services/i18n";
import { buildGeoJson, buildKml, downloadFile } from "./services/export";
import { applyAccent, applyDarkTheme } from "./ui/theme";
import {
  clearStoredPhotos,
  clearThumbnails,
  deleteThumbnails,
  loadStoredPhotos,
  loadThumbnails,
  saveStoredPhotos,
  saveThumbnails,
  type StoredPhoto,
} from "./services/storage";
import { makeThumbnailBlob } from "./photo/thumbnails";
import type { PhotoMarkerHandle } from "./map/map";
import {
  addPhotoEntry,
  hideEmptyState,
  hideLoader,
  initSettingsPanel,
  onCityRename,
  onClearPhotos,
  resetPhotoList,
  setPhotoListVisible,
  showLoader,
  showToast,
  updateCounter,
  type PhotoEntryHandle,
} from "./ui/ui";
import {
  addTimelineEntry,
  clearTimeline,
  setTimelineEnabled,
  type TimelineEntryHandle,
} from "./ui/timeline";
import { byId } from "./ui/dom";
import {
  addCalendarPhoto,
  clearCalendar,
  initCalendar,
  setCalendarEnabled,
  type CalendarPhotoHandle,
} from "./ui/calendar";

const MARKER_THUMB_SIZE = 96;
const POPUP_PREVIEW_SIZE = 480;

// Language first — the map bakes translated strings into its controls.
setLanguage(loadLanguage());

const map = createPhotoMap(document.getElementById("map")!);
const input = byId("file-input", HTMLInputElement);
const folderInput = byId("folder-input", HTMLInputElement);
const folderPicker = byId("folder-picker", HTMLElement);
const dropOverlay = byId("drop-overlay", HTMLElement);

void initMonitoring();

byId("app-version", HTMLElement).textContent = __APP_VERSION__;

let features: FeatureSettings = loadFeatures();
const dateLocale = loadDateLocale();
setDateLocale(dateLocale === "auto" ? undefined : dateLocale);
const accentColor = loadAccentColor();
applyAccent(accentColor);
map.setRouteColor(accentColor);
applyDarkTheme(features.dark);
map.setDarkTheme(features.dark);
map.applyFeatures(features);
setPhotoListVisible(features.photoList);
setTimelineEnabled(features.timeline);
setCalendarEnabled(features.calendar);
initCalendar((dayPhotos) => {
  const coords = [];
  for (const photo of dayPhotos) {
    if (photo.coords) coords.push(photo.coords);
  }
  map.fitCoords(coords);
});
initSettingsPanel(
  features,
  (next) => {
    features = next;
    saveFeatures(next);
    applyDarkTheme(next.dark);
    map.setDarkTheme(next.dark);
    map.applyFeatures(next);
    setPhotoListVisible(next.photoList);
    setTimelineEnabled(next.timeline);
    setCalendarEnabled(next.calendar);
  },
  accentColor,
  (color) => {
    saveAccentColor(color);
    applyAccent(color);
    map.setRouteColor(color);
  },
  dateLocale,
  (locale) => {
    saveDateLocale(locale);
    setDateLocale(locale === "auto" ? undefined : locale);
    // re-render everything that prints dates
    setPhotoListVisible(features.photoList);
    setTimelineEnabled(features.timeline);
    setCalendarEnabled(features.calendar);
  },
);

let located = 0;
let unlocated = 0;
/** Bumped on "new session" — aborts photo processing already in flight. */
let session = 0;

const storedPhotos: StoredPhoto[] = [];
const pendingPlaces: {
  coords: GpsCoords;
  handle: PhotoEntryHandle;
  marker: PhotoMarkerHandle;
  stored: StoredPhoto;
  requested: boolean;
}[] = [];
/** Object URLs per photo id — revoked when the photo goes away. */
const objectUrls = new Map<string, string[]>();

/**
 * Thumbnail writes are fire-and-forget, so a "new session" could wipe the
 * store before they land and leave unreachable blobs behind. Keeping the
 * last write lets the clear wait for it.
 */
let thumbnailWrites: Promise<unknown> = Promise.resolve();

function trackThumbnailWrite(write: Promise<unknown>): void {
  thumbnailWrites = Promise.allSettled([thumbnailWrites, write]);
}

function trackUrl(id: string, url: string): string {
  const urls = objectUrls.get(id);
  if (urls) urls.push(url);
  else objectUrls.set(id, [url]);
  return url;
}

function removeStoredPhoto(id: string): void {
  const index = storedPhotos.findIndex((photo) => photo.id === id);
  if (index !== -1) storedPhotos.splice(index, 1);
  // Drop any queued geocoding for it, or the entry keeps the marker and the
  // list handle alive and resolves onto a photo that no longer exists.
  const pending = pendingPlaces.findIndex((entry) => entry.stored.id === id);
  if (pending !== -1) pendingPlaces.splice(pending, 1);
  saveStoredPhotos(storedPhotos);
  void deleteThumbnails(id);
  for (const url of objectUrls.get(id) ?? []) URL.revokeObjectURL(url);
  objectUrls.delete(id);
}

function requestPlaces(): void {
  for (const entry of pendingPlaces) {
    if (entry.requested) continue;
    entry.requested = true;
    void reverseCity(entry.coords)
      .then((city) => {
        if (!city) return;
        entry.handle.setCity(city);
        entry.marker.setPlace(city);
        entry.stored.city = city;
        saveStoredPhotos(storedPhotos);
      })
      .catch(() => {
        // a name we could not resolve is not worth bothering the user with
      });
  }
}

interface LocatedPhotoArgs {
  name: string;
  coords: GpsCoords;
  takenAt: number | null;
  thumbUrl: string | null;
  previewUrl: string | null;
  originalUrl: string | null;
}

function addLocatedPhoto(args: LocatedPhotoArgs, stored: StoredPhoto): void {
  const marker = map.addPhotoMarker({ ...args, city: stored.city });
  let timelineHandle: TimelineEntryHandle | null = null;
  let calendarHandle: CalendarPhotoHandle | null = null;
  const entry = addPhotoEntry({
    name: args.name,
    thumbUrl: args.thumbUrl,
    takenAt: args.takenAt,
    onSelect: () => marker.focus(),
    onRemove: () => {
      entry.remove();
      marker.remove();
      timelineHandle?.remove();
      calendarHandle?.remove();
      removeStoredPhoto(stored.id);
      located -= 1;
      updateCounter(located, unlocated);
    },
  });
  located += 1;
  if (args.takenAt !== null) {
    timelineHandle = addTimelineEntry({
      name: args.name,
      takenAt: args.takenAt,
      thumbUrl: args.thumbUrl,
      onSelect: () => marker.focus(),
    });
    calendarHandle = addCalendarPhoto({
      takenAt: args.takenAt,
      coords: args.coords,
    });
  }
  if (stored.city) {
    entry.setCity(stored.city);
  } else {
    pendingPlaces.push({
      coords: args.coords,
      handle: entry,
      marker,
      stored,
      requested: false,
    });
  }
}

function addUnlocatedPhoto(
  id: string,
  name: string,
  thumbUrl: string | null,
  takenAt: number | null,
): void {
  let timelineHandle: TimelineEntryHandle | null = null;
  let calendarHandle: CalendarPhotoHandle | null = null;
  const entry = addPhotoEntry({
    name,
    thumbUrl,
    takenAt,
    onRemove: () => {
      entry.remove();
      timelineHandle?.remove();
      calendarHandle?.remove();
      removeStoredPhoto(id);
      unlocated -= 1;
      updateCounter(located, unlocated);
    },
  });
  unlocated += 1;
  if (takenAt !== null) {
    timelineHandle = addTimelineEntry({ name, takenAt, thumbUrl });
    calendarHandle = addCalendarPhoto({ takenAt, coords: null });
  }
}

/** Kicked off at startup; imports wait for it so both agree on storedPhotos. */
const restoreDone = restoreStoredPhotos();

async function processFiles(files: File[]): Promise<void> {
  if (files.length === 0) return;
  // Wait for a restore in flight: both write to storedPhotos, and saving a
  // half-restored list would drop the photos that had not landed yet.
  await restoreDone;
  hideEmptyState();
  const mySession = session;
  let processed = 0;
  showLoader(processed, files.length);

  try {
    for (const file of files) {
      if (session !== mySession) return; // a new session started mid-batch
      const coords = await readGps(file);
      const takenAt = await readTakenAt(file);
      const id = crypto.randomUUID();
      if (coords) {
        const [thumbBlob, previewBlob] = await Promise.all([
          makeThumbnailBlob(file, MARKER_THUMB_SIZE),
          makeThumbnailBlob(file, POPUP_PREVIEW_SIZE),
        ]);
        // The session can end while we decode; nothing may be added after
        // that, or it outlives the clear as an orphan.
        if (session !== mySession) return;
        trackThumbnailWrite(
          saveThumbnails(id, {
            thumb: thumbBlob,
            preview: previewBlob,
            original: features.storeOriginals ? file : null,
          }),
        );
        const originalUrl = trackUrl(id, URL.createObjectURL(file));
        const stored: StoredPhoto = {
          id,
          name: file.name,
          lat: coords.lat,
          lon: coords.lon,
          takenAt,
          city: null,
        };
        storedPhotos.push(stored);
        addLocatedPhoto(
          {
            name: file.name,
            coords,
            takenAt,
            thumbUrl: thumbBlob
              ? trackUrl(id, URL.createObjectURL(thumbBlob))
              : null,
            previewUrl: previewBlob
              ? trackUrl(id, URL.createObjectURL(previewBlob))
              : null,
            originalUrl,
          },
          stored,
        );
      } else {
        const thumbBlob = await makeThumbnailBlob(file, MARKER_THUMB_SIZE);
        if (session !== mySession) return;
        trackThumbnailWrite(
          saveThumbnails(id, {
            thumb: thumbBlob,
            preview: null,
            original: null,
          }),
        );
        addUnlocatedPhoto(
          id,
          file.name,
          thumbBlob ? trackUrl(id, URL.createObjectURL(thumbBlob)) : null,
          takenAt,
        );
        storedPhotos.push({
          id,
          name: file.name,
          lat: null,
          lon: null,
          takenAt,
          city: null,
        });
      }
      updateCounter(located, unlocated);
      processed += 1;
      showLoader(processed, files.length);
    }
  } finally {
    hideLoader();
  }

  if (session !== mySession) return;
  saveStoredPhotos(storedPhotos);
  requestPlaces();
  map.fitAll();
  void warnWhenStorageTight();
}

// ---------- Storage quota ----------

// Ask the browser not to evict our IndexedDB under storage pressure.
void navigator.storage?.persist?.();

async function warnWhenStorageTight(): Promise<void> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate?.usage || !estimate.quota) return;
    if (estimate.usage / estimate.quota > 0.8) {
      const usedMb = Math.round(estimate.usage / 1024 / 1024);
      showToast(
        `${t("storageAlmostFull")} (${usedMb} MB). ${t("storageAdvice")}`,
      );
    }
  } catch {
    // estimate unavailable — nothing to warn about
  }
}

// ---------- Restore photos persisted in a previous session ----------

async function restoreStoredPhotos(): Promise<void> {
  const stored = loadStoredPhotos();
  if (stored.length === 0) return;
  hideEmptyState();
  let processed = 0;
  showLoader(processed, stored.length);
  try {
    for (const photo of stored) {
      restoreOne(photo, await loadThumbnails(photo.id));
      processed += 1;
      showLoader(processed, stored.length);
    }
  } finally {
    hideLoader();
  }
  updateCounter(located, unlocated);
  requestPlaces();
  map.fitAll();
}

function restoreOne(
  photo: StoredPhoto,
  thumbs: Awaited<ReturnType<typeof loadThumbnails>>,
): void {
  storedPhotos.push(photo);
  const thumbUrl = thumbs?.thumb
    ? trackUrl(photo.id, URL.createObjectURL(thumbs.thumb))
    : null;
  if (photo.lat !== null && photo.lon !== null) {
    addLocatedPhoto(
      {
        name: photo.name,
        coords: { lat: photo.lat, lon: photo.lon },
        takenAt: photo.takenAt,
        thumbUrl,
        previewUrl: thumbs?.preview
          ? trackUrl(photo.id, URL.createObjectURL(thumbs.preview))
          : null,
        originalUrl: thumbs?.original
          ? trackUrl(photo.id, URL.createObjectURL(thumbs.original))
          : null,
      },
      photo,
    );
  } else {
    addUnlocatedPhoto(photo.id, photo.name, thumbUrl, photo.takenAt);
  }
}

onClearPhotos(() => {
  session += 1;
  storedPhotos.length = 0;
  pendingPlaces.length = 0;
  clearStoredPhotos();
  // Let pending writes settle first, or they would repopulate the store.
  void thumbnailWrites.then(() => clearThumbnails());
  map.clearPhotos();
  for (const urls of objectUrls.values()) {
    for (const url of urls) URL.revokeObjectURL(url);
  }
  objectUrls.clear();
  located = 0;
  unlocated = 0;
  resetPhotoList();
  clearTimeline();
  clearCalendar();
  updateCounter(0, 0);
});

input.addEventListener("change", () => {
  const files = Array.from(input.files ?? []);
  input.value = ""; // allow re-selecting the same files later
  void processFiles(files);
});

// ---------- Language ----------

const languageSelect = document.getElementById("language");
if (languageSelect instanceof HTMLSelectElement) {
  languageSelect.value = loadLanguage();
  languageSelect.addEventListener("change", () => {
    const language = sanitizeLanguage(languageSelect.value);
    saveLanguage(language);
    setLanguage(language);
    // re-render widgets that bake translated strings into the DOM
    setPhotoListVisible(features.photoList);
    setTimelineEnabled(features.timeline);
    setCalendarEnabled(features.calendar);
    updateCounter(located, unlocated);
  });
}

// ---------- Manual city rename (geocoding is sometimes off) ----------

onCityRename((oldCity, newCity) => {
  for (const photo of storedPhotos) {
    if (photo.city === oldCity) photo.city = newCity;
  }
  saveStoredPhotos(storedPhotos);
  map.renameCity(oldCity, newCity);
});

// ---------- Web Share Target (photos shared from the phone gallery) ----------

async function importSharedPhotos(): Promise<void> {
  if (!new URLSearchParams(location.search).has("shared")) return;
  history.replaceState(null, "", "/");
  try {
    const cache = await caches.open("shared-photos");
    const requests = await cache.keys();
    const files: File[] = [];
    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;
      const name = decodeURIComponent(
        response.headers.get("X-File-Name") ?? "shared.jpg",
      );
      const blob = await response.blob();
      files.push(new File([blob], name, { type: blob.type }));
      await cache.delete(request);
    }
    if (files.length > 0) await processFiles(files);
  } catch {
    // cache unavailable — nothing was shared after all
  }
}

void importSharedPhotos();

// ---------- Demo photos ----------

document.getElementById("demo-button")?.addEventListener("click", () => {
  void import("./photo/demo").then(async ({ makeDemoPhotos }) => {
    await processFiles(await makeDemoPhotos());
  });
});

// ---------- Trip export ----------

document.getElementById("export-geojson")?.addEventListener("click", () => {
  downloadFile(
    "photo-map.geojson",
    buildGeoJson(storedPhotos),
    "application/geo+json",
  );
});

document.getElementById("export-kml")?.addEventListener("click", () => {
  downloadFile(
    "photo-map.kml",
    buildKml(storedPhotos),
    "application/vnd.google-earth.kml+xml",
  );
});

// ---------- Whole-folder import (all photos in one go) ----------

// Folder selection needs webkitdirectory support (Chrome, Edge, Safari,
// Firefox; on phones it opens the system file manager, so e.g. the whole
// camera folder can be imported at once).
if (!("webkitdirectory" in folderInput)) {
  folderPicker.hidden = true;
}

folderInput.addEventListener("change", () => {
  // A folder brings everything it contains — keep only image files.
  const files = Array.from(folderInput.files ?? []).filter(isImageFile);
  folderInput.value = "";
  void processFiles(files);
});

// ---------- Google Drive import (feature-flagged) ----------

// Loaded on demand: with the flag off, no Drive code enters the bundle.
if (isFeatureEnabled("googleDrive")) {
  void import("./features/drive-import").then(({ initDriveImport }) => {
    initDriveImport(byId("drive-button", HTMLButtonElement), { processFiles });
  });
}

// ---------- Drag & drop onto the map ----------

function dragHasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

let dragDepth = 0;

window.addEventListener("dragenter", (event) => {
  if (!dragHasFiles(event)) return;
  event.preventDefault();
  dragDepth += 1;
  dropOverlay.hidden = false;
});

window.addEventListener("dragover", (event) => {
  if (!dragHasFiles(event)) return;
  event.preventDefault();
});

window.addEventListener("dragleave", (event) => {
  if (!dragHasFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropOverlay.hidden = true;
});

window.addEventListener("drop", (event) => {
  if (!dragHasFiles(event)) return;
  event.preventDefault();
  dragDepth = 0;
  dropOverlay.hidden = true;
  const files = Array.from(event.dataTransfer?.files ?? []).filter(isImageFile);
  void processFiles(files);
});
