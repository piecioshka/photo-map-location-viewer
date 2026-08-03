import { formatTakenAt } from "../photo/photo";
import { t } from "../services/i18n";
import {
  isFeatureKey,
  sanitizeDateLocale,
  type DateLocale,
  type FeatureSettings,
} from "../services/settings";
import { byId } from "./dom";

const counter = byId("counter", HTMLElement);
const emptyState = byId("empty-state", HTMLElement);
const sheet = byId("photos", HTMLElement);
const sheetTitle = byId("sheet-title", HTMLElement);
const hint = byId("photos-hint", HTMLElement);
const list = byId("photo-list", HTMLElement);
const clearButton = byId("clear-photos", HTMLElement);
const settingsToggle = byId("settings-toggle", HTMLElement);
const settingsPanel = byId("settings-panel", HTMLElement);

export function hideEmptyState(): void {
  emptyState.hidden = true;
}

// ---------- Loader (photos still being processed) ----------

const loader = byId("loader", HTMLElement);
const loaderText = byId("loader-text", HTMLElement);

export function showLoader(done: number, total: number): void {
  loaderText.textContent = `${done} / ${total}`;
  loader.hidden = false;
}

export function hideLoader(): void {
  loader.hidden = true;
}

// ---------- Toast (transient notices) ----------

const toast = byId("toast", HTMLElement);
let toastTimer: number | undefined;

export function showToast(message: string): void {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 6000);
}

export function updateCounter(located: number, unlocated: number): void {
  const total = located + unlocated;
  counter.hidden = total === 0;
  counter.textContent = `${located}/${total} ${t("onMapCounter")}`;
  // removing the last photo brings the empty-state prompt back
  if (total === 0) emptyState.hidden = false;
}

// ---------- Photo list, grouped by place ----------

export interface PhotoEntry {
  name: string;
  thumbUrl: string | null;
  /** EXIF capture time (epoch ms), shown under the file name. */
  takenAt: number | null;
  /** Present when the photo has a marker on the map; called on click. */
  onSelect?: () => void;
  /** Called when the row's remove button is pressed. */
  onRemove?: () => void;
}

export interface PhotoEntryHandle {
  /** Moves the entry into the group of the given city. */
  setCity(city: string): void;
  /** Removes the entry from the list. */
  remove(): void;
}

interface ListedPhoto extends PhotoEntry {
  city: string | null;
}

const ON_MAP_GROUP = "On the map";
const NO_LOCATION_GROUP = "No location";

let cityRenameHandler: (oldCity: string, newCity: string) => void = () => {};

/** Registers the app-level reaction to renaming a city group. */
export function onCityRename(
  handler: (oldCity: string, newCity: string) => void,
): void {
  cityRenameHandler = handler;
}

const photoEntries: ListedPhoto[] = [];
const collapsedGroups = new Set<string>();
let photoListEnabled = true;

export function setPhotoListVisible(enabled: boolean): void {
  photoListEnabled = enabled;
  renderList();
}

export function addPhotoEntry(entry: PhotoEntry): PhotoEntryHandle {
  const record: ListedPhoto = { ...entry, city: null };
  photoEntries.push(record);
  renderList();
  return {
    setCity(city: string): void {
      record.city = city;
      renderList();
    },
    remove(): void {
      const index = photoEntries.indexOf(record);
      if (index !== -1) photoEntries.splice(index, 1);
      renderList();
    },
  };
}

function groupLabel(photo: ListedPhoto): string {
  if (!photo.onSelect) return NO_LOCATION_GROUP;
  return photo.city ?? ON_MAP_GROUP;
}

let renderListQueued = false;

/** Coalesces renders: one DOM rebuild per frame even for big batches. */
function renderList(): void {
  if (renderListQueued) return;
  renderListQueued = true;
  requestAnimationFrame(() => {
    renderListQueued = false;
    renderListNow();
  });
}

