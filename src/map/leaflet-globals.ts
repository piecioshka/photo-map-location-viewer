import leaflet from "leaflet";

// Vite 8 bundles with Rolldown, which evaluates the UMD Leaflet plugins
// (markercluster, control-geocoder, locatecontrol) before Leaflet itself
// exposes the global they read. Without this they throw "L is not defined".
globalThis.L = leaflet;
