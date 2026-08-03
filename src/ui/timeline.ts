import { formatTakenAt, getDateLocale } from "../photo/photo";
import { byId } from "./dom";

const container = byId("timeline", HTMLElement);
const track = byId("timeline-track", HTMLElement);

export interface TimelineEntry {
  name: string;
  /** EXIF capture time (epoch ms) — position on the axis. */
  takenAt: number;
  thumbUrl: string | null;
  /** Present when the photo has a marker; click focuses it. */
  onSelect?: () => void;
}

const entries: TimelineEntry[] = [];
let enabled = true;

export function setTimelineEnabled(value: boolean): void {
  enabled = value;
  render();
}

export interface TimelineEntryHandle {
  remove(): void;
}

export function addTimelineEntry(entry: TimelineEntry): TimelineEntryHandle {
  entries.push(entry);
  render();
  return {
    remove() {
      const index = entries.indexOf(entry);
      if (index !== -1) entries.splice(index, 1);
      render();
    },
  };
}

export function clearTimeline(): void {
  entries.length = 0;
  render();
}

let renderQueued = false;

/** Coalesces renders: one DOM rebuild per frame even for big batches. */
function render(): void {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderNow();
  });
}

function renderNow(): void {
  track.textContent = "";
  const sorted = [...entries].sort((a, b) => a.takenAt - b.takenAt);

  let photos: HTMLElement | null = null;
  let lastDay = "";
  for (const entry of sorted) {
    const day = new Date(entry.takenAt).toDateString();
    if (day !== lastDay || !photos) {
      lastDay = day;
      const group = document.createElement("li");
      group.className = "timeline__group";
      const label = document.createElement("span");
      label.className = "timeline__day-label";
      label.textContent = new Intl.DateTimeFormat(getDateLocale(), {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(entry.takenAt));
      group.appendChild(label);
      photos = document.createElement("ul");
      photos.className = "timeline__photos";
      group.appendChild(photos);
      track.appendChild(group);
    }
    photos.appendChild(buildItem(entry));
  }
  container.hidden = !enabled || entries.length === 0;
}

function buildItem(entry: TimelineEntry): HTMLElement {
  const item = document.createElement("li");
  item.className = "timeline__item";

  const cell = document.createElement(entry.onSelect ? "button" : "div");
  cell.className = "timeline__cell";
  const cellLabel = `${entry.name} — ${formatTakenAt(entry.takenAt)}`;
  cell.title = cellLabel;
  cell.setAttribute("aria-label", cellLabel);
  if (entry.onSelect && cell instanceof HTMLButtonElement) {
    cell.type = "button";
    cell.addEventListener("click", entry.onSelect);
  }

  if (entry.thumbUrl) {
    const img = document.createElement("img");
    img.className = "timeline__thumb";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = entry.thumbUrl;
    img.alt = "";
    cell.appendChild(img);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "timeline__thumb timeline__thumb--placeholder";
    placeholder.textContent = "📷";
    placeholder.setAttribute("aria-hidden", "true");
    cell.appendChild(placeholder);
  }

  const label = document.createElement("span");
  label.className = "timeline__label";
  label.textContent = new Intl.DateTimeFormat(getDateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(entry.takenAt));
  cell.appendChild(label);

  item.appendChild(cell);
  return item;
}
