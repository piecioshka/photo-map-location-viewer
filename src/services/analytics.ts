/**
 * Google Analytics, loaded only after the visitor accepts the analytics
 * category — and never on localhost. Photos and coordinates are never part
 * of any event; this only counts page views.
 */
const MEASUREMENT_ID = "G-N901RPN1B8";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;

function isLocalhost(): boolean {
  return ["localhost", "127.0.0.1", ""].includes(location.hostname);
}

export function enableAnalytics(): void {
  if (loaded || isLocalhost()) return;
  loaded = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  // IP anonymization is on by default in GA4; keep cookies first-party only.
  window.gtag("config", MEASUREMENT_ID, { anonymize_ip: true });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/**
 * Clears the cookies GA has already set. Called when consent is withdrawn —
 * the script cannot be unloaded, so we stop it from reporting instead.
 */
export function disableAnalytics(): void {
  // The documented GA opt-out switch lives on window under this exact name.
  Reflect.set(window, `ga-disable-${MEASUREMENT_ID}`, true);
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name && (name.startsWith("_ga") || name === "_gid")) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}`;
    }
  }
}
