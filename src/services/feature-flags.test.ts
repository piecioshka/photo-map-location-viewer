import { describe, expect, it } from "vitest";
import {
  isFeatureFlag,
  parseOverrides,
  resolveFlags,
  type FeatureFlag,
} from "./feature-flags";

const DEFAULTS: Record<FeatureFlag, boolean> = { googleDrive: false };

describe("parseOverrides", () => {
  it("reads a bare name as enable and a leading dash as disable", () => {
    expect(parseOverrides("googleDrive")).toEqual({ googleDrive: true });
    expect(parseOverrides("-googleDrive")).toEqual({ googleDrive: false });
  });

  it("ignores unknown flags, empty entries and stray whitespace", () => {
    expect(parseOverrides(" googleDrive , nope ,, ")).toEqual({
      googleDrive: true,
    });
    expect(parseOverrides("nope")).toEqual({});
    expect(parseOverrides(null)).toEqual({});
    expect(parseOverrides("")).toEqual({});
  });

  it("lets the last entry win when a flag repeats", () => {
    expect(parseOverrides("googleDrive,-googleDrive")).toEqual({
      googleDrive: false,
    });
  });
});

describe("resolveFlags", () => {
  it("falls back to the build defaults without an override", () => {
    expect(resolveFlags(DEFAULTS, null)).toEqual({ googleDrive: false });
    expect(resolveFlags({ googleDrive: true }, null)).toEqual({
      googleDrive: true,
    });
  });

  it("lets the query parameter win over the default in both directions", () => {
    expect(resolveFlags(DEFAULTS, "googleDrive")).toEqual({
      googleDrive: true,
    });
    expect(resolveFlags({ googleDrive: true }, "-googleDrive")).toEqual({
      googleDrive: false,
    });
  });

  it("does not mutate the defaults it was given", () => {
    const defaults = { ...DEFAULTS };
    resolveFlags(defaults, "googleDrive");
    expect(defaults).toEqual({ googleDrive: false });
  });
});

describe("isFeatureFlag", () => {
  it("recognizes known flags only", () => {
    expect(isFeatureFlag("googleDrive")).toBe(true);
    expect(isFeatureFlag("somethingElse")).toBe(false);
  });
});
