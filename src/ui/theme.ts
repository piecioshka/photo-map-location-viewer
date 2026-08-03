/**
 * Runtime theming: the accent color drives the --accent CSS variable
 * (buttons, badges, route line), the dark flag flips the palette via
 * data-theme on <html>.
 */
import { readableTextOn } from "./contrast";

export function applyAccent(color: string): void {
  const root = document.documentElement;
  root.style.setProperty("--accent", color);
  root.style.setProperty("--accent-deep", darkenHex(color, 0.82));
  root.style.setProperty("--on-accent", readableTextOn(color));
}

export function applyDarkTheme(enabled: boolean): void {
  if (enabled) {
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function darkenHex(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * factor);
  const g = Math.round(((n >> 8) & 0xff) * factor);
  const b = Math.round((n & 0xff) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
