import { toCoords, type ExifGps, type GpsCoords } from "./photo";

// exifr is only needed once the user adds photos — loading it lazily
// keeps it out of the initial bundle (Lighthouse: unused JavaScript).
async function loadExifr(): Promise<typeof import("exifr").default> {
  return (await import("exifr")).default;
}

/**
 * Reads GPS coordinates from an image file. Never throws — corrupted or
 * non-image files simply yield null.
 */
export async function readGps(
  input: Blob | ArrayBuffer | Uint8Array,
): Promise<GpsCoords | null> {
  try {
    const exifr = await loadExifr();
    const gps: ExifGps | null | undefined = await exifr.gps(input);
    return toCoords(gps);
  } catch {
    return null;
  }
}

/**
 * Reads the capture time (DateTimeOriginal, falling back to CreateDate)
 * as an epoch-ms timestamp. Never throws — missing or unparsable dates
 * yield null.
 */
export async function readTakenAt(
  input: Blob | ArrayBuffer | Uint8Array,
): Promise<number | null> {
  try {
    const exifr = await loadExifr();
    const tags: unknown = await exifr.parse(input, {
      pick: ["DateTimeOriginal", "CreateDate"],
    });
    if (!(tags instanceof Object)) return null;
    const raw: unknown =
      Reflect.get(tags, "DateTimeOriginal") ?? Reflect.get(tags, "CreateDate");
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      return raw.getTime();
    }
    return null;
  } catch {
    return null;
  }
}
