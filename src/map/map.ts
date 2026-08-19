import "./leaflet-globals";
import L from "leaflet";
import "leaflet.markercluster";
import { geocoder, geocoders } from "leaflet-control-geocoder";
import "leaflet-control-geocoder/dist/Control.Geocoder.css";
import { LocateControl } from "leaflet.locatecontrol";
import "leaflet.locatecontrol/dist/L.Control.Locate.css";
import { formatTakenAt, type GpsCoords } from "../photo/photo";
import type { FeatureSettings } from "../services/settings";
import { t } from "../services/i18n";

export interface PhotoMarkerData {
  coords: GpsCoords;
  thumbUrl: string | null;
  previewUrl: string | null;
  /** Object URL of the untouched original file (null for restored photos). */
  originalUrl: string | null;
  name: string;
  /** EXIF capture time (epoch ms) — feeds the travel-route line. */
  takenAt: number | null;
  /** Reverse-geocoded city (labels the route-view flag). */
  city: string | null;
}

export interface PhotoMarkerHandle {
  focus(): void;
  /** Updates place data once reverse geocoding resolves. */
  setPlace(city: string): void;
  /** Removes the marker and its data point from the map. */
  remove(): void;
}

export interface PhotoMap {
  addPhotoMarker(data: PhotoMarkerData): PhotoMarkerHandle;
  fitAll(): void;
  fitCoords(coordsList: GpsCoords[]): void;
  applyFeatures(features: FeatureSettings): void;
  renameCity(oldCity: string, newCity: string): void;
  setRouteColor(color: string): void;
  setDarkTheme(enabled: boolean): void;
  clearPhotos(): void;
}

const LAYER_STORAGE_KEY = "photo-map:layer";

function buildBaseLayers(): Record<string, L.TileLayer> {
  return {
    Map: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }),
    Satellite: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution:
          'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, Maxar, Earthstar Geographics',
      },
    ),
    Topographic: L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 17,
        attribution:
          'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      },
    ),
  };
}

