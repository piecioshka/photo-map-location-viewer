/**
 * Google Drive integration: OAuth via Google Identity Services and the
 * Drive v3 REST API. Only an OAuth Client ID is required (no API key) —
 * folders are browsed with our own picker instead of the Google Picker.
 * Photos are downloaded into memory and fed to the regular pipeline;
 * nothing is uploaded anywhere.
 */

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const GSI_SRC = "https://accounts.google.com/gsi/client";
const API_BASE = "https://www.googleapis.com/drive/v3";
const PAGE_SIZE = 200;

// ---------- Client ID (baked in at build time) ----------

export function sanitizeClientId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** OAuth Client ID from the build environment (VITE_GOOGLE_CLIENT_ID). */
export function clientId(): string | null {
  return sanitizeClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

// ---------- OAuth (Google Identity Services token flow) ----------

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: {
              type?: string;
              message?: string;
            }) => void;
          }): TokenClient;
        };
      };
    };
  }
}

let gsiLoading: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gsiLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiLoading = null;
      reject(new Error("Could not load Google sign-in. Are you online?"));
    };
    document.head.appendChild(script);
  });
  return gsiLoading;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export function clearAccessToken(): void {
  cachedToken = null;
}

/** Returns a valid access token, showing the Google consent popup if needed. */
export async function requestAccessToken(clientId: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  await loadGsi();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google sign-in is unavailable.");
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.access_token) {
          cachedToken = {
            value: response.access_token,
            expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
          };
          resolve(response.access_token);
        } else {
          reject(
            new Error(
              response.error_description ??
                response.error ??
                "Google sign-in failed.",
            ),
          );
        }
      },
      error_callback: (error) => {
        reject(
          new Error(
            error.type === "popup_closed"
              ? "Google sign-in was cancelled."
              : (error.message ?? "Google sign-in failed."),
          ),
        );
      },
    });
    client.requestAccessToken();
  });
}

// ---------- Drive API ----------

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
}

export function folderQuery(parentId: string): string {
  return `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
}

export function imageQuery(folderId: string): string {
  return `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
}

async function driveFetch(token: string, url: string): Promise<Response> {
  // Generous timeout — the same helper also streams photo downloads.
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 401 || response.status === 403) {
    clearAccessToken();
    throw new Error("Google Drive access expired — please try again.");
  }
  if (!response.ok) {
    throw new Error(`Google Drive request failed (${response.status}).`);
  }
  return response;
}

async function listAll<T>(
  token: string,
  query: string,
  fields: string,
): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: query,
      fields: `nextPageToken, files(${fields})`,
      orderBy: "name",
      pageSize: String(PAGE_SIZE),
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await driveFetch(token, `${API_BASE}/files?${params}`);
    const data: { files?: T[]; nextPageToken?: string } = await response.json();
    out.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

export function listFolders(
  token: string,
  parentId: string,
): Promise<DriveFolder[]> {
  return listAll<DriveFolder>(token, folderQuery(parentId), "id, name");
}

export function listImages(
  token: string,
  folderId: string,
): Promise<DriveImage[]> {
  return listAll<DriveImage>(token, imageQuery(folderId), "id, name, mimeType");
}

export async function downloadImage(
  token: string,
  image: DriveImage,
): Promise<File> {
  const response = await driveFetch(
    token,
    `${API_BASE}/files/${image.id}?alt=media`,
  );
  const blob = await response.blob();
  return new File([blob], image.name, { type: image.mimeType });
}

/** Downloads a batch with limited concurrency, reporting completed count. */
export async function downloadImages(
  token: string,
  images: DriveImage[],
  onProgress: (done: number) => void,
): Promise<File[]> {
  const files: (File | null)[] = new Array(images.length).fill(null);
  let next = 0;
  let done = 0;
  const workers = Array.from(
    { length: Math.min(3, images.length) },
    async () => {
      while (next < images.length) {
        const index = next;
        next += 1;
        try {
          files[index] = await downloadImage(token, images[index]);
        } catch {
          // skip files that fail to download; the rest still load
        }
        done += 1;
        onProgress(done);
      }
    },
  );
  await Promise.all(workers);
  return files.filter((file): file is File => file !== null);
}
