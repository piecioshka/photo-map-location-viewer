import { buildExifApp1, injectExif } from "../photo/exif-writer";

/**
 * Builds tiny JPEG fixtures for tests: a valid 1x1 image, optionally with
 * an EXIF APP1 segment carrying GPS coordinates (DMS rationals).
 */

const BASE_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==";

function baseJpeg(): Uint8Array {
  return Uint8Array.from(atob(BASE_JPEG_B64), (c) => c.charCodeAt(0));
}

/** A valid 1x1 JPEG with no EXIF (and therefore no GPS). */
export function makeJpegWithoutGps(): Uint8Array {
  return baseJpeg();
}

/**
 * A valid 1x1 JPEG with an EXIF GPS block for the given coordinates and,
 * optionally, a DateTimeOriginal tag ("YYYY:MM:DD HH:MM:SS").
 */
export function makeJpegWithGps(
  lat: number,
  lon: number,
  takenAt?: string,
): Uint8Array {
  return injectExif(baseJpeg(), buildExifApp1(lat, lon, takenAt));
}