function savedLayerName(): string | null {
  try {
    return localStorage.getItem(LAYER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function createPhotoMap(container: HTMLElement): PhotoMap {
  const map = L.map(container, { zoomControl: false }).setView([50, 15], 3);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  const baseLayers = buildBaseLayers();
  let activeLayerName = savedLayerName() ?? "Map";
  const initial = baseLayers[activeLayerName] ?? baseLayers.Map;
  initial.addTo(map);
  L.control.layers(baseLayers, undefined, { position: "topright" }).addTo(map);
  map.on("baselayerchange", (event) => {
    activeLayerName = event.name;
    updateTileFilter();
    try {
      localStorage.setItem(LAYER_STORAGE_KEY, event.name);
    } catch {
      // storage unavailable (private mode) — selection just won't persist
    }
  });

  // Always-on controls: place search and my-location. Photon backend —
  // Nominatim throttles browser clients and the search would spin forever.
  geocoder({
    position: "topright",
    defaultMarkGeocode: true,
    placeholder: t("searchPlaces"),
    geocoder: new geocoders.Photon(),
  }).addTo(map);
  new LocateControl({ position: "bottomright" }).addTo(map);

  // Dark theme inverts the raster tiles — except satellite imagery,
  // which would look broken in negative.
  let darkTheme = false;

  function updateTileFilter(): void {
    container.classList.toggle(
      "map--dark",
      darkTheme && activeLayerName !== "Satellite",
    );
  }

  function setDarkTheme(enabled: boolean): void {
    darkTheme = enabled;
    updateTileFilter();
  }

  const cluster = L.markerClusterGroup({
    maxClusterRadius: 48,
    showCoverageOnHover: false,
  });
  map.addLayer(cluster);

  // ---------- Toggleable features ----------

  interface PhotoPoint {
    coords: GpsCoords;
    takenAt: number | null;
    city: string | null;
  }

  const points: PhotoPoint[] = [];

  let routeLine: L.Polyline | undefined;
  let flagsLayer: L.LayerGroup | undefined;

  // Leaflet paints SVG attributes, CSS vars don't reach it
  let routeColor = "#c2481f"; // --accent

  function routeStyle(): L.PolylineOptions {
    return { color: routeColor, weight: 3, opacity: 0.8, dashArray: "6 8" };
  }

  function routeLatLngs(): L.LatLngTuple[] {
    return points
      .filter((p): p is PhotoPoint & { takenAt: number } => p.takenAt !== null)
      .sort((a, b) => a.takenAt - b.takenAt)
      .map((p) => [p.coords.lat, p.coords.lon]);
  }

  let refreshQueued = false;

  // Coalesced: rebuilding flags per added photo would be O(n^2)
  function refreshDataLayers(): void {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      refreshDataLayersNow();
    });
  }

  function refreshDataLayersNow(): void {
    if (routeLine) {
      routeLine.setLatLngs(routeLatLngs());
      routeLine.setStyle(routeStyle());
    }
    if (flagsLayer) {
      flagsLayer.remove();
      flagsLayer = buildFlagsLayer().addTo(map);
    }
  }

  interface FlagStop {
    coords: GpsCoords;
    city: string | null;
    count: number;
  }

  /**
   * One flag per city (anchored at its earliest photo), numbered in the
   * order the city was first visited and counting all of the city's
   * photos. Photos with no resolved city get their own flag.
   */
  function flagStops(): FlagStop[] {
    const cityCounts = new Map<string, number>();
    for (const point of points) {
      if (!point.city) continue;
      cityCounts.set(point.city, (cityCounts.get(point.city) ?? 0) + 1);
    }
    const dated = points
      .filter((p): p is PhotoPoint & { takenAt: number } => p.takenAt !== null)
      .sort((a, b) => a.takenAt - b.takenAt);
    const stops: FlagStop[] = [];
    const seenCities = new Set<string>();
    for (const point of dated) {
      if (point.city) {
        if (seenCities.has(point.city)) continue;
        seenCities.add(point.city);
        stops.push({
          coords: point.coords,
          city: point.city,
          count: cityCounts.get(point.city) ?? 1,
        });
      } else {
        stops.push({ coords: point.coords, city: null, count: 1 });
      }
    }
    return stops;
  }

  function buildFlagsLayer(): L.LayerGroup {
    const group = L.layerGroup();
    flagStops().forEach((stop, index) => {
      const flag = document.createElement("div");
      flag.className = "route-flag";
      const banner = document.createElement("span");
      banner.className = "route-flag__banner";
      const num = document.createElement("span");
      num.className = "route-flag__num";
      num.textContent = String(index + 1);
      banner.appendChild(num);
      if (stop.city) {
        const city = document.createElement("span");
        city.className = "route-flag__city";
        city.textContent = stop.city;
        banner.appendChild(city);
      }
      const count = document.createElement("span");
      count.className = "sheet__badge";
      count.textContent = String(stop.count);
      banner.appendChild(count);
      flag.appendChild(banner);
      const icon = L.divIcon({
        className: "route-flag-wrap",
        html: flag,
        iconSize: [140, 44],
        iconAnchor: [1, 44],
      });
      group.addLayer(L.marker([stop.coords.lat, stop.coords.lon], { icon }));
    });
    return group;
  }

  function applyFeatures(features: FeatureSettings): void {
    if (features.route && !routeLine) {
      routeLine = L.polyline(routeLatLngs(), routeStyle()).addTo(map);
    } else if (!features.route && routeLine) {
      routeLine.remove();
      routeLine = undefined;
    }

    if (features.routeView && !flagsLayer) {
      map.removeLayer(cluster);
      flagsLayer = buildFlagsLayer().addTo(map);
    } else if (!features.routeView && flagsLayer) {
      flagsLayer.remove();
      flagsLayer = undefined;
      map.addLayer(cluster);
    }
  }

  function renameCity(oldCity: string, newCity: string): void {
    for (const point of points) {
      if (point.city === oldCity) point.city = newCity;
    }
    refreshDataLayers();
  }

  function setRouteColor(color: string): void {
    routeColor = color;
    refreshDataLayers();
  }

  function clearPhotos(): void {
    cluster.clearLayers();
    points.length = 0;
    refreshDataLayers();
  }

  function addPhotoMarker(data: PhotoMarkerData): PhotoMarkerHandle {
    const icon = L.divIcon({
      className: "photo-marker",
      html: data.thumbUrl
        ? `<img class="photo-marker__img" src="${data.thumbUrl}" alt="" />`
        : `<span class="photo-marker__placeholder" aria-hidden="true">📷</span>`,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
    });
    const marker = L.marker([data.coords.lat, data.coords.lon], { icon });
    marker.bindPopup(buildPopup(data), { maxWidth: 280 });
    cluster.addLayer(marker);
    const point: PhotoPoint = {
      coords: data.coords,
      takenAt: data.takenAt,
      city: data.city,
    };
    points.push(point);
    refreshDataLayers();
    return {
      focus() {
        if (map.hasLayer(cluster)) {
          cluster.zoomToShowLayer(marker, () => marker.openPopup());
        } else {
          // route view: markers are hidden, so just fly to the spot
          map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 13));
        }
      },
      setPlace(city: string) {
        point.city = city;
        refreshDataLayers();
      },
      remove() {
        cluster.removeLayer(marker);
        const index = points.indexOf(point);
        if (index !== -1) points.splice(index, 1);
        refreshDataLayers();
      },
    };
  }

  function fitAll(): void {
    const bounds = cluster.getBounds();
    if (!bounds.isValid()) return;
    map.fitBounds(bounds.pad(0.2), { maxZoom: 16 });
  }

  function fitCoords(coordsList: GpsCoords[]): void {
    if (coordsList.length === 0) return;
    const bounds = L.latLngBounds(
      coordsList.map((c): L.LatLngTuple => [c.lat, c.lon]),
    );
    map.fitBounds(bounds.pad(0.3), { maxZoom: 15 });
  }

  return {
    addPhotoMarker,
    fitAll,
    fitCoords,
    applyFeatures,
    renameCity,
    setRouteColor,
    setDarkTheme,
    clearPhotos,
  };
}

