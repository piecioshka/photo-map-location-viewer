import { describe, expect, it } from "vitest";
import { INK, PAPER, contrastRatio, readableTextOn } from "./contrast";

describe("contrastRatio", () => {
  it("returns the WCAG extremes for black and white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#d9552a", PAPER)).toBeCloseTo(
      contrastRatio(PAPER, "#d9552a"),
      10,
    );
  });
});

describe("readableTextOn", () => {
  it("puts dark text on bright accents", () => {
    // Naive brightness rates pure green at 0.587 and would pick white,
    // leaving text at ~1.3:1.
    expect(readableTextOn("#00ff00")).toBe(INK);
    expect(readableTextOn("#00cccc")).toBe(INK);
    expect(readableTextOn("#ffff00")).toBe(INK);
  });

  it("puts light text on dark accents", () => {
    expect(readableTextOn("#22308f")).toBe(PAPER);
    expect(readableTextOn("#000000")).toBe(PAPER);
  });

  it("always reaches at least 3:1 for the accents a user can pick", () => {
    const samples = [
      "#d9552a",
      "#00ff00",
      "#999999",
      "#ff0000",
      "#7f7f7f",
      "#0088ff",
      "#ffffff",
    ];
    for (const accent of samples) {
      expect(contrastRatio(readableTextOn(accent), accent)).toBeGreaterThan(3);
    }
  });
});
