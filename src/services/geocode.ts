import type { GpsCoords } from "../photo/photo";

/**
 * Reverse geocoding of photo coordinates to a city name via the free
 * BigDataCloud client API (made for browser use, CORS-enabled, no key).
 * Only coordinates are sent — never the photos. Requests are lightly
 * throttled and cached per ~1 km grid cell, so a burst of photos from
 * one place costs one request.
 */

const REQUEST_SPACING_MS = 300;

const cache = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();

export function reverseCity(coords: GpsCoords): Promise<string | null> {
  const key = cellKey(coords);
  const hit = cache.get(key);
  if (hit) return hit;
  const result = enqueue(() => lookup(coords));
  cache.set(key, result);
  return result;
}

function cellKey({ lat, lon }: GpsCoords): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.then(
    () => sleep(REQUEST_SPACING_MS),
    () => sleep(REQUEST_SPACING_MS),
  );
  return run;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function lookup(coords: GpsCoords): Promise<string | null> {
  try {
    const url = new URL(
      "https://api.bigdatacloud.net/data/reverse-geocode-client",
    );
    url.searchParams.set("latitude", String(coords.lat));
    url.searchParams.set("longitude", String(coords.lon));
    url.searchParams.set("localityLanguage", "en");
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    return extractCity(await response.json());
  } catch {
    return null;
  }
}

const CITY_KEYS = ["city", "locality", "principalSubdivision", "countryName"];

/** Picks the most city-like part of a BigDataCloud reverse response. */
export function extractCity(data: unknown): string | null {
  if (!(data instanceof Object)) return null;
  for (const key of CITY_KEYS) {
    const value: unknown = Reflect.get(data, key);
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}
