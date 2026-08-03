import { describe, expect, test } from "vitest";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_FEATURES,
  isFeatureKey,
  sanitizeFeatures,
  sanitizeAccentColor,
} from "./settings";
import { sanitizeStoredPhotos } from "./storage";
import { extractCity } from "./geocode";
import { sanitizeDateLocale } from "./settings";
import { formatTakenAt, setDateLocale } from "../photo/photo";

describe("sanitizeFeatures", () => {
  test("returns defaults for garbage input", () => {
    expect(sanitizeFeatures(null)).toEqual(DEFAULT_FEATURES);
    expect(sanitizeFeatures("x")).toEqual(DEFAULT_FEATURES);
    expect(sanitizeFeatures(42)).toEqual(DEFAULT_FEATURES);
  });

  test("keeps known boolean overrides, drops the rest", () => {
    const out = sanitizeFeatures({
      dark: true,
      timeline: false,
      route: "yes",
      bogus: true,
    });
    expect(out.dark).toBe(true);
    expect(out.timeline).toBe(false);
    expect(out.route).toBe(DEFAULT_FEATURES.route);
    expect(Reflect.get(out, "bogus")).toBeUndefined();
  });
});

describe("isFeatureKey", () => {
  test("accepts known keys and rejects others", () => {
    expect(isFeatureKey("dark")).toBe(true);
    expect(isFeatureKey("scale")).toBe(false);
    expect(isFeatureKey("bogus")).toBe(false);
    expect(isFeatureKey(undefined)).toBe(false);
  });
});

describe("sanitizeAccentColor", () => {
  test("keeps valid hex colors, falls back otherwise", () => {
    expect(sanitizeAccentColor("#2266cc")).toBe("#2266cc");
    expect(sanitizeAccentColor("#GGGGGG")).toBe(DEFAULT_ACCENT_COLOR);
    expect(sanitizeAccentColor("red")).toBe(DEFAULT_ACCENT_COLOR);
    expect(sanitizeAccentColor(null)).toBe(DEFAULT_ACCENT_COLOR);
  });
});

describe("sanitizeStoredPhotos", () => {
  test("returns empty list for garbage input", () => {
    expect(sanitizeStoredPhotos(null)).toEqual([]);
    expect(sanitizeStoredPhotos({})).toEqual([]);
  });

  test("keeps valid entries, coerces broken fields, drops entries without id", () => {
    const out = sanitizeStoredPhotos([
      {
        id: "id-a",
        name: "a.jpg",
        lat: 52.1,
        lon: 21.2,
        takenAt: 123,
        city: "Warsaw",
      },
      { id: "id-b", name: "b.jpg", lat: "oops", lon: 21.2, takenAt: null },
      { name: "", lat: 1, lon: 2, takenAt: 3 },
      "junk",
      { name: "c.jpg", lat: null, lon: 5, takenAt: Infinity, city: "" },
    ]);
    expect(out).toEqual([
      {
        id: "id-a",
        name: "a.jpg",
        lat: 52.1,
        lon: 21.2,
        takenAt: 123,
        city: "Warsaw",
      },
      {
        id: "id-b",
        name: "b.jpg",
        lat: null,
        lon: null,
        takenAt: null,
        city: null,
      },
    ]);
  });
});

describe("extractCity", () => {
  test("prefers city over broader areas", () => {
    expect(
      extractCity({
        city: "Warszawa",
        principalSubdivision: "Mazowieckie",
        countryName: "Poland",
      }),
    ).toBe("Warszawa");
  });

  test("falls back through locality/subdivision/country", () => {
    expect(extractCity({ city: "", locality: "Chochołów" })).toBe("Chochołów");
    expect(extractCity({ city: "", principalSubdivision: "Kentucky" })).toBe(
      "Kentucky",
    );
    expect(extractCity({ countryName: "Poland" })).toBe("Poland");
  });

  test("returns null for missing data", () => {
    expect(extractCity({})).toBeNull();
    expect(extractCity(null)).toBeNull();
    expect(extractCity({ city: "", locality: " " })).toBeNull();
  });
});

describe("formatTakenAt", () => {
  const ts = Date.UTC(2026, 6, 1, 10, 30);

  test("follows the app-wide date locale", () => {
    setDateLocale("pl-PL");
    expect(formatTakenAt(ts)).toContain("lip"); // Polish month abbreviation
    setDateLocale("en-US");
    expect(formatTakenAt(ts)).toContain("Jul");
    setDateLocale(undefined);
    expect(typeof formatTakenAt(ts)).toBe("string");
  });
});

describe("sanitizeDateLocale", () => {
  test("keeps known locales, falls back to auto", () => {
    expect(sanitizeDateLocale("pl-PL")).toBe("pl-PL");
    expect(sanitizeDateLocale("en-GB")).toBe("en-GB");
    expect(sanitizeDateLocale("de-DE")).toBe("auto");
    expect(sanitizeDateLocale("xx-XX")).toBe("auto");
    expect(sanitizeDateLocale(null)).toBe("auto");
  });
});