function renderListNow(): void {
  list.textContent = "";

  const groups = new Map<string, ListedPhoto[]>();
  for (const photo of photoEntries) {
    const label = groupLabel(photo);
    const bucket = groups.get(label);
    if (bucket) bucket.push(photo);
    else groups.set(label, [photo]);
  }
  const labels = [...groups.keys()].filter(
    (label) => label !== ON_MAP_GROUP && label !== NO_LOCATION_GROUP,
  );
  if (groups.has(ON_MAP_GROUP)) labels.push(ON_MAP_GROUP);
  if (groups.has(NO_LOCATION_GROUP)) labels.push(NO_LOCATION_GROUP);
  const visits = cityVisitNumbers();
  for (const label of labels) {
    const photos = groups.get(label)!;
    const collapsed = collapsedGroups.has(label);
    list.appendChild(
      buildGroupHeader(label, photos.length, collapsed, visits.get(label)),
    );
    if (collapsed) continue;
    for (const photo of photos) list.appendChild(buildItem(photo));
  }

  hint.hidden = !photoEntries.some((photo) => !photo.onSelect);
  clearButton.hidden = photoEntries.length === 0;
  sheetTitle.textContent =
    photoEntries.length === 0
      ? t("photos")
      : `${t("photos")} (${photoEntries.length})`;
  sheet.hidden = !photoListEnabled || photoEntries.length === 0;
}

/**
 * Mirrors the numbering of route-view flags: cities ordered by their
 * earliest photo; dated photos without a city reserve a number too.
 */
function cityVisitNumbers(): Map<string, number> {
  const dated = photoEntries
    .filter(
      (photo): photo is ListedPhoto & { takenAt: number } =>
        photo.takenAt !== null && !!photo.onSelect,
    )
    .sort((a, b) => a.takenAt - b.takenAt);
  const order = new Map<string, number>();
  let counter = 0;
  for (const photo of dated) {
    if (photo.city) {
      if (!order.has(photo.city)) {
        counter += 1;
        order.set(photo.city, counter);
      }
    } else {
      counter += 1;
    }
  }
  return order;
}

function buildGroupHeader(
  label: string,
  count: number,
  collapsed: boolean,
  visitNumber?: number,
): HTMLElement {
  const item = document.createElement("li");
  item.className = "sheet__group";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "sheet__group-toggle";
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.addEventListener("click", () => {
    if (collapsedGroups.has(label)) collapsedGroups.delete(label);
    else collapsedGroups.add(label);
    renderList();
  });
  const chevron = document.createElement("span");
  chevron.className = "sheet__group-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "⌃";
  toggle.appendChild(chevron);
  if (visitNumber !== undefined) {
    const num = document.createElement("span");
    num.className = "route-flag__num";
    num.textContent = String(visitNumber);
    num.title = `${t("visitedAsStop")} ${visitNumber}`;
    toggle.appendChild(num);
  }
  const name = document.createElement("span");
  name.className = "sheet__group-name";
  name.textContent =
    label === ON_MAP_GROUP
      ? t("onTheMap")
      : label === NO_LOCATION_GROUP
        ? t("noLocation")
        : label;
  toggle.appendChild(name);
  const badge = document.createElement("span");
  badge.className = "sheet__badge";
  badge.textContent = String(count);
  toggle.appendChild(badge);
  item.appendChild(toggle);

  // Geocoding is sometimes off — city groups can be renamed by hand
  if (label !== ON_MAP_GROUP && label !== NO_LOCATION_GROUP) {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "sheet__group-edit-btn";
    edit.title = t("renamePlace");
    edit.setAttribute("aria-label", `${t("renamePlace")}: ${label}`);
    edit.textContent = "✎";
    edit.addEventListener("click", () => startCityRename(item, label));
    item.appendChild(edit);
  }
  return item;
}

function startCityRename(item: HTMLElement, label: string): void {
  item.textContent = "";
  const input = document.createElement("input");
  input.className = "sheet__group-input";
  input.value = label;
  input.setAttribute("aria-label", t("newPlaceName"));
  const commit = (): void => {
    const next = input.value.trim();
    if (next && next !== label) {
      for (const photo of photoEntries) {
        if (photo.city === label) photo.city = next;
      }
      cityRenameHandler(label, next);
    }
    renderList();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") input.blur();
    if (event.key === "Escape") {
      input.removeEventListener("blur", commit);
      renderList();
    }
  });
  input.addEventListener("blur", commit);
  item.appendChild(input);
  input.focus();
  input.select();
}

