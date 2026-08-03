import { expect, test } from "@playwright/test";
import {
  makeJpegWithGps,
  makeJpegWithoutGps,
} from "../src/test-utils/jpeg-fixture";

/**
 * End-to-end smoke: add photos → markers, grouped list, timeline and
 * calendar appear → reload → the whole session is restored from storage.
 * External requests (tiles, geocoding) are blocked so the run is
 * deterministic and offline-friendly.
 */

const FIXTURES = [
  {
    name: "warsaw.jpg",
    buffer: makeJpegWithGps(52.2297, 21.0122, "2026:07:01 10:00:00"),
  },
  {
    name: "krakow.jpg",
    buffer: makeJpegWithGps(50.0614, 19.9366, "2026:07:03 12:00:00"),
  },
  {
    name: "gdansk.jpg",
    buffer: makeJpegWithGps(54.352, 18.6466, "2026:07:05 14:00:00"),
  },
  { name: "no-gps.jpg", buffer: makeJpegWithoutGps() },
];

test.beforeEach(async ({ page }) => {
  // Determinism: no tiles, no geocoding, no search backends.
  await page.route(
    /tile\.openstreetmap\.org|arcgisonline|opentopomap|bigdatacloud|photon\.komoot|accounts\.google/,
    (route) => route.abort(),
  );
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase("photo-map");
  });
  await page.reload();
});

test("import, widgets and restore after reload", async ({ page }) => {
  await expect(page.locator("#empty-state")).toBeVisible();

  await page.locator("#file-input").setInputFiles(
    FIXTURES.map((f) => ({
      name: f.name,
      mimeType: "image/jpeg",
      buffer: Buffer.from(f.buffer),
    })),
  );

  // Counter and list
  await expect(page.locator("#counter")).toHaveText("3/4 on map");
  await expect(page.locator("#photos")).toBeVisible();
  await expect(page.locator(".sheet__row")).toHaveCount(4);

  // Geocoding is blocked, so located photos group under "On the map"
  const groups = page.locator(".sheet__group-name");
  await expect(groups).toHaveText(["On the map", "No location"]);

  // Markers on the map (cluster or individual prints)
  const markers = await page.locator(".photo-marker, .marker-cluster").count();
  expect(markers).toBeGreaterThan(0);

  // Timeline: 3 dated photos across 3 days
  await expect(page.locator(".timeline__cell")).toHaveCount(3);
  await expect(page.locator(".timeline__day-label")).toHaveCount(3);

  // Calendar: month of the latest photo with 3 highlighted days
  await expect(page.locator("#calendar")).toBeVisible();
  await expect(page.locator(".calendar__day--has")).toHaveCount(3);

  // Reload → everything restored from localStorage + IndexedDB
  await page.reload();
  await expect(page.locator("#counter")).toHaveText("3/4 on map");
  await expect(page.locator(".sheet__row")).toHaveCount(4);
  await expect(page.locator(".timeline__cell")).toHaveCount(3);
  await expect(page.locator(".calendar__day--has")).toHaveCount(3);
  await expect(page.locator("#empty-state")).toBeHidden();

  // Thumbnails restored from IndexedDB (no placeholder camera icons)
  await expect(page.locator(".sheet__thumb--placeholder")).toHaveCount(0);

  // Removing a single photo updates the list, counter and storage
  await page
    .locator(".sheet__item", { hasText: "no-gps.jpg" })
    .locator(".sheet__remove")
    .click();
  await expect(page.locator(".sheet__row")).toHaveCount(3);
  await expect(page.locator("#counter")).toHaveText("3/3 on map");
  const storedCount = await page.evaluate(
    () => JSON.parse(localStorage.getItem("photo-map:photos") ?? "[]").length,
  );
  expect(storedCount).toBe(3);
});

test("new session clears everything after confirmation", async ({ page }) => {
  await page.locator("#file-input").setInputFiles([
    {
      name: "warsaw.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(FIXTURES[0].buffer),
    },
  ]);
  await expect(page.locator(".sheet__row")).toHaveCount(1);

  await page.locator("#clear-photos").click();
  await page.locator("#new-session-confirm").click();

  await expect(page.locator("#empty-state")).toBeVisible();
  await expect(page.locator("#photos")).toBeHidden();
  const stored = await page.evaluate(() =>
    localStorage.getItem("photo-map:photos"),
  );
  expect(stored).toBeNull();
});
