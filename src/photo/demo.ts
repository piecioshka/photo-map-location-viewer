import { buildExifApp1, injectExif } from "./exif-writer";

/**
 * Demo photos generated entirely in the browser: a colourful canvas
 * "postcard" per stop with real EXIF GPS + capture time spliced in, so
 * the whole pipeline (map, grouping, timeline, calendar, route) lights
 * up without the user hunting for geotagged files.
 */

interface DemoStop {
  city: string;
  emoji: string;
  lat: number;
  lon: number;
  takenAt: string;
  hue: number;
}

const DEMO_STOPS: DemoStop[] = [
  {
    city: "Lisbon",
    emoji: "🚋",
    lat: 38.7223,
    lon: -9.1393,
    takenAt: "2026:06:12 09:15:00",
    hue: 205,
  },
  {
    city: "Lisbon",
    emoji: "🌉",
    lat: 38.7139,
    lon: -9.1334,
    takenAt: "2026:06:12 18:40:00",
    hue: 220,
  },
  {
    city: "Madrid",
    emoji: "🥘",
    lat: 40.4168,
    lon: -3.7038,
    takenAt: "2026:06:14 13:05:00",
    hue: 35,
  },
  {
    city: "Barcelona",
    emoji: "🏰",
    lat: 41.4036,
    lon: 2.1744,
    takenAt: "2026:06:16 11:20:00",
    hue: 15,
  },
  {
    city: "Barcelona",
    emoji: "🏖️",
    lat: 41.3784,
    lon: 2.1925,
    takenAt: "2026:06:16 17:55:00",
    hue: 45,
  },
  {
    city: "Rome",
    emoji: "🏛️",
    lat: 41.8902,
    lon: 12.4922,
    takenAt: "2026:06:19 10:30:00",
    hue: 90,
  },
  {
    city: "Athens",
    emoji: "🫒",
    lat: 37.9715,
    lon: 23.7267,
    takenAt: "2026:06:21 16:10:00",
    hue: 260,
  },
];

async function makeDemoPhoto(stop: DemoStop, index: number): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");

  const gradient = ctx.createLinearGradient(0, 0, 640, 480);
  gradient.addColorStop(0, `hsl(${stop.hue} 65% 72%)`);
  gradient.addColorStop(1, `hsl(${stop.hue + 40} 60% 45%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 640, 480);

  ctx.font = "160px serif";
  ctx.textAlign = "center";
  ctx.fillText(stop.emoji, 320, 260);

  ctx.fillStyle = "rgb(255 255 255 / 0.9)";
  ctx.font = "700 48px system-ui, sans-serif";
  ctx.fillText(stop.city, 320, 380);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Could not render a demo photo.");

  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const withExif = injectExif(
    jpeg,
    buildExifApp1(stop.lat, stop.lon, stop.takenAt),
  );
  const bytes = new Uint8Array(withExif.length);
  bytes.set(withExif);
  return new File(
    [bytes.buffer],
    `demo-${index + 1}-${stop.city.toLowerCase()}.jpg`,
    { type: "image/jpeg" },
  );
}

export function makeDemoPhotos(): Promise<File[]> {
  return Promise.all(
    DEMO_STOPS.map((stop, index) => makeDemoPhoto(stop, index)),
  );
}
