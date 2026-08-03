import type { StoredPhoto } from "./storage";

/**
 * Trip export: located photos as points plus a chronological route line.
 * Pure builders (testable) + a small download helper.
 */

interface LocatedStoredPhoto extends StoredPhoto {
  lat: number;
  lon: number;
}

function locatedPhotos(photos: StoredPhoto[]): LocatedStoredPhoto[] {
  return photos.filter(
    (photo): photo is LocatedStoredPhoto =>
      photo.lat !== null && photo.lon !== null,
  );
}

function routeCoordinates(photos: LocatedStoredPhoto[]): [number, number][] {
  return photos
    .filter(
      (photo): photo is LocatedStoredPhoto & { takenAt: number } =>
        photo.takenAt !== null,
    )
    .sort((a, b) => a.takenAt - b.takenAt)
    .map((photo) => [photo.lon, photo.lat]);
}

export function buildGeoJson(photos: StoredPhoto[]): string {
  const located = locatedPhotos(photos);
  const features: object[] = located.map((photo) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [photo.lon, photo.lat] },
    properties: {
      name: photo.name,
      city: photo.city,
      takenAt:
        photo.takenAt !== null ? new Date(photo.takenAt).toISOString() : null,
    },
  }));
  const route = routeCoordinates(located);
  if (route.length >= 2) {
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: route },
      properties: { name: "Travel route" },
    });
  }
  return JSON.stringify({ type: "FeatureCollection", features }, null, 2);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildKml(photos: StoredPhoto[]): string {
  const located = locatedPhotos(photos);
  const placemarks = located.map((photo) => {
    const label = photo.city ? `${photo.name} (${photo.city})` : photo.name;
    const when =
      photo.takenAt !== null
        ? `<TimeStamp><when>${new Date(photo.takenAt).toISOString()}</when></TimeStamp>`
        : "";
    return (
      `<Placemark><name>${escapeXml(label)}</name>${when}` +
      `<Point><coordinates>${photo.lon},${photo.lat}</coordinates></Point></Placemark>`
    );
  });
  const route = routeCoordinates(located);
  if (route.length >= 2) {
    const coords = route.map(([lon, lat]) => `${lon},${lat}`).join(" ");
    placemarks.push(
      `<Placemark><name>Travel route</name>` +
        `<LineString><coordinates>${coords}</coordinates></LineString></Placemark>`,
    );
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>` +
    `<name>Photo Map export</name>${placemarks.join("")}</Document></kml>`
  );
}

export function downloadFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