function buildItem(photo: ListedPhoto): HTMLElement {
  const item = document.createElement("li");
  item.className = "sheet__item";

  const row = document.createElement(photo.onSelect ? "button" : "div");
  row.className = "sheet__row";

  if (photo.thumbUrl) {
    const img = document.createElement("img");
    img.className = "sheet__thumb";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = photo.thumbUrl;
    img.alt = "";
    row.appendChild(img);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "sheet__thumb sheet__thumb--placeholder";
    placeholder.textContent = "📷";
    placeholder.setAttribute("aria-hidden", "true");
    row.appendChild(placeholder);
  }

  const meta = document.createElement("span");
  meta.className = "sheet__meta";
  const label = document.createElement("span");
  label.className = "sheet__name";
  label.textContent = photo.name;
  meta.appendChild(label);
  if (photo.takenAt !== null) {
    const date = document.createElement("span");
    date.className = "sheet__date";
    date.textContent = formatTakenAt(photo.takenAt);
    meta.appendChild(date);
  }
  row.appendChild(meta);

  const onSelect = photo.onSelect;
  if (onSelect && row instanceof HTMLButtonElement) {
    row.type = "button";
    row.addEventListener("click", onSelect);
  }

  item.appendChild(row);

  const onRemove = photo.onRemove;
  if (onRemove) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "sheet__remove";
    remove.title = t("removePhoto");
    remove.setAttribute("aria-label", `${t("removePhoto")}: ${photo.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", onRemove);
    item.appendChild(remove);
  }

  return item;
}

export function resetPhotoList(): void {
  photoEntries.length = 0;
  collapsedGroups.clear();
  renderList();
  emptyState.hidden = false;
}

const newSessionDialog = byId("new-session-dialog", HTMLDialogElement);
const newSessionCancel = byId("new-session-cancel", HTMLElement);
const newSessionConfirm = byId("new-session-confirm", HTMLElement);

// ---------- Privacy dialog ----------

const privacyDialog = document.getElementById("privacy-dialog");
const privacyOpen = document.getElementById("privacy-open");
const privacyClose = document.getElementById("privacy-close");

if (privacyDialog instanceof HTMLDialogElement && privacyOpen && privacyClose) {
  privacyOpen.addEventListener("click", () => privacyDialog.showModal());
  privacyClose.addEventListener("click", () => privacyDialog.close());
}

export function onClearPhotos(handler: () => void): void {
  clearButton.addEventListener("click", () => newSessionDialog.showModal());
  newSessionCancel.addEventListener("click", () => newSessionDialog.close());
  // Clicking the backdrop (outside the dialog box) also cancels.
  newSessionDialog.addEventListener("click", (event) => {
    if (event.target === newSessionDialog) newSessionDialog.close();
  });
  newSessionConfirm.addEventListener("click", () => {
    newSessionDialog.close();
    handler();
  });
}

// ---------- Settings panel ----------

export function initSettingsPanel(
  initial: FeatureSettings,
  onChange: (features: FeatureSettings) => void,
  routeColor: string,
  onRouteColorChange: (color: string) => void,
  dateLocale: DateLocale,
  onDateLocaleChange: (locale: DateLocale) => void,
): void {
  const current = { ...initial };
  const inputs = settingsPanel.querySelectorAll<HTMLInputElement>(
    "input[data-feature]",
  );
  inputs.forEach((input) => {
    const key = input.dataset.feature;
    if (!isFeatureKey(key)) return;
    input.checked = current[key];
    input.addEventListener("change", () => {
      current[key] = input.checked;
      onChange({ ...current });
    });
  });

  const colorInput = document.getElementById("accent-color");
  if (colorInput instanceof HTMLInputElement) {
    colorInput.value = routeColor;
    colorInput.addEventListener("input", () => {
      onRouteColorChange(colorInput.value);
    });
  }

  const localeSelect = document.getElementById("date-locale");
  if (localeSelect instanceof HTMLSelectElement) {
    localeSelect.value = dateLocale;
    localeSelect.addEventListener("change", () => {
      onDateLocaleChange(sanitizeDateLocale(localeSelect.value));
    });
  }

  function closePanel(): void {
    settingsPanel.hidden = true;
    settingsToggle.setAttribute("aria-expanded", "false");
  }

  settingsToggle.addEventListener("click", () => {
    const open = settingsPanel.hidden;
    settingsPanel.hidden = !open;
    settingsToggle.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", (event) => {
    if (settingsPanel.hidden) return;
    const target = event.target;
    if (
      target instanceof Node &&
      (settingsPanel.contains(target) || settingsToggle.contains(target))
    ) {
      return;
    }
    closePanel();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !settingsPanel.hidden) closePanel();
  });
}
