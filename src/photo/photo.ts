export interface GpsCoords {
  lat: number;
  lon: number;
}

export interface ExifGps {
  latitude?: number;
  longitude?: number;
}

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".avif",
];

export function isImageFile(file: { type: string; name: string }): boolean {
  if (file.type.startsWith("image/")) return true;
  if (file.type !== "") return false;
  // Files dragged from the OS (notably HEIC) often carry no MIME type.
  const name = file.name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function toCoords(gps: ExifGps | null | undefined): GpsCoords | null {
  if (!gps) return null;
  const { latitude, longitude } = gps;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  // Cameras write (0, 0) when the fix was missing — treat as no data.
  if (latitude === 0 && longitude === 0) return null;
  return { lat: latitude, lon: longitude };
}

/**
 * One app-wide locale for dates and month names, set from the settings
 * panel ("auto" → undefined → the browser's locale).
 */
let dateLocale: string | undefined;

export function setDateLocale(locale: string | undefined): void {
  dateLocale = locale;
}

export function getDateLocale(): string | undefined {
  return dateLocale;
}

/** Formats an EXIF capture timestamp for display. */
export function formatTakenAt(takenAt: number): string {
  return new Intl.DateTimeFormat(dateLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(takenAt));
}
