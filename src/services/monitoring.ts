/**
 * Transient browser or network failures while fetching sw.js. The app works
 * without the service worker and the browser retries on the next visit.
 * Other registration errors (e.g. a bad HTTP status) still get reported.
 */
export const IGNORED_ERRORS = [
  /Failed to register a ServiceWorker.*An unknown error occurred when fetching the script/,
];

/**
 * Error monitoring (Sentry), enabled only when a DSN is baked in at
 * build time and never on localhost. Loaded lazily so the SDK stays
 * out of the initial bundle.
 */
export async function initMonitoring(): Promise<void> {
  const dsn: unknown = import.meta.env.VITE_SENTRY_DSN;
  if (typeof dsn !== "string" || dsn === "") return;
  if (["localhost", "127.0.0.1"].includes(location.hostname)) return;
  try {
    const Sentry = await import("@sentry/browser");
    Sentry.init({
      dsn,
      environment: "production",
      ignoreErrors: IGNORED_ERRORS,
    });
  } catch {
    // monitoring must never break the app
  }
}
