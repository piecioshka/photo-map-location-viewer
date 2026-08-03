/**
 * Feature toggles for the map, persisted in localStorage. Loading never
 * throws — a corrupted entry or unavailable storage yields the defaults.
 */

export const FEATURE_KEYS = [
  "dark",
  "route",
  "routeView",
  "photoList",
  "timeline",
  "calendar",
  "storeOriginals",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureSettings = Record<FeatureKey, boolean>;

export const DEFAULT_FEATURES: FeatureSettings = {
  dark: false,
  route: false,
  routeView: false,
  photoList: true,
  timeline: true,
  calendar: true,
  storeOriginals: true,
};

const STORAGE_KEY = "photo-map:features";

export function isFeatureKey(value: unknown): value is FeatureKey {
  return FEATURE_KEYS.some((key) => key === value);
}

export function sanitizeFeatures(value: unknown): FeatureSettings {
  const out = { ...DEFAULT_FEATURES };
  if (value instanceof Object) {
    for (const key of FEATURE_KEYS) {
      const raw: unknown = Reflect.get(value, key);
      if (typeof raw === "boolean") out[key] = raw;
    }
  }
  return out;
}

export function loadFeatures(): FeatureSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FEATURES };
    return sanitizeFeatures(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_FEATURES };
  }
}

export function saveFeatures(features: FeatureSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
  } catch {
    // storage unavailable — settings just won't persist
  }
}

// ---------- Date locale ----------

/** "auto" follows the browser; the rest are fixed conventions. */
export const DATE_LOCALES = ["auto", "pl-PL", "en-US", "en-GB"] as const;

export type DateLocale = (typeof DATE_LOCALES)[number];

const DATE_LOCALE_KEY = "photo-map:date-locale";

export function sanitizeDateLocale(value: unknown): DateLocale {
  for (const locale of DATE_LOCALES) {
    if (locale === value) return locale;
  }
  return "auto";
}

export function loadDateLocale(): DateLocale {
  try {
    return sanitizeDateLocale(localStorage.getItem(DATE_LOCALE_KEY));
  } catch {
    return "auto";
  }
}

export function saveDateLocale(locale: DateLocale): void {
  try {
    localStorage.setItem(DATE_LOCALE_KEY, locale);
  } catch {
    // storage unavailable — the choice just won't persist
  }
}

// ---------- Application accent color ----------

export const DEFAULT_ACCENT_COLOR = "#c2481f"; // --accent

const ACCENT_COLOR_KEY = "photo-map:accent-color";

export function sanitizeAccentColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : DEFAULT_ACCENT_COLOR;
}

export function loadAccentColor(): string {
  try {
    return sanitizeAccentColor(localStorage.getItem(ACCENT_COLOR_KEY));
  } catch {
    return DEFAULT_ACCENT_COLOR;
  }
}

export function saveAccentColor(color: string): void {
  try {
    localStorage.setItem(ACCENT_COLOR_KEY, color);
  } catch {
    // storage unavailable — the color just won't persist
  }
}