function buildPopup(data: PhotoMarkerData): HTMLElement {
  const root = document.createElement("div");
  root.className = "photo-popup";
  const frame = document.createElement("div");
  frame.className = "photo-popup__frame";
  if (data.previewUrl) {
    const img = document.createElement("img");
    img.className = "photo-popup__img";
    img.decoding = "async";
    img.src = data.previewUrl;
    img.alt = data.name;
    if (data.originalUrl) {
      // The whole preview opens the original — no separate zoom button.
      const link = document.createElement("a");
      link.className = "photo-popup__open";
      link.href = data.originalUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.title = t("openOriginal");
      link.setAttribute("aria-label", t("openOriginal"));
      link.appendChild(img);
      frame.appendChild(link);
    } else {
      frame.appendChild(img);
    }
  }
  if (frame.childElementCount > 0) root.appendChild(frame);
  const name = document.createElement("p");
  name.className = "photo-popup__name";
  name.textContent = data.name;
  root.appendChild(name);
  if (data.takenAt !== null) {
    const date = document.createElement("p");
    date.className = "photo-popup__date";
    date.textContent = formatTakenAt(data.takenAt);
    root.appendChild(date);
  }
  const coords = document.createElement("p");
  coords.className = "photo-popup__coords";
  const coordsLink = document.createElement("a");
  coordsLink.className = "photo-popup__coords-link";
  const mapsHref = googleMapsHref(data.coords);
  coordsLink.href = mapsHref;
  if (mapsHref.startsWith("https:")) {
    coordsLink.target = "_blank";
    coordsLink.rel = "noopener";
  } else if (mapsHref.startsWith("comgooglemaps:")) {
    // comgooglemaps: fails silently when the app is missing — if we're
    // still visible after the tap, fall back to the web version.
    coordsLink.addEventListener("click", () => {
      setTimeout(() => {
        if (!document.hidden) {
          window.open(googleMapsWebHref(data.coords), "_blank", "noopener");
        }
      }, 1500);
    });
  }
  coordsLink.title = t("openInGoogleMaps");
  coordsLink.textContent = formatCoords(data.coords);
  coords.appendChild(coordsLink);
  root.appendChild(coords);
  return root;
}

function googleMapsWebHref({ lat, lon }: GpsCoords): string {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

/**
 * On phones link straight to the native maps app instead of the Google Maps
 * web page: Android resolves geo: URIs to the installed maps app, iOS opens
 * Google Maps via its comgooglemaps: scheme. Everything else gets the web URL.
 */
export function googleMapsHref(
  coords: GpsCoords,
  userAgent: string = navigator.userAgent,
): string {
  const { lat, lon } = coords;
  if (/android/i.test(userAgent)) return `geo:${lat},${lon}?q=${lat},${lon}`;
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return `comgooglemaps://?q=${lat},${lon}`;
  }
  return googleMapsWebHref(coords);
}

export function formatCoords({ lat, lon }: GpsCoords): string {
  const latRef = lat >= 0 ? "N" : "S";
  const lonRef = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}° ${latRef}, ${Math.abs(lon).toFixed(5)}° ${lonRef}`;
}
