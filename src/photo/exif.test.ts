import { describe, expect, test } from "vitest";
import { readGps, readTakenAt } from "./exif";
import {
  makeJpegWithGps,
  makeJpegWithoutGps,
} from "../test-utils/jpeg-fixture";

describe("readGps", () => {
  test("reads coordinates from a JPEG with EXIF GPS", async () => {
    const jpeg = makeJpegWithGps(52.2297, 21.0122);
    const coords = await readGps(jpeg);
    expect(coords).not.toBeNull();
    expect(coords!.lat).toBeCloseTo(52.2297, 4);
    expect(coords!.lon).toBeCloseTo(21.0122, 4);
  });

  test("reads southern/western coordinates", async () => {
    const jpeg = makeJpegWithGps(-33.8688, -70.6483);
    const coords = await readGps(jpeg);
    expect(coords).not.toBeNull();
    expect(coords!.lat).toBeCloseTo(-33.8688, 4);
    expect(coords!.lon).toBeCloseTo(-70.6483, 4);
  });

  test("returns null for a JPEG without EXIF", async () => {
    expect(await readGps(makeJpegWithoutGps())).toBeNull();
  });

  test("returns null for a file that is not an image", async () => {
    expect(await readGps(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  test("still reads GPS when the fixture also carries a date", async () => {
    const jpeg = makeJpegWithGps(52.2297, 21.0122, "2026:08:02 10:30:00");
    const coords = await readGps(jpeg);
    expect(coords).not.toBeNull();
    expect(coords!.lat).toBeCloseTo(52.2297, 4);
    expect(coords!.lon).toBeCloseTo(21.0122, 4);
  });
});

describe("readTakenAt", () => {
  test("reads DateTimeOriginal as a timestamp", async () => {
    const jpeg = makeJpegWithGps(52.2297, 21.0122, "2026:08:02 10:30:00");
    const takenAt = await readTakenAt(jpeg);
    expect(takenAt).not.toBeNull();
    const date = new Date(takenAt!);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(2);
    expect(date.getHours()).toBe(10);
    expect(date.getMinutes()).toBe(30);
  });

  test("returns null when there is no EXIF date", async () => {
    expect(await readTakenAt(makeJpegWithGps(52.2297, 21.0122))).toBeNull();
    expect(await readTakenAt(makeJpegWithoutGps())).toBeNull();
  });

  test("returns null for a file that is not an image", async () => {
    expect(await readTakenAt(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});
