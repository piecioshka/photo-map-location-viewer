/**
 * WCAG contrast math. Picking readable text over a user-chosen accent needs
 * relative luminance, not perceived brightness: bright greens score low on
 * the naive formula and end up with white text at ~1.3:1.
 */

export const INK = "#22272b";
export const PAPER = "#faf8f5";

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Relative luminance per WCAG 2.1, with sRGB gamma expansion. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colors, from 1 (identical) to 21 (max). */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/** The more readable of the two theme text colors over `background`. */
export function readableTextOn(background: string): string {
  return contrastRatio(INK, background) >= contrastRatio(PAPER, background)
    ? INK
    : PAPER;
}
