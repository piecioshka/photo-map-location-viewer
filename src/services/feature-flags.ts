/**
 * Feature flags. Defaults are baked in at build time from VITE_FF_*
 * variables; a `?ff=` query parameter overrides them for a single visit,
 * so a flag can be tried on a real deploy without a rebuild.
 *
 *   ?ff=googleDrive            enable
 *   ?ff=-googleDrive           disable
 *   ?ff=googleDrive,other      several at once
 */

export const FEATURE_FLAGS = ["googleDrive"] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** Build-time defaults, one VITE_FF_* variable per flag. */
const BUILD_DEFAULTS: Record<FeatureFlag, boolean> = {
  googleDrive: isEnabled(import.meta.env.VITE_FF_GOOGLE_DRIVE),
};

const OVERRIDE_PARAM = "ff";

function isEnabled(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

export function isFeatureFlag(value: string): value is FeatureFlag {
  const flags: readonly string[] = FEATURE_FLAGS;
  return flags.includes(value);
}

/**
 * Parses a `?ff=` value into per-flag overrides. Unknown names are
 * ignored so a stale link cannot break the app.
 */
export function parseOverrides(
  raw: string | null,
): Partial<Record<FeatureFlag, boolean>> {
  const overrides: Partial<Record<FeatureFlag, boolean>> = {};
  if (!raw) return overrides;
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (token === "") continue;
    const enabled = !token.startsWith("-");
    const name = enabled ? token : token.slice(1);
    if (isFeatureFlag(name)) overrides[name] = enabled;
  }
  return overrides;
}

export function resolveFlags(
  defaults: Record<FeatureFlag, boolean>,
  raw: string | null,
): Record<FeatureFlag, boolean> {
  return { ...defaults, ...parseOverrides(raw) };
}

// Resolved on first use, not at import time — the pure helpers above stay
// usable outside the browser (unit tests run without a DOM).
let active: Record<FeatureFlag, boolean> | null = null;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  active ??= resolveFlags(
    BUILD_DEFAULTS,
    typeof location === "undefined"
      ? null
      : new URLSearchParams(location.search).get(OVERRIDE_PARAM),
  );
  return active[flag];
}
