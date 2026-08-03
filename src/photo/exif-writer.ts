/**
 * Minimal EXIF writer: builds an APP1 segment (GPS coordinates in DMS
 * rationals, optional DateTimeOriginal) that can be spliced into any
 * JPEG right after the SOI marker. Used by demo photos and test
 * fixtures alike.
 */

export function buildExifApp1(
  lat: number,
  lon: number,
  takenAt?: string,
): Uint8Array {
  const tiff =
    takenAt === undefined
      ? buildTiffWithGps(lat, lon)
      : buildTiffWithGpsAndDate(lat, lon, takenAt);
  const payloadLen = 2 + 6 + tiff.length; // length field + "Exif\0\0" + TIFF
  const app1 = new Uint8Array(2 + payloadLen);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1[2] = payloadLen >> 8;
  app1[3] = payloadLen & 0xff;
  app1.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 4); // "Exif\0\0"
  app1.set(tiff, 10);
  return app1;
}

const TYPE_ASCII = 2;
const TYPE_LONG = 4;
const TYPE_RATIONAL = 5;

function buildTiffWithGps(lat: number, lon: number): Uint8Array {
  // Layout (offsets relative to TIFF header, little endian):
  //   0: header (8 B)
  //   8: IFD0 — 1 entry: GPS IFD pointer (2 + 12 + 4 = 18 B)
  //  26: GPS IFD — 4 entries (2 + 48 + 4 = 54 B)
  //  80: latitude rationals (24 B), 104: longitude rationals (24 B)
  const buf = new ArrayBuffer(128);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  u8[0] = 0x49; // "II" — little endian
  u8[1] = 0x49;
  dv.setUint16(2, 0x002a, true);
  dv.setUint32(4, 8, true); // IFD0 offset

  dv.setUint16(8, 1, true); // IFD0 entry count
  writeEntry(dv, 10, 0x8825, TYPE_LONG, 1, 26); // GPS IFD pointer
  dv.setUint32(22, 0, true); // no next IFD

  dv.setUint16(26, 4, true); // GPS IFD entry count
  writeAsciiRefEntry(dv, u8, 28, 0x0001, lat >= 0 ? "N" : "S");
  writeEntry(dv, 40, 0x0002, TYPE_RATIONAL, 3, 80); // GPSLatitude
  writeAsciiRefEntry(dv, u8, 52, 0x0003, lon >= 0 ? "E" : "W");
  writeEntry(dv, 64, 0x0004, TYPE_RATIONAL, 3, 104); // GPSLongitude
  dv.setUint32(76, 0, true); // no next IFD

  writeDmsRationals(dv, 80, Math.abs(lat));
  writeDmsRationals(dv, 104, Math.abs(lon));
  return u8;
}

function buildTiffWithGpsAndDate(
  lat: number,
  lon: number,
  takenAt: string,
): Uint8Array {
  // Layout (offsets relative to TIFF header, little endian):
  //   0: header (8 B)
  //   8: IFD0 — 2 entries: Exif IFD + GPS IFD pointers (2 + 24 + 4 = 30 B)
  //  38: Exif IFD — 1 entry: DateTimeOriginal (2 + 12 + 4 = 18 B)
  //  56: date string (20 B, "YYYY:MM:DD HH:MM:SS\0")
  //  76: GPS IFD — 4 entries (2 + 48 + 4 = 54 B)
  // 130: latitude rationals (24 B), 154: longitude rationals (24 B)
  const buf = new ArrayBuffer(184);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  u8[0] = 0x49; // "II" — little endian
  u8[1] = 0x49;
  dv.setUint16(2, 0x002a, true);
  dv.setUint32(4, 8, true); // IFD0 offset

  dv.setUint16(8, 2, true); // IFD0 entry count (tags sorted ascending)
  writeEntry(dv, 10, 0x8769, TYPE_LONG, 1, 38); // Exif IFD pointer
  writeEntry(dv, 22, 0x8825, TYPE_LONG, 1, 76); // GPS IFD pointer
  dv.setUint32(34, 0, true); // no next IFD

  dv.setUint16(38, 1, true); // Exif IFD entry count
  writeEntry(dv, 40, 0x9003, TYPE_ASCII, 20, 56); // DateTimeOriginal
  dv.setUint32(52, 0, true); // no next IFD
  for (let i = 0; i < 19; i += 1) u8[56 + i] = takenAt.charCodeAt(i);
  u8[75] = 0; // NUL terminator

  dv.setUint16(76, 4, true); // GPS IFD entry count
  writeAsciiRefEntry(dv, u8, 78, 0x0001, lat >= 0 ? "N" : "S");
  writeEntry(dv, 90, 0x0002, TYPE_RATIONAL, 3, 130); // GPSLatitude
  writeAsciiRefEntry(dv, u8, 102, 0x0003, lon >= 0 ? "E" : "W");
  writeEntry(dv, 114, 0x0004, TYPE_RATIONAL, 3, 154); // GPSLongitude
  dv.setUint32(126, 0, true); // no next IFD

  writeDmsRationals(dv, 130, Math.abs(lat));
  writeDmsRationals(dv, 154, Math.abs(lon));
  return u8;
}

function writeEntry(
  dv: DataView,
  offset: number,
  tag: number,
  type: number,
  count: number,
  value: number,
): void {
  dv.setUint16(offset, tag, true);
  dv.setUint16(offset + 2, type, true);
  dv.setUint32(offset + 4, count, true);
  dv.setUint32(offset + 8, value, true);
}

function writeAsciiRefEntry(
  dv: DataView,
  u8: Uint8Array,
  offset: number,
  tag: number,
  ref: string,
): void {
  dv.setUint16(offset, tag, true);
  dv.setUint16(offset + 2, TYPE_ASCII, true);
  dv.setUint32(offset + 4, 2, true);
  u8[offset + 8] = ref.charCodeAt(0); // value fits inline ("N\0")
  u8[offset + 9] = 0;
}

function writeDmsRationals(dv: DataView, offset: number, absDeg: number): void {
  const deg = Math.floor(absDeg);
  const minFloat = (absDeg - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  dv.setUint32(offset, deg, true);
  dv.setUint32(offset + 4, 1, true);
  dv.setUint32(offset + 8, min, true);
  dv.setUint32(offset + 12, 1, true);
  dv.setUint32(offset + 16, Math.round(sec * 10000), true);
  dv.setUint32(offset + 20, 10000, true);
}

/** Splices an EXIF APP1 segment into a JPEG right after SOI. */
export function injectExif(jpeg: Uint8Array, app1: Uint8Array): Uint8Array {
  const out = new Uint8Array(jpeg.length + app1.length);
  out.set(jpeg.subarray(0, 2), 0); // SOI marker
  out.set(app1, 2);
  out.set(jpeg.subarray(2), 2 + app1.length);
  return out;
}
