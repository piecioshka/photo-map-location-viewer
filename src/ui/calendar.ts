import { getDateLocale, type GpsCoords } from "../photo/photo";
import { photoCount } from "../services/i18n";
import { byId } from "./dom";

const container = byId("calendar", HTMLElement);
const title = byId("calendar-title", HTMLElement);
const grid = byId("calendar-grid", HTMLElement);
const prev = byId("calendar-prev", HTMLElement);
const next = byId("calendar-next", HTMLElement);

export interface CalendarPhoto {
  takenAt: number;
  coords: GpsCoords | null;
}

const photos: CalendarPhoto[] = [];
let enabled = true;
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let userNavigated = false;
let onDaySelect: (dayPhotos: CalendarPhoto[]) => void = () => {};

prev.addEventListener("click", () => shiftMonth(-1));
next.addEventListener("click", () => shiftMonth(1));

function shiftMonth(delta: number): void {
  userNavigated = true;
  viewMonth += delta;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear -= 1;
  } else if (viewMonth > 11) {
    viewMonth = 0;
    viewYear += 1;
  }
  render();
}

export function initCalendar(
  handler: (dayPhotos: CalendarPhoto[]) => void,
): void {
  onDaySelect = handler;
}

export function setCalendarEnabled(value: boolean): void {
  enabled = value;
  render();
}

export interface CalendarPhotoHandle {
  remove(): void;
}

export function addCalendarPhoto(photo: CalendarPhoto): CalendarPhotoHandle {
  photos.push(photo);
  if (!userNavigated) {
    const latest = new Date(Math.max(...photos.map((entry) => entry.takenAt)));
    viewYear = latest.getFullYear();
    viewMonth = latest.getMonth();
  }
  render();
  return {
    remove() {
      const index = photos.indexOf(photo);
      if (index !== -1) photos.splice(index, 1);
      render();
    },
  };
}

export function clearCalendar(): void {
  photos.length = 0;
  userNavigated = false;
  render();
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
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

/** "17 June 2026" — spoken label for a day cell. */
function fullDate(year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat(getDateLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, day));
}

function renderNow(): void {
  container.hidden = !enabled || photos.length === 0;
  if (container.hidden) return;

  const locale = getDateLocale();
  title.textContent = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(viewYear, viewMonth, 1));

  const byDay = new Map<string, CalendarPhoto[]>();
  for (const photo of photos) {
    const key = dayKey(new Date(photo.takenAt));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(photo);
    else byDay.set(key, [photo]);
  }

  grid.textContent = "";

  // Monday-first weekday header
  const weekdayFormat = new Intl.DateTimeFormat(locale, {
    weekday: "narrow",
  });
  for (let i = 0; i < 7; i += 1) {
    const cell = document.createElement("span");
    cell.className = "calendar__weekday";
    // 2026-06-01 is a Monday
    cell.textContent = weekdayFormat.format(new Date(2026, 5, 1 + i));
    grid.appendChild(cell);
  }

  const firstDay = new Date(viewYear, viewMonth, 1);
  const offset = (firstDay.getDay() + 6) % 7; // Monday-first
  for (let i = 0; i < offset; i += 1) {
    grid.appendChild(document.createElement("span"));
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dayKey(new Date(viewYear, viewMonth, day));
    const dayPhotos = byDay.get(key);
    if (dayPhotos) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "calendar__day calendar__day--has";
      cell.textContent = String(day);
      const label = `${fullDate(viewYear, viewMonth, day)} — ${photoCount(dayPhotos.length)}`;
      cell.title = label;
      cell.setAttribute("aria-label", label);
      cell.addEventListener("click", () => onDaySelect(dayPhotos));
      grid.appendChild(cell);
    } else {
      const cell = document.createElement("span");
      cell.className = "calendar__day";
      cell.textContent = String(day);
      grid.appendChild(cell);
    }
  }
}
