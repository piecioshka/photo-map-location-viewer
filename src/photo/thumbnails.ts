/**
 * Renders a downscaled thumbnail of an image file as a JPEG blob.
 * Returns null when the browser cannot decode the file (e.g. HEIC on
 * Chrome) — callers fall back to a placeholder.
 */
export async function makeThumbnailBlob(
  file: Blob,
  maxSize: number,
): Promise<Blob | null> {
  const bitmap = await decodeBitmap(file);
  if (!bitmap) return null;
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8),
    );
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

async function decodeBitmap(file: Blob): Promise<ImageBitmap | null> {
  try {
    // "from-image" applies EXIF orientation so portrait photos are upright.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      const converted = await convertHeic(file);
      if (!converted) return null;
      try {
        return await createImageBitmap(converted);
      } catch {
        return null;
      }
    }
  }
}

/**
 * iPhones shoot HEIC, which Chrome and Firefox cannot decode natively —
 * fall back to a WASM decoder (heic2any), loaded lazily on the first
 * HEIC file so it never weighs down the normal path.
 */
async function convertHeic(file: Blob): Promise<Blob | null> {
  const looksHeic =
    /image\/hei[cf]/.test(file.type) ||
    (file instanceof File && /\.hei[cf]$/i.test(file.name));
  if (!looksHeic) return null;
  try {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({ blob: file, toType: "image/jpeg" });
    return Array.isArray(result) ? (result[0] ?? null) : result;
  } catch {
    return null;
  }
}
