import { describe, expect, test } from "vitest";
import { folderQuery, imageQuery, sanitizeClientId } from "./google-drive";

describe("sanitizeClientId", () => {
  test("returns null for non-strings and blanks", () => {
    expect(sanitizeClientId(null)).toBeNull();
    expect(sanitizeClientId(undefined)).toBeNull();
    expect(sanitizeClientId(42)).toBeNull();
    expect(sanitizeClientId("")).toBeNull();
    expect(sanitizeClientId("   ")).toBeNull();
  });

  test("trims surrounding whitespace", () => {
    expect(sanitizeClientId("  abc.apps.googleusercontent.com \n")).toBe(
      "abc.apps.googleusercontent.com",
    );
  });
});

describe("Drive queries", () => {
  test("folderQuery lists only live folders under the parent", () => {
    expect(folderQuery("root")).toBe(
      "'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    );
  });

  test("imageQuery lists only live images inside the folder", () => {
    expect(imageQuery("abc123")).toBe(
      "'abc123' in parents and mimeType contains 'image/' and trashed = false",
    );
  });
});
