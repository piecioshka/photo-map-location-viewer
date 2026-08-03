import { describe, expect, test } from "vitest";
import { isImageFile, toCoords } from "./photo";

describe("toCoords", () => {
  test("maps exifr gps output to coords", () => {
    expect(toCoords({ latitude: 52.2297, longitude: 21.0122 })).toEqual({
      lat: 52.2297,
      lon: 21.0122,
    });
  });

  test("keeps negative (southern/western) coordinates", () => {
    expect(toCoords({ latitude: -33.8688, longitude: -70.6483 })).toEqual({
      lat: -33.8688,
      lon: -70.6483,
    });
  });

  test("returns null for undefined input", () => {
    expect(toCoords(undefined)).toBeNull();
  });

  test("returns null when a coordinate is missing", () => {
    expect(toCoords({ latitude: 52.2297 })).toBeNull();
  });

  test("returns null for NaN coordinates", () => {
    expect(toCoords({ latitude: NaN, longitude: 21.0122 })).toBeNull();
  });

  test("returns null for out-of-range coordinates", () => {
    expect(toCoords({ latitude: 91, longitude: 21 })).toBeNull();
    expect(toCoords({ latitude: 52, longitude: 181 })).toBeNull();
  });

  test("returns null for (0, 0) — null island means missing data", () => {
    expect(toCoords({ latitude: 0, longitude: 0 })).toBeNull();
  });
});

describe("isImageFile", () => {
  test("accepts files with an image MIME type", () => {
    expect(isImageFile({ type: "image/jpeg", name: "a.jpg" })).toBe(true);
    expect(isImageFile({ type: "image/png", name: "b.png" })).toBe(true);
    expect(isImageFile({ type: "image/heic", name: "c.heic" })).toBe(true);
  });

  test("accepts image extensions when the MIME type is empty", () => {
    // HEIC dragged from Finder often has no MIME type
    expect(isImageFile({ type: "", name: "IMG_0001.HEIC" })).toBe(true);
    expect(isImageFile({ type: "", name: "photo.jpeg" })).toBe(true);
    expect(isImageFile({ type: "", name: "scan.tiff" })).toBe(true);
  });

  test("rejects non-image files", () => {
    expect(isImageFile({ type: "text/plain", name: "notes.txt" })).toBe(false);
    expect(isImageFile({ type: "application/pdf", name: "doc.pdf" })).toBe(
      false,
    );
    expect(isImageFile({ type: "", name: "archive.zip" })).toBe(false);
  });
});
