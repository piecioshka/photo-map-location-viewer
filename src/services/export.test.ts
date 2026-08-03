import { describe, expect, test } from "vitest";
import { buildGeoJson, buildKml } from "./export";
import type { StoredPhoto } from "./storage";

const PHOTOS: StoredPhoto[] = [
  {
    id: "a",
    name: "warsaw.jpg",
    lat: 52.2297,
    lon: 21.0122,
    takenAt: Date.UTC(2026, 6, 1, 10),
    city: "Warsaw",
  },
  {
    id: "b",
    name: "krakow.jpg",
    lat: 50.0614,
    lon: 19.9366,
    takenAt: Date.UTC(2026, 6, 3, 12),
    city: "Krakow",
  },
  {
    id: "c",
    name: "no-gps.jpg",
    lat: null,
    lon: null,
    takenAt: null,
    city: null,
  },
];

describe("buildGeoJson", () => {
  test("exports located photos as points and a chronological route", () => {
    const parsed = JSON.parse(buildGeoJson(PHOTOS));
    expect(parsed.type).toBe("FeatureCollection");
    expect(parsed.features).toHaveLength(3); // 2 points + route
    const [warsaw, , route] = parsed.features;
    expect(warsaw.geometry.coordinates).toEqual([21.0122, 52.2297]);
    expect(warsaw.properties.city).toBe("Warsaw");
    expect(warsaw.properties.takenAt).toBe("2026-07-01T10:00:00.000Z");
    expect(route.geometry.type).toBe("LineString");
    expect(route.geometry.coordinates).toEqual([
      [21.0122, 52.2297],
      [19.9366, 50.0614],
    ]);
  });

  test("skips the route with fewer than two dated photos", () => {
    const parsed = JSON.parse(buildGeoJson([PHOTOS[0], PHOTOS[2]]));
    expect(parsed.features).toHaveLength(1);
  });
});

describe("buildKml", () => {
  test("produces valid placemarks with escaped names", () => {
    const kml = buildKml([
      { ...PHOTOS[0], name: 'we <3 "kml" & maps.jpg', city: null },
      PHOTOS[1],
    ]);
    expect(kml).toContain("we &lt;3 &quot;kml&quot; &amp; maps.jpg");
    expect(kml).toContain("<coordinates>21.0122,52.2297</coordinates>");
    expect(kml).toContain("<LineString>");
  });
});
